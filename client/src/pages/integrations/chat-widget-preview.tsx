import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Mail, ExternalLink, MessageSquare, MessageCircle, Phone, Loader2, ChevronLeft, ChevronRight, ChevronDown, X, Monitor, Send, Smartphone, Globe, Check, CheckCheck, Paperclip, Smile, Clock, ThumbsUp, ThumbsDown, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";
import QRCode from "qrcode";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import curbeLogo from "@assets/logo no fondo_1760457183587.png";
import { WidgetRenderer } from "@/components/chat/widget-renderer";
import { mapChatWidgetToConfig } from "@shared/widget-config";

function formatMessageTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('default', { hour: 'numeric', minute: '2-digit' }).format(d);
}

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", hex: "#3B82F6", gradient: "linear-gradient(135deg, #edf1ff, #3B82F6)" },
  { value: "green", bg: "bg-green-500", hex: "#22C55E", gradient: "linear-gradient(135deg, #edf1ff, #22C55E)" },
  { value: "purple", bg: "bg-purple-500", hex: "#A855F7", gradient: "linear-gradient(135deg, #edf1ff, #A855F7)" },
  { value: "red", bg: "bg-red-500", hex: "#EF4444", gradient: "linear-gradient(135deg, #edf1ff, #EF4444)" },
  { value: "orange", bg: "bg-orange-500", hex: "#F97316", gradient: "linear-gradient(135deg, #edf1ff, #F97316)" },
  { value: "teal", bg: "bg-teal-500", hex: "#14B8A6", gradient: "linear-gradient(135deg, #edf1ff, #14B8A6)" },
  { value: "pink", bg: "bg-pink-500", hex: "#EC4899", gradient: "linear-gradient(135deg, #edf1ff, #EC4899)" },
  { value: "indigo", bg: "bg-indigo-500", hex: "#6366F1", gradient: "linear-gradient(135deg, #edf1ff, #6366F1)" },
  { value: "rose", bg: "bg-rose-500", hex: "#F43F5E", gradient: "linear-gradient(135deg, #edf1ff, #F43F5E)" },
  { value: "cyan", bg: "bg-cyan-500", hex: "#06B6D4", gradient: "linear-gradient(135deg, #edf1ff, #06B6D4)" },
  { value: "amber", bg: "bg-amber-500", hex: "#F59E0B", gradient: "linear-gradient(135deg, #edf1ff, #F59E0B)" },
  { value: "lime", bg: "bg-lime-500", hex: "#84CC16", gradient: "linear-gradient(135deg, #edf1ff, #84CC16)" },
  { value: "emerald", bg: "bg-emerald-500", hex: "#10B981", gradient: "linear-gradient(135deg, #edf1ff, #10B981)" },
  { value: "sky", bg: "bg-sky-500", hex: "#0EA5E9", gradient: "linear-gradient(135deg, #edf1ff, #0EA5E9)" },
  { value: "violet", bg: "bg-violet-500", hex: "#8B5CF6", gradient: "linear-gradient(135deg, #edf1ff, #8B5CF6)" },
  { value: "fuchsia", bg: "bg-fuchsia-500", hex: "#D946EF", gradient: "linear-gradient(135deg, #edf1ff, #D946EF)" },
];

const channelIcons: Record<string, { icon: JSX.Element; label: string }> = {
  liveChat: { icon: <MessageSquare className="h-5 w-5" />, label: "Live Chat" },
  email: { icon: <Mail className="h-5 w-5" />, label: "Send an email" },
  sms: { icon: <MessageSquare className="h-5 w-5" />, label: "Text us" },
  phone: { icon: <Phone className="h-5 w-5" />, label: "Call us" },
  whatsapp: { icon: <SiWhatsapp className="h-5 w-5" />, label: "WhatsApp" },
  facebook: { icon: <SiFacebook className="h-5 w-5" />, label: "Messenger" },
  instagram: { icon: <SiInstagram className="h-5 w-5" />, label: "Instagram" },
  telegram: { icon: <SiTelegram className="h-5 w-5" />, label: "Telegram" },
};

function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `+1 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

function QRCodeDisplay({ value, size }: { value: string; size: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [value, size]);

  if (!qrDataUrl) return <div style={{ width: size, height: size }} className="bg-slate-100 animate-pulse" />;
  return <img src={qrDataUrl} alt="QR Code" width={size} height={size} />;
}

// State machine for chat flow - ensures only one view renders at a time
type ChatFlowState = 'idle' | 'preChatForm' | 'activeChat' | 'postChatSurvey';

export default function ChatWidgetPreviewPage() {
  const { id: widgetId } = useParams<{ id: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [activeWidgetTab, setActiveWidgetTab] = useState<"home" | "messages" | "help" | "news">("home");
  const [shouldDisplay, setShouldDisplay] = useState<boolean | null>(null);
  const [visitorCountry, setVisitorCountry] = useState<string | null>(null);
  const [targetingChecked, setTargetingChecked] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<{ isOnline: boolean; nextAvailable: string | null }>({ isOnline: true, nextAvailable: null });
  const [deviceInfo, setDeviceInfo] = useState<{ visitorDeviceType: string; widgetDeviceType: string; matches: boolean } | null>(null);
  const [pageUrlInfo, setPageUrlInfo] = useState<{ pageUrls: string; urlRules: Array<{ condition: string; value: string }> }>({ pageUrls: 'all', urlRules: [] });
  const [testUrl, setTestUrl] = useState<string>('https://example.com/contact');
  const [publicWidgetData, setPublicWidgetData] = useState<any>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  
  // State machine for chat widget flow - controls which view is shown
  const [chatFlowState, setChatFlowState] = useState<ChatFlowState>('idle');
  
  // Detect if we're in public mode (URL starts with /widget/)
  const isPublicMode = location.startsWith('/widget/');

  // Live chat state
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatVisitorId, setChatVisitorId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; text: string; direction: string; createdAt: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [showPreChatForm, setShowPreChatForm] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [isWaitingForAgent, setIsWaitingForAgent] = useState(true);
  const [sentInitialMessage, setSentInitialMessage] = useState('');
  const [connectedAgent, setConnectedAgent] = useState<{ 
    id: number; 
    firstName: string | null; 
    lastName: string | null;
    fullName: string; 
    profileImageUrl: string | null;
  } | null>(null);
  const [existingSession, setExistingSession] = useState<{
    sessionId: string;
    displayName: string;
    lastMessage: string | null;
    lastMessageAt: string | null;
    status?: string | null;
    rating?: number | null;
    feedback?: string | null;
  } | null>(null);
  
  // Multiple sessions support
  const [allSessions, setAllSessions] = useState<Array<{
    sessionId: string;
    displayName: string | null;
    lastMessage: string | null;
    lastMessageAt: string | null;
    createdAt?: string | null;
    status?: string | null;
    rating?: number | null;
    agent?: {
      id: string;
      fullName: string;
      avatar?: string | null;
    } | null;
  }>>([]);
  
  // Solved chat view state (Textmagic-style)
  const [viewingSolvedChat, setViewingSolvedChat] = useState(false);
  const [solvedChatData, setSolvedChatData] = useState<{
    sessionId: string;
    messages: Array<{ id: string; text: string; direction: string; createdAt: string }>;
    rating: number | null;
    feedback: string | null;
    agentName?: string | null;
    status?: string | null;
  } | null>(null);
  
  // Survey modal state for home screen overlay
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyModalStep, setSurveyModalStep] = useState<'rating' | 'feedback'>('rating');
  const [showOfflineFallback, setShowOfflineFallback] = useState(false);
  const [forceNewChat, setForceNewChat] = useState(false);
  const [agentsAvailable, setAgentsAvailable] = useState<boolean | null>(null);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [showLeaveMessageForm, setShowLeaveMessageForm] = useState(false);
  const [offlineMessageSent, setOfflineMessageSent] = useState(false);
  const [offlineMessageLoading, setOfflineMessageLoading] = useState(false);
  const [showEyeCatcher, setShowEyeCatcher] = useState(false);
  const [minimizedNotification, setMinimizedNotification] = useState<{
    agentName: string;
    agentPhoto: string | null;
    message: string;
  } | null>(null);
  const [chatStatus, setChatStatus] = useState<string | null>(null);
  const [showSatisfactionSurvey, setShowSatisfactionSurvey] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [surveyRating, setSurveyRating] = useState<number | null>(null);
  const [surveyFeedback, setSurveyFeedback] = useState('');
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eyeCatcherTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const agentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPreviewSentRef = useRef<number>(0);
  const liveChatWsRef = useRef<WebSocket | null>(null);
  const wsReconnectAttemptRef = useRef<number>(0);
  const wsReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const widgetOpenRef = useRef<boolean>(widgetOpen);
  const connectedAgentRef = useRef<typeof connectedAgent>(null);
  const lastSeenMessageTimeRef = useRef<number>(0);
  const initialMessageInputRef = useRef<HTMLTextAreaElement>(null);

  // Use authenticated API only when not in public mode
  const { data: authWidgetData, isLoading: authLoading } = useQuery<{ widget: any }>({
    queryKey: [`/api/integrations/chat-widget/${widgetId}`],
    enabled: !!widgetId && !isPublicMode,
  });
  
  // Fetch widget data from public API when in public mode
  useEffect(() => {
    if (!widgetId || !isPublicMode) {
      setPublicLoading(false);
      return;
    }
    
    fetch(`/api/public/chat-widget/${widgetId}`)
      .then(res => res.json())
      .then(data => {
        if (data.widget) {
          setPublicWidgetData({ widget: data.widget });
        }
        setPublicLoading(false);
      })
      .catch(() => {
        setPublicLoading(false);
      });
  }, [widgetId, isPublicMode]);
  
  // Keep refs in sync with state for WebSocket callbacks
  useEffect(() => {
    widgetOpenRef.current = widgetOpen;
    // When widget opens, clear the minimized notification and mark messages as seen
    if (widgetOpen) {
      setMinimizedNotification(null);
      // Mark the last message timestamp as seen and persist to localStorage
      if (chatMessages.length > 0) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        const lastMsgTime = new Date(lastMsg.createdAt).getTime();
        lastSeenMessageTimeRef.current = lastMsgTime;
        // Persist to localStorage so it survives page reloads
        if (widgetId) {
          localStorage.setItem(`chatLastSeenMessage-${widgetId}`, String(lastMsgTime));
        }
      }
    }
  }, [widgetOpen, chatMessages, widgetId]);
  
  useEffect(() => {
    connectedAgentRef.current = connectedAgent;
  }, [connectedAgent]);
  
  // Determine which data to use based on mode
  const isLoading = isPublicMode ? publicLoading : authLoading;
  const effectiveWidgetData = isPublicMode ? publicWidgetData : authWidgetData;

  // Restore visitor profile from localStorage (Task 3: Skip pre-chat form for returning visitors)
  useEffect(() => {
    if (!widgetId) return;
    
    try {
      const storedProfile = localStorage.getItem(`chatVisitorProfile-${widgetId}`);
      if (storedProfile) {
        const profile = JSON.parse(storedProfile);
        if (profile.name) setVisitorName(profile.name);
        if (profile.email) setVisitorEmail(profile.email);
      }
      
      // Restore last seen message timestamp from localStorage
      const storedLastSeen = localStorage.getItem(`chatLastSeenMessage-${widgetId}`);
      if (storedLastSeen) {
        lastSeenMessageTimeRef.current = parseInt(storedLastSeen, 10) || 0;
      }
    } catch (e) {
      console.error('[Chat] Failed to restore visitor profile:', e);
    }
  }, [widgetId]);

  // Restore survey state from localStorage (Task 2: Persist survey state)
  useEffect(() => {
    if (!widgetId) return;
    
    try {
      const storedSurvey = localStorage.getItem(`chatSurveyState-${widgetId}`);
      if (storedSurvey) {
        const surveyState = JSON.parse(storedSurvey);
        if (surveyState.showSatisfactionSurvey) setShowSatisfactionSurvey(true);
        if (surveyState.surveyRating !== undefined) setSurveyRating(surveyState.surveyRating);
        if (surveyState.surveyFeedback) setSurveyFeedback(surveyState.surveyFeedback);
        if (surveyState.chatSessionId) {
          setChatSessionId(surveyState.chatSessionId);
          // Properly set chatFlowState when restoring session from localStorage
          // If survey is showing, we're in post-chat survey state; otherwise resuming active chat
          if (surveyState.showSatisfactionSurvey) {
            setChatFlowState('postChatSurvey');
          } else {
            setChatFlowState('activeChat');
          }
        }
      }
    } catch (e) {
      console.error('[Chat] Failed to restore survey state:', e);
    }
  }, [widgetId]);

  // Persist survey state to localStorage when it changes
  useEffect(() => {
    if (!widgetId) return;
    
    // Only persist if survey is showing (don't persist initial state)
    if (showSatisfactionSurvey) {
      try {
        localStorage.setItem(`chatSurveyState-${widgetId}`, JSON.stringify({
          showSatisfactionSurvey,
          surveyRating,
          surveyFeedback,
          chatSessionId,
        }));
      } catch (e) {
        console.error('[Chat] Failed to persist survey state:', e);
      }
    }
  }, [widgetId, showSatisfactionSurvey, surveyRating, surveyFeedback, chatSessionId]);

  // Eye-catcher message delay - show after configured seconds (but only if user never opened widget)
  useEffect(() => {
    const widget = effectiveWidgetData?.widget;
    if (!widget?.minimizedState?.eyeCatcherEnabled || !widget?.minimizedState?.eyeCatcherMessage) {
      setShowEyeCatcher(false);
      return;
    }
    
    // Check if user has ever opened the widget - if so, never show eye-catcher again
    const hasOpenedWidget = localStorage.getItem(`chatWidgetOpened-${widgetId}`);
    if (hasOpenedWidget) {
      setShowEyeCatcher(false);
      return;
    }
    
    // Hide eye-catcher when widget is open and mark as opened
    if (widgetOpen) {
      setShowEyeCatcher(false);
      if (eyeCatcherTimeoutRef.current) {
        clearTimeout(eyeCatcherTimeoutRef.current);
        eyeCatcherTimeoutRef.current = null;
      }
      // Mark that user has opened the widget - eye-catcher won't show again
      if (widgetId) {
        localStorage.setItem(`chatWidgetOpened-${widgetId}`, 'true');
      }
      return;
    }
    
    // Get delay in milliseconds (default 0 = immediate)
    const delaySeconds = widget.minimizedState.messageDelay || 0;
    const delayMs = delaySeconds * 1000;
    
    // Clear any existing timeout
    if (eyeCatcherTimeoutRef.current) {
      clearTimeout(eyeCatcherTimeoutRef.current);
    }
    
    // Set timeout to show eye-catcher after delay
    eyeCatcherTimeoutRef.current = setTimeout(() => {
      setShowEyeCatcher(true);
    }, delayMs);
    
    return () => {
      if (eyeCatcherTimeoutRef.current) {
        clearTimeout(eyeCatcherTimeoutRef.current);
        eyeCatcherTimeoutRef.current = null;
      }
    };
  }, [effectiveWidgetData?.widget?.minimizedState?.eyeCatcherEnabled, 
      effectiveWidgetData?.widget?.minimizedState?.eyeCatcherMessage,
      effectiveWidgetData?.widget?.minimizedState?.messageDelay,
      widgetOpen, widgetId]);

  // WebSocket connection for live chat - connects when waiting for agent
  useEffect(() => {
    // Don't connect WebSocket for pending sessions (no real conversation yet)
    if (!chatSessionId || !widgetId || chatSessionId.startsWith('pending_')) return;
    
    // Get companyId from widget data
    const widget = effectiveWidgetData?.widget;
    const companyId = widget?.companyId;
    
    if (!companyId) {
      console.log('[LiveChat WS] No companyId available yet, waiting...');
      return;
    }
    
    const connectWebSocket = () => {
      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live-chat/${chatSessionId}?widgetId=${widgetId}&companyId=${companyId}`;
      
      console.log('[LiveChat WS] Connecting to:', wsUrl);
      
      try {
        const ws = new WebSocket(wsUrl);
        liveChatWsRef.current = ws;
        
        ws.onopen = () => {
          console.log('[LiveChat WS] Connected successfully');
          wsReconnectAttemptRef.current = 0; // Reset reconnect attempts on successful connection
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[LiveChat WS] Received:', data.type);
            
            switch (data.type) {
              case 'connected':
                console.log('[LiveChat WS] Connection acknowledged for session:', data.sessionId);
                break;
                
              case 'chat_accepted':
                console.log('[LiveChat WS] Agent accepted chat:', data.agentName);
                // Cancel the offline timeout since an agent accepted
                if (agentTimeoutRef.current) {
                  clearTimeout(agentTimeoutRef.current);
                  agentTimeoutRef.current = null;
                  console.log('[LiveChat] Agent accepted - cancelled offline timeout');
                }
                // Update UI state from waiting to active
                setConnectedAgent({
                  id: parseInt(data.agentId) || 0,
                  firstName: data.agentName?.split(' ')[0] || null,
                  lastName: data.agentName?.split(' ').slice(1).join(' ') || null,
                  fullName: data.agentName || 'Support Agent',
                  profileImageUrl: data.agentAvatar || null,
                });
                setIsWaitingForAgent(false);
                setShowOfflineFallback(false);
                break;
                
              case 'new_message':
                // Handle incoming messages via WebSocket (real-time)
                if (data.message) {
                  setChatMessages(prev => {
                    // Check if message already exists to avoid duplicates
                    if (prev.some(m => m.id === data.message.id)) {
                      return prev;
                    }
                    return [...prev, data.message].sort((a, b) => 
                      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );
                  });
                  
                  // Show notification when widget is minimized and message is from agent
                  if (!widgetOpenRef.current && data.message.direction === 'outbound') {
                    const agent = connectedAgentRef.current;
                    setMinimizedNotification({
                      agentName: agent?.fullName || 'Support Agent',
                      agentPhoto: agent?.profileImageUrl || null,
                      message: data.message.text?.substring(0, 100) || 'New message',
                    });
                  }
                }
                break;
                
              case 'agent_typing':
                setAgentTyping(data.isTyping ?? true);
                break;
                
              case 'pong':
                // Keepalive response, no action needed
                break;
            }
          } catch (e) {
            console.error('[LiveChat WS] Failed to parse message:', e);
          }
        };
        
        ws.onerror = (error) => {
          console.error('[LiveChat WS] WebSocket error:', error);
        };
        
        ws.onclose = (event) => {
          console.log('[LiveChat WS] Disconnected, code:', event.code);
          liveChatWsRef.current = null;
          
          // Attempt reconnection with exponential backoff (only if session still active)
          if (chatSessionId) {
            const maxAttempts = 5;
            if (wsReconnectAttemptRef.current < maxAttempts) {
              const delay = Math.min(1000 * Math.pow(2, wsReconnectAttemptRef.current), 30000);
              console.log(`[LiveChat WS] Reconnecting in ${delay}ms (attempt ${wsReconnectAttemptRef.current + 1}/${maxAttempts})`);
              wsReconnectAttemptRef.current++;
              wsReconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
            } else {
              console.log('[LiveChat WS] Max reconnect attempts reached, falling back to polling');
            }
          }
        };
      } catch (error) {
        console.error('[LiveChat WS] Failed to create WebSocket:', error);
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    // Send periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (liveChatWsRef.current?.readyState === WebSocket.OPEN) {
        liveChatWsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    // Cleanup on unmount or when session changes
    return () => {
      clearInterval(pingInterval);
      if (wsReconnectTimeoutRef.current) {
        clearTimeout(wsReconnectTimeoutRef.current);
      }
      if (liveChatWsRef.current) {
        liveChatWsRef.current.close();
        liveChatWsRef.current = null;
      }
    };
  }, [chatSessionId, widgetId, effectiveWidgetData?.widget?.companyId]);

  // Track live visitor via heartbeat - runs always when component is mounted
  useEffect(() => {
    if (!widgetId) return;
    
    // Get or create visitor ID
    let visitorId = localStorage.getItem(`chat_visitor_${widgetId}`);
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(`chat_visitor_${widgetId}`, visitorId);
    }
    
    const sendHeartbeat = () => {
      fetch('/api/public/live-visitors/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId,
          visitorId,
          currentUrl: window.location.href,
          pageTitle: document.title || 'Widget Preview',
        }),
      }).catch(() => {});
    };
    
    // Send immediately and then every 15 seconds
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
    
    return () => clearInterval(interval);
  }, [widgetId]);

  // Check targeting rules via public API
  useEffect(() => {
    if (!widgetId) return;
    
    fetch(`/api/public/chat-widget/${widgetId}`)
      .then(res => res.json())
      .then(data => {
        setShouldDisplay(data.shouldDisplay ?? true);
        setVisitorCountry(data.visitorCountry || null);
        setScheduleStatus(data.scheduleStatus || { isOnline: true, nextAvailable: null });
        setDeviceInfo(data.deviceInfo || null);
        setPageUrlInfo({
          pageUrls: data.targeting?.pageUrls || 'all',
          urlRules: data.targeting?.urlRules || []
        });
        setTargetingChecked(true);
      })
      .catch(() => {
        // On error, default to showing widget
        setShouldDisplay(true);
        setScheduleStatus({ isOnline: true, nextAvailable: null });
        setDeviceInfo(null);
        setTargetingChecked(true);
      });
  }, [widgetId]);


  // Check for existing chat session for returning visitors (show "Back to chat" card)
  // Check for existing session on page load (before widget opens)
  const [sessionChecked, setSessionChecked] = useState(false);
  
  useEffect(() => {
    if (!widgetId || sessionChecked) return;
    
    const storedVisitorId = localStorage.getItem(`chat_visitor_${widgetId}`);
    if (!storedVisitorId) {
      setExistingSession(null);
      setSessionChecked(true);
      return;
    }
    
    const checkExistingSession = async () => {
      try {
        const sessionRes = await fetch('/api/public/live-chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgetId, visitorId: storedVisitorId }),
        });
        
        if (!sessionRes.ok) {
          setSessionChecked(true);
          return;
        }
        
        const { sessionId, visitorId, pendingSession, resumed, lastMessage, lastMessageAt, displayName, agent, status, rating, feedback } = await sessionRes.json();
        
        setChatVisitorId(visitorId);
        
        // If there's an existing session (open or solved), show the "Back to chat" card
        if (resumed && sessionId) {
          setExistingSession({
            sessionId,
            displayName: displayName || 'Live chat',
            lastMessage: lastMessage || null,
            lastMessageAt: lastMessageAt || null,
            status: status || null,
            rating: rating || null,
            feedback: feedback || null,
          });
          // Only set chatSessionId if NOT solved - solved chats should be viewed differently
          if (status !== 'solved' && status !== 'closed') {
            setChatSessionId(sessionId);
            // Store agent info if available
            if (agent) {
              setConnectedAgent(agent);
            }
          }
          console.log('[Chat] Found existing session, status:', status, 'sessionId:', sessionId);
          
          // If chat was just solved and survey enabled, show survey modal
          if ((status === 'solved' || status === 'closed') && !rating && widget.liveChatSettings?.satisfactionSurvey?.enabled) {
            setShowSurveyModal(true);
            setSurveyModalStep('rating');
          }
        } else {
          setExistingSession(null);
        }
      } catch (error) {
        console.error('[Chat] Failed to check session:', error);
        setExistingSession(null);
      } finally {
        setSessionChecked(true);
      }
    };
    
    checkExistingSession();
    
    // Also load all sessions for the Messages tab
    const loadAllSessions = async () => {
      try {
        const res = await fetch(`/api/public/live-chat/sessions?widgetId=${widgetId}&visitorId=${storedVisitorId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sessions) {
            setAllSessions(data.sessions);
          }
        }
      } catch (error) {
        console.error('[Chat] Failed to load all sessions:', error);
      }
    };
    
    loadAllSessions();
  }, [widgetId, sessionChecked]);

  // Check agent availability when widget opens
  useEffect(() => {
    if (!widgetId || !widgetOpen) {
      setAgentsAvailable(null);
      return;
    }
    
    const checkAvailability = async () => {
      try {
        const res = await fetch(`/api/public/live-chat/availability?widgetId=${widgetId}`);
        const data = await res.json();
        setAgentsAvailable(data.available);
        console.log('[LiveChat] Agent availability check:', data);
        
        // If no agents available, show offline fallback immediately
        if (!data.available) {
          setShowOfflineFallback(true);
        }
      } catch (error) {
        console.error('[LiveChat] Error checking availability:', error);
        setAgentsAvailable(false);
        setShowOfflineFallback(true);
      }
    };
    
    checkAvailability();
  }, [widgetId, widgetOpen]);

  // 60-second timeout for agent acceptance - triggers offline fallback
  useEffect(() => {
    // Get timeout from widget settings, default to 60 seconds
    const widget = effectiveWidgetData?.widget;
    const timeoutSeconds = widget?.liveChatSettings?.queueSettings?.agentTimeout || 60;
    
    // Only start timer when actively waiting for an agent
    if (isWaitingForAgent && chatSessionId && !connectedAgent && !showOfflineFallback) {
      console.log(`[LiveChat] Starting ${timeoutSeconds}s timeout for agent acceptance`);
      
      agentTimeoutRef.current = setTimeout(() => {
        console.log('[LiveChat] Agent timeout reached - showing offline fallback');
        setShowOfflineFallback(true);
      }, timeoutSeconds * 1000);
      
      return () => {
        if (agentTimeoutRef.current) {
          clearTimeout(agentTimeoutRef.current);
          agentTimeoutRef.current = null;
        }
      };
    }
    
    // Cleanup when agent connects or chat closes
    return () => {
      if (agentTimeoutRef.current) {
        clearTimeout(agentTimeoutRef.current);
        agentTimeoutRef.current = null;
      }
    };
  }, [isWaitingForAgent, chatSessionId, connectedAgent, showOfflineFallback, effectiveWidgetData?.widget?.liveChatSettings?.queueSettings?.agentTimeout]);

  // Handle dismissing offline fallback to continue waiting
  const dismissOfflineFallback = () => {
    setShowOfflineFallback(false);
    // Don't restart the timer - let the visitor wait indefinitely if they choose
  };

  // Submit offline message
  const submitOfflineMessage = async () => {
    if (!offlineMessage.trim() || !widgetId) return;
    
    setOfflineMessageLoading(true);
    try {
      const visitorIdStored = localStorage.getItem(`chat_visitor_${widgetId}`);
      
      // For pending sessions, send null instead of the pending ID
      const effectiveSessionId = chatSessionId?.startsWith('pending_') ? null : chatSessionId;
      
      const res = await fetch('/api/public/live-chat/offline-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId,
          visitorId: visitorIdStored || chatVisitorId,
          sessionId: effectiveSessionId,
          visitorName: visitorName || 'Website Visitor',
          visitorEmail: visitorEmail || undefined,
          message: offlineMessage.trim(),
        }),
      });
      
      if (res.ok) {
        setOfflineMessageSent(true);
        setShowLeaveMessageForm(false);
        console.log('[LiveChat] Offline message submitted successfully');
      } else {
        console.error('[LiveChat] Failed to submit offline message');
      }
    } catch (error) {
      console.error('[LiveChat] Error submitting offline message:', error);
    } finally {
      setOfflineMessageLoading(false);
    }
  };

  // Resume existing chat session
  const resumeChat = async () => {
    if (!existingSession?.sessionId || !widgetId) return;
    
    setChatLoading(true);
    try {
      const msgRes = await fetch(`/api/public/live-chat/messages/${existingSession.sessionId}`);
      if (msgRes.ok) {
        const { messages, agent, visitor, status } = await msgRes.json();
        setChatSessionId(existingSession.sessionId);
        const sortedMessages = (messages || []).sort((a: any, b: any) => 
          new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );
        setChatMessages(sortedMessages);
        setExistingSession(null);
        
        // Restore visitor info from the conversation record
        if (visitor) {
          if (visitor.name && visitor.name !== 'Website Visitor') {
            setVisitorName(visitor.name);
          }
          if (visitor.email) {
            setVisitorEmail(visitor.email);
          }
        }
        
        // Set connected agent if chat was accepted
        if (agent) {
          setConnectedAgent(agent);
          setIsWaitingForAgent(false);
          setShowOfflineFallback(false);
        } else if (status === 'pending' || status === 'queued') {
          setIsWaitingForAgent(true);
        } else if (status === 'open' || status === 'active') {
          setShowOfflineFallback(false);
        }
        
        console.log('[Chat] Resumed chat with', messages?.length || 0, 'messages, agent:', agent?.fullName || 'none, visitor:', visitor?.name || 'unknown');
      } else {
        console.error('[Chat] Failed to load messages:', msgRes.status);
        toast({ title: "Error", description: "Failed to load chat messages", variant: "destructive" });
      }
    } catch (error) {
      console.error('[Chat] Failed to resume chat:', error);
      toast({ title: "Error", description: "Failed to resume chat", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  // View solved chat history (Textmagic-style)
  const viewSolvedChat = async () => {
    if (!existingSession?.sessionId || !widgetId) return;
    
    setChatLoading(true);
    try {
      const msgRes = await fetch(`/api/public/live-chat/messages/${existingSession.sessionId}`);
      if (msgRes.ok) {
        const { messages, agent, visitor, status, rating, feedback } = await msgRes.json();
        const sortedMessages = (messages || []).sort((a: any, b: any) => 
          new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );
        
        setSolvedChatData({
          sessionId: existingSession.sessionId,
          messages: sortedMessages,
          rating: rating || existingSession.rating || null,
          feedback: feedback || existingSession.feedback || null,
          agentName: agent?.fullName || null,
          status: status || existingSession.status || 'solved',
        });
        setViewingSolvedChat(true);
        
        // Store the sessionId for survey submission
        setChatSessionId(existingSession.sessionId);
        
        console.log('[Chat] Viewing solved chat with', sortedMessages.length, 'messages, rating:', rating);
      }
    } catch (error) {
      console.error('[Chat] Failed to load solved chat:', error);
      toast({ title: "Error", description: "Failed to load chat history", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  // Load and view a solved chat by sessionId (for Messages tab)
  const loadAndViewSolvedChat = async (sessionId: string) => {
    if (!widgetId) return;
    
    setChatLoading(true);
    try {
      const msgRes = await fetch(`/api/public/live-chat/messages/${sessionId}`);
      if (msgRes.ok) {
        const { messages, agent, visitor, status, rating, feedback } = await msgRes.json();
        const sortedMessages = (messages || []).sort((a: any, b: any) => 
          new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );
        
        setSolvedChatData({
          sessionId,
          messages: sortedMessages,
          rating: rating || null,
          feedback: feedback || null,
          agentName: agent?.fullName || null,
          status: status || 'solved',
        });
        setViewingSolvedChat(true);
        
        // Store the sessionId for survey submission (consistent with viewSolvedChat)
        setChatSessionId(sessionId);
        
        console.log('[Chat] Viewing solved chat with', sortedMessages.length, 'messages, rating:', rating);
      }
    } catch (error) {
      console.error('[Chat] Failed to load solved chat:', error);
      toast({ title: "Error", description: "Failed to load chat history", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  // Load existing messages for an active chat (for Messages tab)
  const loadExistingMessages = async (sessionId: string) => {
    if (!widgetId) return;
    
    setChatLoading(true);
    try {
      const msgRes = await fetch(`/api/public/live-chat/messages/${sessionId}`);
      if (msgRes.ok) {
        const { messages, agent, visitor, status } = await msgRes.json();
        const sortedMessages = (messages || []).sort((a: any, b: any) => 
          new Date(a.createdAt || a.created_at).getTime() - new Date(b.createdAt || b.created_at).getTime()
        );
        
        setChatMessages(sortedMessages.map((m: any) => ({
          id: m.id || String(Date.now()),
          text: m.body || m.text || '',
          direction: m.direction || 'outbound',
          createdAt: m.createdAt || m.created_at || new Date().toISOString(),
        })));
        
        if (agent) {
          setConnectedAgent(agent);
          setIsWaitingForAgent(false);
        }
        
        // Set the chatSessionId - WebSocket connects automatically via useEffect when this changes
        setChatSessionId(sessionId);
        
        console.log('[Chat] Loaded active chat with', sortedMessages.length, 'messages');
      }
    } catch (error) {
      console.error('[Chat] Failed to load messages:', error);
      toast({ title: "Error", description: "Failed to load chat messages", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  // Reset all chat session state - ensures clean slate for new chats
  const resetChatSession = () => {
    // Clear all chat-related state
    setChatSessionId(null);
    setChatMessages([]);
    setConnectedAgent(null);
    setChatStatus(null);
    setIsWaitingForAgent(true);
    setShowPreChatForm(false);
    setInitialMessage('');
    setSentInitialMessage('');
    setShowOfflineFallback(false);
    
    // Clear all survey state
    setShowSatisfactionSurvey(false);
    setSurveySubmitted(false);
    setSurveyRating(null);
    setSurveyFeedback('');
    
    // Clear solved chat state
    setSolvedChatData(null);
    setViewingSolvedChat(false);
    setShowSurveyModal(false);
    setShowFinishConfirm(false);
    
    // Clear localStorage survey state
    if (widgetId) {
      try {
        localStorage.removeItem(`chatSurveyState-${widgetId}`);
      } catch (e) {
        console.error('[Chat] Failed to clear survey state:', e);
      }
    }
    
    // Reset flow state to idle
    setChatFlowState('idle');
    
    console.log('[Chat] Session reset - all state cleared');
  };

  // Start a completely new chat (clears solved session reference)
  const startNewChat = () => {
    resetChatSession();
    setForceNewChat(true);
    
    // Check for stored profile to decide flow
    const storedProfile = localStorage.getItem(`chatVisitorProfile-${widgetId}`);
    if (storedProfile) {
      try {
        const profile = JSON.parse(storedProfile);
        if (profile.name || profile.email) {
          // Has profile - start chat directly
          startChatSession(true);
          return;
        }
      } catch (e) {
        console.error('[Chat] Failed to parse stored profile:', e);
      }
    }
    
    // No profile - show pre-chat form
    setChatFlowState('preChatForm');
    console.log('[Chat] Starting new chat - showing pre-chat form');
  };

  // Show survey modal from solved chat view
  const openSurveyFromSolvedChat = () => {
    setSurveyRating(null);
    setSurveyFeedback('');
    setSurveyModalStep('rating');
    setShowSurveyModal(true);
  };

  // Format relative time (e.g., "12 h ago")
  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} h ago`;
    if (diffDays < 7) return `${diffDays} d ago`;
    return date.toLocaleDateString();
  };

  // Live chat functions
  const startChatSession = async (overrideForceNew?: boolean, messageOverride?: string) => {
    if (!widgetId) return;
    
    // Use override if provided, otherwise use state (override handles React async state issue)
    const shouldForceNew = overrideForceNew ?? forceNewChat;
    
    setChatLoading(true);
    try {
      // Get or create visitor ID from localStorage
      let storedVisitorId = localStorage.getItem(`chat_visitor_${widgetId}`);
      if (!storedVisitorId) {
        storedVisitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(`chat_visitor_${widgetId}`, storedVisitorId);
      }
      
      // Detect browser and OS from userAgent
      const ua = navigator.userAgent;
      let browserName = 'Unknown';
      let osName = 'Unknown';
      
      // Detect browser
      if (ua.includes('Chrome') && !ua.includes('Edg')) browserName = `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] || ''}`.trim();
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = `Safari ${ua.match(/Version\/(\d+)/)?.[1] || ''}`.trim();
      else if (ua.includes('Firefox')) browserName = `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] || ''}`.trim();
      else if (ua.includes('Edg')) browserName = `Edge ${ua.match(/Edg\/(\d+)/)?.[1] || ''}`.trim();
      
      // Detect OS
      if (ua.includes('Windows')) osName = 'Windows';
      else if (ua.includes('Mac OS X')) osName = `Mac ${ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || ''}`.trim();
      else if (ua.includes('Linux')) osName = 'Linux';
      else if (ua.includes('Android')) osName = 'Android';
      else if (ua.includes('iPhone') || ua.includes('iPad')) osName = 'iOS';
      
      // Create session with visitor info and metadata
      const sessionRes = await fetch('/api/public/live-chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId,
          visitorId: storedVisitorId,
          visitorName: visitorName || 'Website Visitor',
          visitorEmail: visitorEmail.trim() || undefined,
          visitorUrl: window.location.href,
          visitorBrowser: browserName,
          visitorOs: osName,
          forceNew: shouldForceNew,
        }),
      });
      
      if (!sessionRes.ok) throw new Error('Failed to create session');
      
      const { sessionId, visitorId, pendingSession } = await sessionRes.json();
      
      setChatVisitorId(visitorId);
      setShowPreChatForm(false);
      setIsWaitingForAgent(true);
      setActiveChannel('liveChat'); // Ensure chat view is shown
      
      // Clear all survey and solved-chat state for fresh session
      setShowSatisfactionSurvey(false);
      setSurveySubmitted(false);
      setSurveyRating(null);
      setSurveyFeedback('');
      setViewingSolvedChat(false);
      setSolvedChatData(null);
      setConnectedAgent(null);
      setChatStatus('waiting');
      
      // Clear localStorage survey state for this session
      try {
        localStorage.removeItem(`chatSurveyState-${widgetId}`);
      } catch (e) {
        console.error('[Chat] Failed to clear survey state:', e);
      }
      
      // Save visitor profile to localStorage for returning visitors (Task 3)
      if (visitorName.trim() || visitorEmail.trim()) {
        try {
          localStorage.setItem(`chatVisitorProfile-${widgetId}`, JSON.stringify({
            name: visitorName.trim(),
            email: visitorEmail.trim(),
          }));
        } catch (e) {
          console.error('[Chat] Failed to save visitor profile:', e);
        }
      }
      
      // Save initial message for display in queue view
      // Use messageOverride if provided to avoid React state sync issues
      const messageToSend = (messageOverride !== undefined ? messageOverride : initialMessage).trim();
      setSentInitialMessage(messageToSend || 'Hello');
      
      // If there's an initial message, send it (this will create the conversation)
      if (messageToSend) {
        const msgRes = await fetch('/api/public/live-chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId || null,
            text: messageToSend,
            visitorName: visitorName || 'Website Visitor',
            widgetId,
            visitorId,
            visitorEmail: visitorEmail.trim() || undefined,
            visitorUrl: window.location.href,
            visitorBrowser: browserName,
            visitorOs: osName,
            forceNew: shouldForceNew,
          }),
        });
        
        if (msgRes.ok) {
          const { message, conversationId } = await msgRes.json();
          // Transition to active chat state BEFORE setting sessionId (state machine controls rendering)
          setChatFlowState('activeChat');
          setChatSessionId(conversationId || sessionId);
          setChatMessages([message]);
          setForceNewChat(false); // Reset forceNewChat after successful creation
          // Update existingSession to point to the new chat
          setExistingSession({
            sessionId: conversationId || sessionId,
            displayName: visitorName || 'Website Visitor',
            lastMessage: message.text || null,
            lastMessageAt: message.createdAt || new Date().toISOString(),
            status: 'waiting',
            rating: null,
            feedback: null,
          });
        }
        setInitialMessage('');
      } else {
        // No message - don't create conversation yet, user can type one
        // Transition to active chat state BEFORE setting sessionId (state machine controls rendering)
        setChatFlowState('activeChat');
        // Use visitorId as temporary session ID when server delays session creation
        setChatSessionId(sessionId || `pending_${visitorId}`);
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
      toast({ title: "Error", description: "Failed to start chat session", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  const sendPreviewToAgent = (text: string) => {
    // Don't send preview for pending sessions (no real conversation yet)
    if (!chatSessionId || chatSessionId.startsWith('pending_')) return;
    fetch('/api/public/live-chat/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: chatSessionId, text }),
    }).catch(() => {});
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setChatInput(value);
    
    if (chatSessionId) {
      const now = Date.now();
      if (now - lastPreviewSentRef.current > 300) {
        sendPreviewToAgent(value);
        lastPreviewSentRef.current = now;
      }
      
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      previewTimeoutRef.current = setTimeout(() => {
        sendPreviewToAgent(value);
      }, 300);
    }
  };


  // Handle visitor finishing the chat
  const handleFinishChat = async () => {
    // Can't finish a pending session (no real conversation exists)
    if (!chatSessionId || chatSessionId.startsWith('pending_')) return;
    
    try {
      const res = await fetch(`/api/public/live-chat/session/${chatSessionId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (res.ok) {
        setChatStatus('solved');
        // Transition to post-chat survey via state machine
        setChatFlowState('postChatSurvey');
        setShowSatisfactionSurvey(true);
        console.log('[Chat] Visitor finished chat session - showing survey');
      }
    } catch (error) {
      console.error('[Chat] Failed to finish chat:', error);
    }
  };
  const sendChatMessage = async () => {
    console.log('[Chat] Attempting to send message, sessionId:', chatSessionId, 'input:', chatInput);
    if (!chatSessionId || !chatInput.trim()) {
      console.log('[Chat] Send aborted: sessionId=', chatSessionId, 'input empty=', !chatInput.trim());
      return;
    }
    
    const text = chatInput.trim();
    setChatInput('');
    
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    sendPreviewToAgent('');
    
    // Check if this is a pending session (no real conversation yet)
    const isPendingSession = chatSessionId.startsWith('pending_');
    
    try {
      const res = await fetch('/api/public/live-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // For pending sessions, send null so server creates conversation
          sessionId: isPendingSession ? null : chatSessionId,
          text,
          visitorName: visitorName || 'Website Visitor',
          // Always include widgetId and visitorId for conversation creation
          widgetId,
          visitorId: chatVisitorId,
          visitorEmail: visitorEmail.trim() || undefined,
          visitorUrl: window.location.href,
        }),
      });
      
      if (res.ok) {
        const { message, conversationId } = await res.json();
        setChatMessages(prev => [...prev, message]);
        // If server created a new conversation, update the session ID
        if (conversationId && isPendingSession) {
          setChatSessionId(conversationId);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Submit satisfaction survey
  const submitSatisfactionSurvey = async () => {
    // Can't submit survey for pending session (no real conversation exists)
    if (!chatSessionId || chatSessionId.startsWith('pending_') || !surveyRating) return;
    
    setSurveySubmitting(true);
    try {
      const res = await fetch('/api/public/live-chat/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: chatSessionId,
          rating: surveyRating,
          feedback: surveyFeedback || null,
        }),
      });
      
      if (res.ok) {
        setSurveySubmitted(true);
        setShowSatisfactionSurvey(false);
        // Clear survey state from localStorage after submission
        if (widgetId) {
          localStorage.removeItem(`chatSurveyState-${widgetId}`);
        }
        console.log('[Chat] Satisfaction survey submitted successfully');
        
        // After survey submission, reset to idle state for clean next session
        setTimeout(() => {
          resetChatSession();
          setActiveChannel(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to submit satisfaction survey:', error);
    } finally {
      setSurveySubmitting(false);
    }
  };

  // Poll for new messages when in active chat
  useEffect(() => {
    // Don't poll for pending sessions - they don't exist on the server yet
    if (!chatSessionId || chatSessionId.startsWith('pending_')) return;
    
    const pollMessages = async () => {
      try {
        const lastMessage = chatMessages[chatMessages.length - 1];
        const since = lastMessage?.createdAt || '';
        const res = await fetch(`/api/public/live-chat/messages/${chatSessionId}${since ? `?since=${encodeURIComponent(since)}` : ''}`);
        if (res.ok) {
          const { messages, agent, status } = await res.json();
          
          // Update connected agent info when agent accepts the chat
          if (agent && !connectedAgent) {
            setConnectedAgent(agent);
            setIsWaitingForAgent(false);
            setShowOfflineFallback(false); // Hide offline UI when agent connects
          }
          
          // Also check status for when agent accepts but hasn't sent a message yet
          if (status === 'open' && !connectedAgent && agent) {
            setConnectedAgent(agent);
            setIsWaitingForAgent(false);
            setShowOfflineFallback(false); // Hide offline UI when chat is open
          }
          
          // Always hide offline fallback when chat is open (even if agent was already set)
          if (status === 'open') {
            setShowOfflineFallback(false);
          }
          
          // Detect when chat is solved and transition to survey via state machine
          if (status === 'solved' && chatStatus !== 'solved' && !surveySubmitted) {
            setChatStatus('solved');
            // Only show survey if enabled in widget settings
            const surveyEnabled = effectiveWidgetData?.widget?.liveChatSettings?.satisfactionSurvey?.enabled;
            if (surveyEnabled) {
              setChatFlowState('postChatSurvey');
              setShowSatisfactionSurvey(true);
            }
          } else if (status) {
            setChatStatus(status);
          }
          
          if (messages.length > 0) {
            setChatMessages(prev => {
              const newIds = new Set(messages.map((m: any) => m.id));
              const filtered = prev.filter(m => !newIds.has(m.id));
              return [...filtered, ...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
            // Check if any message is from agent (outbound = from company)
            const agentMessages = messages.filter((m: any) => m.direction === 'outbound');
            if (agentMessages.length > 0) {
              setIsWaitingForAgent(false);
              
              // Show notification when widget is minimized and there are NEW unseen agent messages
              if (!widgetOpenRef.current) {
                // Filter to only truly new messages (timestamp > last seen)
                const unseenAgentMessages = agentMessages.filter((m: any) => {
                  const msgTime = new Date(m.createdAt).getTime();
                  return msgTime > lastSeenMessageTimeRef.current;
                });
                
                if (unseenAgentMessages.length > 0) {
                  const latestAgentMsg = unseenAgentMessages[unseenAgentMessages.length - 1];
                  const agentInfo = connectedAgentRef.current || agent;
                  setMinimizedNotification({
                    agentName: agentInfo?.fullName || agent?.fullName || 'Support Agent',
                    agentPhoto: agentInfo?.profileImageUrl || agent?.avatar || null,
                    message: latestAgentMsg.text?.substring(0, 100) || 'New message',
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };
    
    pollMessages();
    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [chatSessionId, chatMessages.length, connectedAgent, chatStatus, surveySubmitted]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Poll for agent typing indicator
  useEffect(() => {
    // Don't poll for pending sessions - they don't exist on the server yet
    if (!chatSessionId || chatSessionId.startsWith('pending_')) return;
    
    const pollTyping = async () => {
      try {
        const res = await fetch(`/api/public/live-chat/typing/${chatSessionId}`);
        if (res.ok) {
          const { isTyping } = await res.json();
          setAgentTyping(isTyping);
        }
      } catch (error) {
        console.error('Typing poll error:', error);
      }
    };
    
    pollTyping();
    const interval = setInterval(pollTyping, 1000);
    return () => clearInterval(interval);
  }, [chatSessionId]);

  // Set document title for public widget preview
  useEffect(() => {
    if (isPublicMode) {
      document.title = "Chat Widget Preview";
    }
  }, [isPublicMode]);

  const defaultWidget = {
    name: "Website Widget",
    colorTheme: "blue",
    themeType: "gradient",
    customColor: "#3B82F6",
    welcomeTitle: "Hi there 👋",
    welcomeMessage: "We are here to assist you with any questions or feedback you may have.",
    channels: {
      liveChat: true,
      email: true,
      sms: true,
      phone: true,
      whatsapp: false,
      facebook: false,
      instagram: false,
      telegram: false,
    },
    channelOrder: ["liveChat", "email", "sms", "phone", "whatsapp", "facebook", "instagram", "telegram"],
    smsSettings: {
      welcomeScreen: { channelName: "Text us" },
      messageScreen: { title: "Send us a text message", description: "Click the button below to send us an SMS.", buttonLabel: "Send SMS", showQRCode: true },
      numberSettings: { numberType: "custom", customNumber: "+1 833 221 4494" },
    },
    whatsappSettings: {
      welcomeScreen: { channelName: "Chat on WhatsApp" },
      messageScreen: { title: "Message us on WhatsApp", description: "Click the button below or scan the QR code.", buttonLabel: "Open chat", showQRCode: true },
      numberSettings: { customNumber: "+1 786 630 2522" },
    },
    callSettings: {
      callUsScreen: { title: "Speak with an agent", description: "Call us for urgent matters.", buttonLabel: "Call now", showQRCode: true },
      numbersAndCountries: { entries: [{ country: "Default", phoneNumber: "+1 833 221 4494" }] },
    },
    emailSettings: {
      welcomeScreen: { channelName: "Send an email" },
      formFields: { title: "Get response via email", description: "Fill the details and we will reply.", buttonLabel: "Send email" },
    },
  };

  const widget = { 
    ...defaultWidget, 
    ...effectiveWidgetData?.widget,
    channels: { ...defaultWidget.channels, ...effectiveWidgetData?.widget?.channels },
    channelOrder: effectiveWidgetData?.widget?.channelOrder || defaultWidget.channelOrder,
  };
  
  const currentColor = colorOptions.find(c => c.value === widget.colorTheme) || colorOptions[0];
  const currentBackground = widget.themeType === "solid" 
    ? (widget.customColor || currentColor.hex)
    : currentColor.gradient;

  const embedCode = `<script src="https://app.curbe.io/widget-script.js" data-code="${widgetId}" defer=""></script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Embed code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Build full channel order including any missing channels
  const allChannelIds = ["liveChat", "email", "sms", "phone", "whatsapp", "facebook", "instagram", "telegram"];
  const savedOrder = widget.channelOrder || [];
  const missingChannels = allChannelIds.filter(id => !savedOrder.includes(id));
  const fullChannelOrder = [...savedOrder, ...missingChannels];
  
  const enabledChannels = fullChannelOrder.filter(
    (ch: string) => widget.channels?.[ch as keyof typeof widget.channels]
  );

  if (isLoading || !targetingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show targeting info banner
  const getTargetingBanner = () => {
    const targeting = widget.targeting;
    if (!targeting) return null;
    
    const countryRule = targeting.countries;
    const selectedCountries = targeting.selectedCountries || [];
    
    if (countryRule === "all") return null;
    
    const ruleText = countryRule === "selected" 
      ? `Only visible in: ${selectedCountries.join(", ")}`
      : `Hidden in: ${selectedCountries.join(", ")}`;
    
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Targeting Active:</strong> {ruleText}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          Your detected location: <strong>{visitorCountry || "Unknown"}</strong>
        </p>
      </div>
    );
  };
  
  // Show schedule status banner
  const getScheduleBanner = () => {
    const targeting = widget.targeting;
    if (!targeting || targeting.schedule === "always") return null;
    
    const statusColor = scheduleStatus.isOnline 
      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    
    const textColor = scheduleStatus.isOnline 
      ? "text-green-800 dark:text-green-200"
      : "text-amber-800 dark:text-amber-200";
    
    const subTextColor = scheduleStatus.isOnline 
      ? "text-green-600 dark:text-green-400"
      : "text-amber-600 dark:text-amber-400";
    
    return (
      <div className={`${statusColor} border rounded-lg p-3 mb-4`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${scheduleStatus.isOnline ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
          <p className={`text-sm font-medium ${textColor}`}>
            {scheduleStatus.isOnline ? "Online" : "Currently offline"}
          </p>
        </div>
        <p className={`text-xs ${subTextColor} mt-1`}>
          Schedule: {targeting.timezone || "(UTC -05:00): America/New_York"}
        </p>
        {!scheduleStatus.isOnline && scheduleStatus.nextAvailable && (
          <p className={`text-xs ${subTextColor} mt-1`}>
            Back {scheduleStatus.nextAvailable}
          </p>
        )}
      </div>
    );
  };

  // Show device type status banner
  const getDeviceTypeBanner = () => {
    if (!deviceInfo) return null;
    
    const deviceLabel = deviceInfo.visitorDeviceType === "desktop" ? "Desktop" : "Mobile";
    const isAllDevices = deviceInfo.widgetDeviceType === "all";
    const targetLabel = isAllDevices 
      ? "all devices" 
      : deviceInfo.widgetDeviceType === "desktop" 
        ? "desktop devices only" 
        : "mobile devices only";
    
    // For "all devices" config, always show as visible (blue info style)
    if (isAllDevices) {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            {deviceInfo.visitorDeviceType === "desktop" ? (
              <Monitor className="h-4 w-4 text-blue-500" />
            ) : (
              <Smartphone className="h-4 w-4 text-blue-500" />
            )}
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Viewing on {deviceLabel}
            </p>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Widget is configured to show on {targetLabel}
          </p>
        </div>
      );
    }
    
    const statusColor = deviceInfo.matches
      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    
    const textColor = deviceInfo.matches
      ? "text-green-800 dark:text-green-200"
      : "text-red-800 dark:text-red-200";
    
    const subTextColor = deviceInfo.matches
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
    
    const iconColor = deviceInfo.matches ? "text-green-500" : "text-red-500";
    
    return (
      <div className={`${statusColor} border rounded-lg p-3 mb-4`}>
        <div className="flex items-center gap-2">
          {deviceInfo.visitorDeviceType === "desktop" ? (
            <Monitor className={`h-4 w-4 ${iconColor}`} />
          ) : (
            <Smartphone className={`h-4 w-4 ${iconColor}`} />
          )}
          <p className={`text-sm font-medium ${textColor}`}>
            {deviceInfo.matches ? `Visible on ${deviceLabel}` : `Hidden on ${deviceLabel}`}
          </p>
        </div>
        <p className={`text-xs ${subTextColor} mt-1`}>
          Widget is configured to show on {targetLabel}
        </p>
        {!deviceInfo.matches && (
          <p className={`text-xs ${subTextColor} mt-1`}>
            You are viewing from a {deviceLabel.toLowerCase()} device
          </p>
        )}
      </div>
    );
  };

  // Evaluate if a URL matches the configured rules
  const evaluateUrlMatch = (url: string): boolean => {
    if (pageUrlInfo.pageUrls === 'all') return true;
    if (!pageUrlInfo.urlRules || pageUrlInfo.urlRules.length === 0) return true;
    
    const matchesAnyRule = pageUrlInfo.urlRules.some(rule => {
      if (!rule.value) return false;
      switch (rule.condition) {
        case 'contains':
          return url.toLowerCase().includes(rule.value.toLowerCase());
        case 'equals':
          return url.toLowerCase() === rule.value.toLowerCase();
        case 'starts_with':
          return url.toLowerCase().startsWith(rule.value.toLowerCase());
        case 'ends_with':
          return url.toLowerCase().endsWith(rule.value.toLowerCase());
        default:
          return url.toLowerCase().includes(rule.value.toLowerCase());
      }
    });
    
    // For 'show-specific': URL must match a rule to show widget
    // For 'hide-specific': URL must NOT match any rule to show widget
    return pageUrlInfo.pageUrls === 'show-specific' ? matchesAnyRule : !matchesAnyRule;
  };

  // Show page URL status banner
  const getPageUrlBanner = () => {
    const urlMatches = evaluateUrlMatch(testUrl);
    const isAllPages = pageUrlInfo.pageUrls === 'all';
    
    const getModeLabel = () => {
      switch (pageUrlInfo.pageUrls) {
        case 'show-specific':
          return 'Show on specific pages only';
        case 'hide-specific':
          return 'Hide on specific pages';
        default:
          return 'Show on all pages';
      }
    };

    if (isAllPages) {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Visible on all pages
            </p>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Widget will display on any page of your domain
          </p>
        </div>
      );
    }

    const statusColor = urlMatches 
      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    const textColor = urlMatches 
      ? "text-green-800 dark:text-green-200"
      : "text-red-800 dark:text-red-200";
    const subTextColor = urlMatches 
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
    const iconColor = urlMatches ? "text-green-500" : "text-red-500";

    return (
      <div className={`${statusColor} border rounded-lg p-3 mb-4`}>
        <div className="flex items-center gap-2">
          <Globe className={`h-4 w-4 ${iconColor}`} />
          <p className={`text-sm font-medium ${textColor}`}>
            {urlMatches ? 'Visible on this page' : 'Hidden on this page'}
          </p>
        </div>
        <p className={`text-xs ${subTextColor} mt-1`}>
          {getModeLabel()} - {pageUrlInfo.urlRules.filter(r => r.value).length} rule(s) configured
        </p>
        <div className="mt-2">
          <Input
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
            placeholder="Test with a URL..."
            className="text-xs h-8"
            data-testid="input-test-url"
          />
        </div>
      </div>
    );
  };

  const renderChannelContent = () => {
    if (!activeChannel) return null;

    const getPhoneNumber = () => {
      if (activeChannel === "sms") {
        return widget.smsSettings?.numberSettings?.numberType === "custom"
          ? widget.smsSettings?.numberSettings?.customNumber || "+1 833 221 4494"
          : widget.smsSettings?.numberSettings?.connectedNumber || "+1 833 221 4494";
      }
      if (activeChannel === "whatsapp") {
        return widget.whatsappSettings?.numberSettings?.customNumber || "+1 786 630 2522";
      }
      if (activeChannel === "phone") {
        return widget.callSettings?.numberSettings?.numberType === "custom"
          ? widget.callSettings?.numberSettings?.customNumber || "+1 833 221 4494"
          : widget.callSettings?.numbersAndCountries?.entries?.[0]?.phoneNumber || "+1 833 221 4494";
      }
      return "";
    };

    const channelConfig: Record<string, any> = {
      sms: {
        title: widget.smsSettings?.messageScreen?.title || "Send us a text message",
        description: widget.smsSettings?.messageScreen?.description || "Click the button below to send us an SMS.",
        buttonLabel: widget.smsSettings?.messageScreen?.buttonLabel || "Send SMS",
        showQR: widget.smsSettings?.messageScreen?.showQRCode ?? true,
        qrValue: `sms:${getPhoneNumber().replace(/[\s()\-+]/g, '')}`,
        icon: <MessageSquare className="h-5 w-5" />,
      },
      whatsapp: {
        title: widget.whatsappSettings?.messageScreen?.title || "Message us on WhatsApp",
        description: widget.whatsappSettings?.messageScreen?.description || "Click the button below or scan the QR code.",
        buttonLabel: widget.whatsappSettings?.messageScreen?.buttonLabel || "Open chat",
        showQR: widget.whatsappSettings?.messageScreen?.showQRCode ?? true,
        qrValue: `https://wa.me/${getPhoneNumber().replace(/[\s()\-+]/g, '')}`,
        icon: <SiWhatsapp className="h-5 w-5" />,
      },
      phone: {
        title: widget.callSettings?.callUsScreen?.title || "Speak with an agent",
        description: widget.callSettings?.callUsScreen?.description || "Call us for urgent matters.",
        buttonLabel: widget.callSettings?.callUsScreen?.buttonLabel || "Call now",
        showQR: widget.callSettings?.callUsScreen?.showQRCode ?? true,
        qrValue: `tel:${getPhoneNumber().replace(/[\s()\-+]/g, '')}`,
        icon: <Phone className="h-5 w-5" />,
      },
      email: {
        title: widget.emailSettings?.formFields?.title || "Get response via email",
        description: widget.emailSettings?.formFields?.description || "Fill the details and we will reply.",
        buttonLabel: widget.emailSettings?.formFields?.buttonLabel || "Send email",
        showQR: false,
        icon: <Mail className="h-5 w-5" />,
      },
      facebook: {
        title: widget.messengerSettings?.messageUsScreen?.title || "Message us on Facebook",
        description: widget.messengerSettings?.messageUsScreen?.description || "Click the button below or scan the QR code to send us a message on Facebook.",
        buttonLabel: widget.messengerSettings?.messageUsScreen?.buttonLabel || "Open Facebook",
        showQR: widget.messengerSettings?.messageUsScreen?.showQRCode ?? true,
        qrValue: `https://m.me/${widget.messengerSettings?.pageConnection?.pageId || 'curbeio'}`,
        icon: <SiFacebook className="h-5 w-5" />,
      },
      instagram: {
        title: widget.instagramSettings?.messageUsScreen?.title || "Message us on Instagram",
        description: widget.instagramSettings?.messageUsScreen?.description || "Click the button below or scan the QR code to send us a message on Instagram.",
        buttonLabel: widget.instagramSettings?.messageUsScreen?.buttonLabel || "Open Instagram",
        showQR: widget.instagramSettings?.messageUsScreen?.showQRCode ?? true,
        qrValue: `https://ig.me/m/${widget.instagramSettings?.accountConnection?.username || 'curbeio'}`,
        icon: <SiInstagram className="h-5 w-5" />,
      },
      telegram: {
        title: widget.telegramSettings?.messageUsScreen?.title || "Message us on Telegram",
        description: widget.telegramSettings?.messageUsScreen?.description || "Click the button below or scan the QR code to send us a message on Telegram.",
        buttonLabel: widget.telegramSettings?.messageUsScreen?.buttonLabel || "Open Telegram",
        showQR: widget.telegramSettings?.messageUsScreen?.showQRCode ?? true,
        qrValue: `https://t.me/${widget.telegramSettings?.botConnection?.botUsername || 'curbeio'}`,
        icon: <SiTelegram className="h-5 w-5" />,
      },
    };

    const config = channelConfig[activeChannel];
    if (!config) return null;

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 text-white" style={{ background: currentBackground }}>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveChannel(null)} className="hover:opacity-80">
              <ChevronLeft className="h-5 w-5" />
            </button>
            {config.icon}
            <span className="font-medium">{channelIcons[activeChannel]?.label}</span>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{config.title}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">{config.description}</p>
          
          {(activeChannel === "sms" || activeChannel === "whatsapp" || activeChannel === "phone") && (
            <div className="text-center">
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatPhoneNumber(getPhoneNumber())}
              </p>
            </div>
          )}
          
          {activeChannel === "email" && (
            <div className="space-y-3">
              <input type="text" placeholder="Your name" className="w-full p-2 border rounded-lg text-sm" />
              <input type="email" placeholder="Your email" className="w-full p-2 border rounded-lg text-sm" />
              <textarea placeholder="Your message" rows={3} className="w-full p-2 border rounded-lg text-sm" />
            </div>
          )}
          
          <Button className="w-full" style={{ background: currentBackground }}>
            {config.buttonLabel}
          </Button>
          
          {config.showQR && (
            <>
              <div className="flex justify-center py-4">
                <div className="relative">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-l-2 border-t-2 border-slate-300 rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-r-2 border-t-2 border-slate-300 rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-l-2 border-b-2 border-slate-300 rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-r-2 border-b-2 border-slate-300 rounded-br-lg"></div>
                  <div className="p-2">
                    <QRCodeDisplay value={config.qrValue} size={160} />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white p-1.5 rounded-full border-2" style={{ borderColor: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : currentColor.hex }}>
                      <div style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : currentColor.hex }}>
                        {config.icon}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                {activeChannel === "whatsapp" || activeChannel === "facebook" || activeChannel === "instagram" || activeChannel === "telegram" ? "Scan QR code to open a chat" : activeChannel === "phone" ? "Scan QR code to call" : "Scan QR code to send a text"}
              </p>
            </>
          )}
          
          <div className="text-center pt-2">
            <a href="https://curbe.io" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 flex items-center justify-center gap-1 hover:text-slate-600 transition-colors">
              Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
            </a>
          </div>
        </div>
      </div>
    );
  };

  const renderChannelContentInline = () => {
    if (!activeChannel) return null;

    const getPhoneNumber = () => {
      if (activeChannel === "sms") {
        return widget.smsSettings?.numberSettings?.numberType === "custom"
          ? widget.smsSettings?.numberSettings?.customNumber || "+1 833 221 4494"
          : widget.smsSettings?.numberSettings?.connectedNumber || "+1 833 221 4494";
      }
      if (activeChannel === "whatsapp") {
        return widget.whatsappSettings?.numberSettings?.customNumber || "+1 786 630 2522";
      }
      if (activeChannel === "phone") {
        return widget.callSettings?.numberSettings?.numberType === "custom"
          ? widget.callSettings?.numberSettings?.customNumber || "+1 833 221 4494"
          : widget.callSettings?.numbersAndCountries?.entries?.[0]?.phoneNumber || "+1 833 221 4494";
      }
      return "";
    };

    const channelConfig: Record<string, any> = {
      sms: {
        title: widget.smsSettings?.messageScreen?.title || "Send us a text message",
        description: widget.smsSettings?.messageScreen?.description || "Click the button below to send us an SMS.",
        buttonLabel: widget.smsSettings?.messageScreen?.buttonLabel || "Send SMS",
        showQR: widget.smsSettings?.messageScreen?.showQRCode ?? true,
        qrValue: `sms:${getPhoneNumber().replace(/[\s()\-+]/g, '')}`,
        icon: <MessageSquare className="h-5 w-5" />,
      },
      whatsapp: {
        title: widget.whatsappSettings?.messageScreen?.title || "Message us on WhatsApp",
        description: widget.whatsappSettings?.messageScreen?.description || "Click the button below or scan the QR code.",
        buttonLabel: widget.whatsappSettings?.messageScreen?.buttonLabel || "Open chat",
        showQR: widget.whatsappSettings?.messageScreen?.showQRCode ?? true,
        qrValue: `https://wa.me/${getPhoneNumber().replace(/[\s()\-+]/g, '')}`,
        icon: <SiWhatsapp className="h-5 w-5" />,
      },
      phone: {
        title: widget.callSettings?.callUsScreen?.title || "Speak with an agent",
        description: widget.callSettings?.callUsScreen?.description || "Call us for urgent matters.",
        buttonLabel: widget.callSettings?.callUsScreen?.buttonLabel || "Call now",
        showQR: widget.callSettings?.callUsScreen?.showQRCode ?? true,
        qrValue: `tel:${getPhoneNumber().replace(/[\s()\-+]/g, '')}`,
        icon: <Phone className="h-5 w-5" />,
      },
      email: {
        title: widget.emailSettings?.formFields?.title || "Get response via email",
        description: widget.emailSettings?.formFields?.description || "Fill the details and we will reply.",
        buttonLabel: widget.emailSettings?.formFields?.buttonLabel || "Send email",
        showQR: false,
        icon: <Mail className="h-5 w-5" />,
      },
      facebook: {
        title: widget.messengerSettings?.messageUsScreen?.title || "Message us on Facebook",
        description: widget.messengerSettings?.messageUsScreen?.description || "Click the button below or scan the QR code.",
        buttonLabel: widget.messengerSettings?.messageUsScreen?.buttonLabel || "Open Facebook",
        showQR: widget.messengerSettings?.messageUsScreen?.showQRCode ?? true,
        qrValue: `https://m.me/${widget.messengerSettings?.pageConnection?.pageId || 'curbeio'}`,
        icon: <SiFacebook className="h-5 w-5" />,
      },
      instagram: {
        title: widget.instagramSettings?.messageUsScreen?.title || "Message us on Instagram",
        description: widget.instagramSettings?.messageUsScreen?.description || "Click the button below or scan the QR code.",
        buttonLabel: widget.instagramSettings?.messageUsScreen?.buttonLabel || "Open Instagram",
        showQR: widget.instagramSettings?.messageUsScreen?.showQRCode ?? true,
        qrValue: `https://ig.me/m/${widget.instagramSettings?.accountConnection?.username || 'curbeio'}`,
        icon: <SiInstagram className="h-5 w-5" />,
      },
      telegram: {
        title: widget.telegramSettings?.messageUsScreen?.title || "Message us on Telegram",
        description: widget.telegramSettings?.messageUsScreen?.description || "Click the button below or scan the QR code.",
        buttonLabel: widget.telegramSettings?.messageUsScreen?.buttonLabel || "Open Telegram",
        showQR: widget.telegramSettings?.messageUsScreen?.showQRCode ?? true,
        qrValue: `https://t.me/${widget.telegramSettings?.botConnection?.botUsername || 'curbeio'}`,
        icon: <SiTelegram className="h-5 w-5" />,
      },
    };

    const config = channelConfig[activeChannel];
    if (!config) return null;

    return (
      <div className="py-4 space-y-4">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{config.title}</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400">{config.description}</p>
        
        {(activeChannel === "sms" || activeChannel === "whatsapp" || activeChannel === "phone") && (
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatPhoneNumber(getPhoneNumber())}
            </p>
          </div>
        )}
        
        {activeChannel === "email" && (
          <div className="space-y-3">
            <input type="text" placeholder="Your name" className="w-full p-2 border rounded-lg text-sm" />
            <input type="email" placeholder="Your email" className="w-full p-2 border rounded-lg text-sm" />
            <textarea placeholder="Your message" rows={3} className="w-full p-2 border rounded-lg text-sm" />
          </div>
        )}
        
        <Button className="w-full" style={{ background: currentBackground }}>
          {config.buttonLabel}
        </Button>
        
        {config.showQR && (
          <>
            <div className="flex justify-center py-2">
              <div className="relative">
                <div className="absolute -top-1 -left-1 w-5 h-5 border-l-2 border-t-2 border-slate-300 rounded-tl-lg"></div>
                <div className="absolute -top-1 -right-1 w-5 h-5 border-r-2 border-t-2 border-slate-300 rounded-tr-lg"></div>
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-l-2 border-b-2 border-slate-300 rounded-bl-lg"></div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-r-2 border-b-2 border-slate-300 rounded-br-lg"></div>
                <div className="p-2">
                  <QRCodeDisplay value={config.qrValue} size={140} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white p-1.5 rounded-full border-2" style={{ borderColor: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : currentColor.hex }}>
                    <div style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : currentColor.hex }}>
                      {config.icon}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center">
              {activeChannel === "whatsapp" || activeChannel === "facebook" || activeChannel === "instagram" || activeChannel === "telegram" ? "Scan QR code to open a chat" : activeChannel === "phone" ? "Scan QR code to call" : "Scan QR code to send a text"}
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-800" data-testid="page-widget-preview">
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src={curbeLogo} alt="Curbe" className="h-8 w-auto" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Welcome to the Curbe widget test page
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Here you can test the Curbe widget and see how it looks.
          </p>
        </div>

        {!isPublicMode && (
          <Card className="border-slate-200 dark:border-slate-800 mb-8">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Install Curbe code to your website
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Copy the code below and add it to your website before the closing <code className="text-blue-600">&lt;/body&gt;</code> tag.
              </p>
              
              <div className="relative mb-4">
                <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs overflow-x-auto border">
                  <code className="text-slate-700 dark:text-slate-300">{embedCode}</code>
                </pre>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCopyCode}
                  data-testid="button-copy-code"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? "Copied" : "Copy code"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid="button-send-instructions"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send instructions via email
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Targeting status banner - only show for admins */}
        {!isPublicMode && getTargetingBanner()}
        
        {/* Schedule status banner - only show for admins */}
        {!isPublicMode && getScheduleBanner()}
        
        {/* Device type status banner - only show for admins */}
        {!isPublicMode && getDeviceTypeBanner()}
        
        {/* Widget hidden message - only show for admins */}
        {!isPublicMode && shouldDisplay === false && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 mb-8">
            <CardContent className="p-6 text-center">
              <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Widget Hidden by Targeting Rules
              </h3>
              {deviceInfo && !deviceInfo.matches ? (
                <>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    This widget is configured to show on {deviceInfo.widgetDeviceType === "desktop" ? "desktop" : "mobile"} devices only.
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                    You are viewing from a {deviceInfo.visitorDeviceType} device.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Based on your current location ({visitorCountry || "Unknown"}), this widget is configured to not display.
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-500 mt-2">
                    The targeting rules are set to {widget.targeting?.countries === "selected" ? "only show in" : "hide in"}: {(widget.targeting?.selectedCountries || []).join(", ") || "No countries specified"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isPublicMode && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <Link 
              href={`/settings/chat-widget/${widgetId}/settings`}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back to widget settings
            </Link>
            <a 
              href="https://support.curbe.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Visit help center
            </a>
          </div>
        )}
      </div>

      {/* Only show widget if targeting rules allow */}
      {shouldDisplay !== false && (
        <div 
          className="fixed flex flex-col gap-2"
          style={{
            bottom: `${widget.minimizedState?.bottomSpacing || 26}px`,
            ...(widget.minimizedState?.alignTo === "left" 
              ? { left: `${widget.minimizedState?.sideSpacing || 32}px`, alignItems: "flex-start" }
              : { right: `${widget.minimizedState?.sideSpacing || 32}px`, alignItems: "flex-end" }
            )
          }}
        >
        {/* Minimized notification - shows agent message when widget is closed */}
        {minimizedNotification && !widgetOpen && (
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 max-w-xs cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => { setWidgetOpen(true); setMinimizedNotification(null); }}
            data-testid="minimized-notification"
          >
            {minimizedNotification.agentPhoto ? (
              <img 
                src={minimizedNotification.agentPhoto} 
                alt={minimizedNotification.agentName}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: widget.brandColor || '#3B82F6' }}
              >
                {minimizedNotification.agentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {minimizedNotification.agentName}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                {minimizedNotification.message}
              </p>
            </div>
            <button 
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); setMinimizedNotification(null); }}
              data-testid="button-dismiss-notification"
            >
              ×
            </button>
          </div>
        )}
        
        {/* Eye-catcher - shows initial greeting when widget is closed (only if no notification) */}
        {showEyeCatcher && !widgetOpen && !minimizedNotification && widget.minimizedState?.eyeCatcherEnabled && widget.minimizedState?.eyeCatcherMessage && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">{widget.minimizedState.eyeCatcherMessage}</span>
            <button 
              className="text-slate-400 hover:text-slate-600"
              onClick={() => setShowEyeCatcher(false)}
              data-testid="button-dismiss-eyecatcher"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="relative">
          <button
            onClick={() => { setWidgetOpen(!widgetOpen); setActiveChannel(null); if (!widgetOpen) setMinimizedNotification(null); }}
            className="shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-105 text-white font-medium"
            style={{ 
              background: currentBackground,
              borderRadius: `${widget.minimizedState?.borderRadius || 40}px`,
              padding: widget.minimizedState?.includeButtonText && widget.minimizedState?.buttonText 
                ? "12px 20px" 
                : "14px",
              minWidth: widget.minimizedState?.includeButtonText && widget.minimizedState?.buttonText ? "auto" : "56px",
              height: widget.minimizedState?.includeButtonText && widget.minimizedState?.buttonText ? "auto" : "56px",
            }}
            data-testid="button-widget-toggle"
          >
            {widgetOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <>
                {widget.minimizedState?.icon === "message" && <MessageCircle className="w-6 h-6" />}
                {widget.minimizedState?.icon === "phone" && <Phone className="w-6 h-6" />}
                {widget.minimizedState?.icon === "email" && <Mail className="w-6 h-6" />}
                {(!widget.minimizedState?.icon || widget.minimizedState?.icon === "chat") && <MessageSquare className="w-6 h-6" />}
                {widget.minimizedState?.includeButtonText && widget.minimizedState?.buttonText && (
                  <span>{widget.minimizedState.buttonText}</span>
                )}
              </>
            )}
          </button>
        </div>

        {widgetOpen && (
          <div 
            className="fixed w-[360px]"
            style={{
              bottom: `${(widget.minimizedState?.bottomSpacing || 26) + 70}px`,
              ...(widget.minimizedState?.alignTo === "left" 
                ? { left: `${widget.minimizedState?.sideSpacing || 32}px` }
                : { right: `${widget.minimizedState?.sideSpacing || 32}px` }
              )
            }}
          >
          {chatLoading ? (
            /* Loading state during transition */
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center" style={{ height: '680px' }}>
              <div className="px-4 py-3 text-white w-full" style={{ background: currentBackground }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm">Live Chat</span>
                    <p className="text-xs opacity-80">Connecting...</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-slate-400" />
                  <p className="text-sm text-slate-500">Starting chat...</p>
                </div>
              </div>
            </div>
          ) : viewingSolvedChat && solvedChatData ? (
            /* Solved Chat View - Textmagic style */
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col" style={{ height: '680px' }}>
              {/* Header */}
              <div className="px-4 py-3 text-white flex items-center gap-3" style={{ background: currentBackground }}>
                <button 
                  onClick={() => { 
                    setViewingSolvedChat(false);
                    setSolvedChatData(null);
                    setChatSessionId(null);
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                  data-testid="back-from-solved-chat"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm">Live chat</span>
                  <p className="text-xs opacity-80">Chat has ended</p>
                </div>
              </div>
              
              {/* Messages Area for Solved Chat */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                {/* Agent joined message */}
                {solvedChatData.agentName && (
                  <div className="text-center py-2">
                    <span className="text-xs text-slate-500 bg-white dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm">
                      {solvedChatData.agentName} joined the chat
                    </span>
                  </div>
                )}
                
                {/* All chat messages */}
                {solvedChatData.messages.map((msg, idx) => (
                  msg.direction === 'outbound' ? (
                    <div key={msg.id || idx} className="flex items-end gap-2">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium" style={{ background: currentBackground }}>
                        {solvedChatData.agentName?.[0]?.toUpperCase() || 'SA'}
                      </div>
                      <div className="flex flex-col items-start">
                        <div className="rounded-2xl rounded-bl-md bg-white dark:bg-slate-700 shadow-sm px-3 py-2 max-w-[85%]">
                          <p className="text-sm text-slate-700 dark:text-slate-200">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 ml-1">{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id || idx} className="flex justify-end">
                      <div className="flex flex-col items-end">
                        <div className="rounded-2xl rounded-br-md px-3 py-2 max-w-[85%] text-white" style={{ background: currentBackground }}>
                          <p className="text-sm">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 mr-1">{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  )
                ))}
                
                {/* Agent left message */}
                {solvedChatData.agentName && (
                  <div className="text-center py-2">
                    <span className="text-xs text-slate-500 bg-white dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm">
                      {solvedChatData.agentName} left the chat
                    </span>
                  </div>
                )}
                
                {/* Rating badge if rated */}
                {solvedChatData.rating && (
                  <div className="flex justify-center py-2">
                    <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium ${
                      solvedChatData.rating >= 4 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {solvedChatData.rating >= 4 ? (
                        <>
                          You rated chat as <ThumbsUp className="h-4 w-4" /> Good
                        </>
                      ) : (
                        <>
                          You rated chat as <ThumbsDown className="h-4 w-4" /> Bad
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Feedback if provided */}
                {solvedChatData.feedback && (
                  <div className="text-center px-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      "{solvedChatData.feedback}"
                    </p>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Bottom buttons for solved chat */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
                <button
                  onClick={startNewChat}
                  className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium"
                  style={{ background: currentBackground }}
                  data-testid="start-new-chat-button"
                >
                  Start new chat
                </button>
                {widget.liveChatSettings?.satisfactionSurvey?.enabled && (
                  <button
                    onClick={openSurveyFromSolvedChat}
                    className="w-full py-2.5 px-4 rounded-lg text-sm font-medium border-2 bg-transparent"
                    style={{ 
                      borderColor: typeof currentBackground === 'string' ? currentBackground : '#3b82f6',
                      color: typeof currentBackground === 'string' ? currentBackground : '#3b82f6'
                    }}
                    data-testid="leave-feedback-button"
                  >
                    Leave feedback
                  </button>
                )}
              </div>
              
              {/* Footer */}
              <div className="py-2 border-t border-slate-100 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-800/50">
                <a href="https://curbe.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 flex items-center justify-center gap-1 hover:text-slate-600 transition-colors">
                  Powered by <img src={curbeLogo} alt="Curbe" className="h-2.5 w-auto inline-block opacity-60" />
                </a>
              </div>
            </div>
          ) : chatFlowState === 'activeChat' ? (
            /* Active Live Chat View - Professional Design */
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col" style={{ height: '680px' }}>
              {/* Header - Clean design like Textmagic */}
              <div 
                className="px-4 py-4 border-b border-slate-200 dark:border-slate-700"
                style={{ background: currentBackground }}
              >
                <div className="flex items-center justify-between">
                  {/* Back button + Logo */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setChatSessionId(null);
                        setConnectedAgent(null);
                        setChatMessages([]);
                        setChatStatus('active');
                        setActiveWidgetTab("home");
                      }}
                      className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                      title="Back to home"
                      data-testid="button-back-to-home"
                    >
                      <ChevronLeft className="h-5 w-5 text-white" />
                    </button>
                    {widget.branding?.customLogo ? (
                      <img 
                        src={widget.branding.customLogo} 
                        alt="Logo" 
                        className="h-8 w-auto brightness-0 invert"
                      />
                    ) : (
                      <span className="font-semibold text-white text-lg">
                        {widget.welcomeTitle?.split(' ')[0] || 'Support'}
                      </span>
                    )}
                  </div>
                  
                  {/* Agent photos */}
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {connectedAgent?.profileImageUrl ? (
                        <img 
                          src={connectedAgent.profileImageUrl} 
                          alt={connectedAgent.fullName}
                          className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold border-2 border-white dark:border-slate-800 shadow-sm" style={{ background: currentBackground }}>
                          {connectedAgent ? (
                            `${connectedAgent.firstName?.[0] || ''}${connectedAgent.lastName?.[0] || ''}`.toUpperCase() || 'SA'
                          ) : (
                            <MessageCircle className="h-4 w-4" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Close/Finish button */}
                    {chatStatus !== 'solved' && (
                      <button
                        onClick={() => setShowFinishConfirm(true)}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors ml-2"
                        title="End chat"
                        data-testid="button-finish-chat"
                      >
                        <X className="h-5 w-5 text-white" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Greeting text */}
                <div className="mt-3">
                  <h4 className="text-xl font-bold text-white">
                    {connectedAgent ? `Chat with ${connectedAgent.firstName || connectedAgent.fullName}` : (
                      <div style={{ fontSize: '24px', lineHeight: '1.2' }}>
                        <div>Hi there 👋</div>
                        <div>How can we help?</div>
                      </div>
                    )}
                  </h4>
                  <p className="text-sm text-white/80 mt-0.5">
                    {connectedAgent ? 'Support Agent' : 'We typically reply in a few minutes'}
                  </p>
                </div>
              </div>
              
              {/* Finish Chat Confirmation Dialog */}
              {showFinishConfirm && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-2xl">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-5 mx-4 shadow-xl max-w-xs w-full">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">End conversation?</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Are you sure you want to end this chat? You will be asked to rate your experience.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowFinishConfirm(false)}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        data-testid="button-cancel-finish"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setShowFinishConfirm(false); handleFinishChat(); }}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                        data-testid="button-confirm-finish"
                      >
                        End Chat
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50 dark:bg-slate-800/50">
                {/* Visitor's initial message with Name/Email/Message */}
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] text-white" style={{ background: currentBackground }}>
                    <p className="text-xs mb-1"><strong>Name:</strong> {visitorName || 'Website Visitor'}</p>
                    <p className="text-xs mb-1"><strong>Email:</strong> {visitorEmail || 'Not provided'}</p>
                    <p className="text-xs"><strong>Message:</strong> {sentInitialMessage || chatMessages[0]?.text || 'Hello'}</p>
                    <p className="text-[10px] opacity-75 text-right mt-1">{formatMessageTime(chatMessages[0]?.createdAt)}</p>
                  </div>
                </div>
                
                {/* Auto-reply system message */}
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium" style={{ background: currentBackground }}>
                    <MessageCircle className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-bl-md px-3 py-2 shadow-sm max-w-[85%]">
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        {widget.liveChatSettings?.queueSettings?.autoReplyMessage || "Please wait a moment while we connect you with the next available agent."}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 ml-1">{formatMessageTime(chatMessages[0]?.createdAt)}</span>
                  </div>
                </div>
                
                {/* Queue/Waiting indicator */}
                {isWaitingForAgent && !showOfflineFallback && (
                  <div className="flex flex-col items-center justify-center py-4">
                    <p className="text-xs text-slate-500">Searching for available agents...</p>
                    <div className="mt-2 animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                  </div>
                )}
                
                {/* Offline Fallback UI - Only show when no agent connected and chat not open */}
                {showOfflineFallback && !offlineMessageSent && !connectedAgent && (
                  <div className="bg-white dark:bg-slate-700 rounded-2xl shadow-lg p-4 mx-1">
                    {!showLeaveMessageForm ? (
                      <>
                        <div className="text-center mb-4">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">We're currently unavailable</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            All our agents are busy at the moment. You can leave a message or try an alternative channel.
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <button
                            onClick={() => setShowLeaveMessageForm(true)}
                            className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
                            style={{ background: currentBackground }}
                            data-testid="leave-message-button"
                          >
                            <Mail className="h-4 w-4" />
                            Leave a message
                          </button>
                          
                          {/* Alternative contact channels */}
                          {widget.channels && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-600 mt-3">
                              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">Or contact us via:</p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                {widget.channels.whatsapp && (
                                  <a
                                    href={`https://wa.me/${widget.whatsappSettings?.numberSettings?.customNumber?.replace(/[^0-9]/g, '') || ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-green-500 hover:bg-green-600 transition-colors"
                                    data-testid="offline-whatsapp-button"
                                  >
                                    <SiWhatsapp className="h-5 w-5 text-white" />
                                  </a>
                                )}
                                {widget.channels.sms && widget.smsSettings?.numberSettings?.customNumber && (
                                  <a
                                    href={`sms:${widget.smsSettings.numberSettings.customNumber}`}
                                    className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
                                    data-testid="offline-sms-button"
                                  >
                                    <MessageSquare className="h-5 w-5 text-white" />
                                  </a>
                                )}
                                {widget.channels.phone && widget.callSettings?.numbersAndCountries?.entries?.[0]?.phoneNumber && (
                                  <a
                                    href={`tel:${widget.callSettings.numbersAndCountries.entries[0].phoneNumber}`}
                                    className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 transition-colors"
                                    data-testid="offline-call-button"
                                  >
                                    <Phone className="h-5 w-5 text-white" />
                                  </a>
                                )}
                                {widget.channels.email && (
                                  <button
                                    onClick={() => setActiveChannel('email')}
                                    className="p-2 rounded-lg bg-purple-500 hover:bg-purple-600 transition-colors"
                                    data-testid="offline-email-button"
                                  >
                                    <Mail className="h-5 w-5 text-white" />
                                  </button>
                                )}
                                {widget.channels.telegram && (
                                  <a
                                    href={`https://t.me/${widget.telegramSettings?.botUsername || ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg bg-sky-500 hover:bg-sky-600 transition-colors"
                                    data-testid="offline-telegram-button"
                                  >
                                    <SiTelegram className="h-5 w-5 text-white" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <button
                            onClick={dismissOfflineFallback}
                            className="w-full py-2 px-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            data-testid="continue-waiting-button"
                          >
                            Continue waiting
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-3">
                          <button
                            onClick={() => setShowLeaveMessageForm(false)}
                            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                          </button>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Leave us a message</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          We'll get back to you as soon as possible.
                        </p>
                        <div className="space-y-3">
                          <textarea
                            value={offlineMessage}
                            onChange={(e) => setOfflineMessage(e.target.value)}
                            placeholder="Type your message here..."
                            rows={4}
                            className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            data-testid="offline-message-input"
                          />
                          <button
                            onClick={submitOfflineMessage}
                            disabled={!offlineMessage.trim() || offlineMessageLoading}
                            className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ background: currentBackground }}
                            data-testid="submit-offline-message-button"
                          >
                            {offlineMessageLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Send message
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Offline Message Sent Confirmation */}
                {offlineMessageSent && (
                  <div className="bg-white dark:bg-slate-700 rounded-2xl shadow-lg p-4 mx-1 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">Message sent!</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Thank you for reaching out. We'll get back to you as soon as possible.
                    </p>
                  </div>
                )}
                
                {/* Agent joined notification */}
                {connectedAgent && (
                  <div className="text-center py-2">
                    <span className="text-xs text-slate-500 bg-white dark:bg-slate-700 px-3 py-1 rounded-full shadow-sm">
                      {connectedAgent.fullName} joined the chat
                    </span>
                  </div>
                )}
                
                {/* Chat messages in chronological order */}
                {chatMessages.slice(1).map((msg) => (
                  msg.direction === 'outbound' ? (
                    <div key={msg.id} className="flex items-end gap-2">
                      {connectedAgent?.profileImageUrl ? (
                        <img 
                          src={connectedAgent.profileImageUrl} 
                          alt={connectedAgent.fullName}
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium" style={{ background: currentBackground }}>
                          {connectedAgent ? (
                            `${connectedAgent.firstName?.[0] || ''}${connectedAgent.lastName?.[0] || ''}`.toUpperCase() || 'SA'
                          ) : (
                            <MessageCircle className="h-3.5 w-3.5" />
                          )}
                        </div>
                      )}
                      <div className="flex flex-col items-start">
                        <div className="rounded-2xl rounded-bl-md bg-white dark:bg-slate-700 shadow-sm px-3 py-2 max-w-[85%]">
                          <p className="text-sm text-slate-700 dark:text-slate-200">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 ml-1">{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex justify-end">
                      <div className="flex flex-col items-end">
                        <div className="rounded-2xl rounded-br-md px-3 py-2 max-w-[85%] text-white" style={{ background: currentBackground }}>
                          <p className="text-sm">{msg.text}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 mr-1">
                          <span className="text-[10px] text-slate-400">{formatMessageTime(msg.createdAt)}</span>
                          <CheckCheck className="h-3 w-3 text-blue-500" />
                        </div>
                      </div>
                    </div>
                  )
                ))}
                
                {/* Agent typing indicator */}
                {agentTyping && (
                  <div className="flex items-end gap-2">
                    {connectedAgent?.profileImageUrl ? (
                      <img 
                        src={connectedAgent.profileImageUrl} 
                        alt={connectedAgent.fullName}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium" style={{ background: currentBackground }}>
                        {connectedAgent ? (
                          `${connectedAgent.firstName?.[0] || ''}${connectedAgent.lastName?.[0] || ''}`.toUpperCase() || 'SA'
                        ) : (
                          <MessageCircle className="h-3.5 w-3.5" />
                        )}
                      </div>
                    )}
                    <div className="flex flex-col items-start">
                      <div className="rounded-2xl rounded-bl-md bg-white dark:bg-slate-700 shadow-sm px-4 py-3 max-w-[85%]">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Satisfaction Survey or Input Area */}
              {showSatisfactionSurvey ? (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-lg border">
                    {surveyRating === null ? (
                      <>
                        <h5 className="font-semibold text-slate-900 dark:text-slate-100 text-center mb-2">How was the help you received?</h5>
                        <p className="text-xs text-slate-500 text-center mb-4">We're always striving to improve and would love your feedback on the experience.</p>
                        <div className="flex justify-center gap-6 mb-3">
                          <button 
                            onClick={() => setSurveyRating(5)}
                            className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center hover:scale-110 transition-transform"
                            data-testid="survey-thumbs-up"
                          >
                            <ThumbsUp className="h-7 w-7 text-green-500" />
                          </button>
                          <button 
                            onClick={() => setSurveyRating(1)}
                            className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center hover:scale-110 transition-transform"
                            data-testid="survey-thumbs-down"
                          >
                            <ThumbsDown className="h-7 w-7 text-red-500" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setShowSatisfactionSurvey(false);
                            localStorage.removeItem(`chatSurveyState-${widgetId}`);
                          }}
                          className="text-xs text-blue-500 text-center cursor-pointer hover:underline w-full"
                          data-testid="survey-skip"
                        >
                          Skip for now
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-center mb-3">
                          {surveyRating === 5 ? (
                            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <ThumbsUp className="h-6 w-6 text-green-500" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                              <ThumbsDown className="h-6 w-6 text-red-500" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-3">
                          {surveyRating === 5 ? "Thanks! Want to share more details?" : "Sorry to hear that. How can we improve?"}
                        </p>
                        <textarea
                          value={surveyFeedback}
                          onChange={(e) => setSurveyFeedback(e.target.value)}
                          placeholder="Share your feedback (optional)"
                          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          data-testid="survey-feedback"
                        />
                        <button
                          onClick={submitSatisfactionSurvey}
                          disabled={surveySubmitting}
                          className="w-full mt-3 py-2 px-4 rounded-lg text-white font-medium transition-all disabled:opacity-50"
                          style={{ background: currentBackground }}
                          data-testid="survey-submit"
                        >
                          {surveySubmitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                        <button
                          onClick={() => setSurveyRating(null)}
                          className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-700"
                          data-testid="survey-back"
                        >
                          Change rating
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : surveySubmitted ? (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-center">
                  <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Thank you!</h4>
                  <p className="text-sm text-slate-500 mt-1">Your feedback has been submitted</p>
                  <button
                    onClick={() => {
                      resetChatSession();
                      setForceNewChat(true);
                      setChatFlowState('idle');
                      setActiveWidgetTab('home');
                    }}
                    className="mt-3 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ background: currentBackground }}
                    data-testid="button-start-new-chat-after-survey"
                  >
                    Start New Chat
                  </button>
                </div>
              ) : chatStatus === 'solved' ? (
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-center">
                  <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">Chat ended</h4>
                  <p className="text-sm text-slate-500 mt-1">This conversation has been resolved</p>
                  <button
                    onClick={() => {
                      resetChatSession();
                      setForceNewChat(true);
                      setChatFlowState('idle');
                      setActiveWidgetTab('home');
                    }}
                    className="mt-3 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
                    style={{ background: currentBackground }}
                    data-testid="button-start-new-chat-after-solved"
                  >
                    Start New Chat
                  </button>
                </div>
              ) : (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 relative">
                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-50">
                      <Picker
                        data={data}
                        onEmojiSelect={(emoji: any) => {
                          setChatInput(prev => prev + emoji.native);
                          setShowEmojiPicker(false);
                        }}
                        theme="light"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                    </div>
                  )}
                  
                  {/* Pending attachment preview */}
                  {pendingAttachment && (
                    <div className="px-3 pt-2 pb-1">
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm">
                        <Paperclip className="h-4 w-4 text-slate-500" />
                        <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{pendingAttachment.name}</span>
                        <button onClick={() => setPendingAttachment(null)} className="text-slate-400 hover:text-slate-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Text input */}
                  <div className="px-3 pt-3">
                    <textarea
                      value={chatInput}
                      onChange={handleChatInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      placeholder="Type your message here..."
                      className="w-full bg-transparent text-sm outline-none placeholder-slate-400 resize-none min-h-[40px] max-h-[100px]"
                      rows={1}
                      data-testid="chat-input"
                    />
                  </div>
                  
                  {/* Bottom toolbar */}
                  <div className="px-3 pb-3 pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        data-testid="emoji-button"
                      >
                        <Smile className="h-5 w-5 text-slate-400" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPendingAttachment(file);
                        }}
                        accept="image/*,.pdf,.doc,.docx"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        data-testid="attachment-button"
                      >
                        <Paperclip className="h-5 w-5 text-slate-400" />
                      </button>
                    </div>
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim()}
                      className="p-2 transition-all disabled:opacity-30"
                      data-testid="send-message"
                    >
                      <Send className="h-5 w-5" style={{ color: chatInput.trim() ? currentBackground as string : '#94a3b8' }} />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Footer */}
              <div className="py-2 border-t border-slate-100 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-800/50">
                <a href="https://curbe.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 flex items-center justify-center gap-1 hover:text-slate-600 transition-colors">
                  Powered by <img src={curbeLogo} alt="Curbe" className="h-2.5 w-auto inline-block opacity-60" />
                </a>
              </div>
            </div>
          ) : (
            <div className="relative" style={{ height: '680px' }}>
              {/* State machine controlled rendering - only one view at a time */}
              {chatFlowState === 'preChatForm' || showPreChatForm ? (
                /* Pre-chat form - controlled by state machine */
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 h-full">
                  {/* Header with logo and agent photos - gradient background */}
                  <div 
                    className="px-5 py-4 flex items-center justify-between"
                    style={{ background: currentBackground }}
                  >
                    {/* Logo */}
                    <div className="flex items-center">
                      {widget.branding?.customLogo ? (
                        <img src={widget.branding.customLogo} alt="Logo" className="h-6 object-contain brightness-0 invert" />
                      ) : (
                        <span className="font-semibold text-white text-lg">
                          {widget.welcomeTitle?.split(' ')[0] || 'Support'}
                        </span>
                      )}
                    </div>
                    
                    {/* Agent photos + close button - same as WidgetHeader */}
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {[
                          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
                          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
                          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
                        ].map((avatar, i) => (
                          <div 
                            key={i} 
                            className="w-9 h-9 rounded-full border-2 border-white overflow-hidden shadow-sm"
                          >
                            <img 
                              src={avatar} 
                              alt={`Team member ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => { 
                          resetChatSession();
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                        data-testid="button-close-prechat"
                      >
                        <X className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Form content - managed by existing pre-chat form logic */}
                  <div className="p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {widget.liveChatSettings?.preChatForm?.title || "Start a conversation"}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {widget.liveChatSettings?.preChatForm?.subtitle || "Enter your details to begin"}
                    </p>
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={visitorName}
                        onChange={(e) => setVisitorName(e.target.value)}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800"
                        data-testid="input-visitor-name"
                      />
                      <input
                        type="email"
                        placeholder="Your email"
                        value={visitorEmail}
                        onChange={(e) => setVisitorEmail(e.target.value)}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800"
                        data-testid="input-visitor-email"
                      />
                      <textarea
                        ref={initialMessageInputRef}
                        placeholder="How can we help?"
                        value={initialMessage}
                        onChange={(e) => setInitialMessage(e.target.value)}
                        rows={3}
                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none dark:bg-slate-800"
                        data-testid="input-initial-message"
                      />
                    </div>
                    
                    <button
                      onClick={() => {
                        // Capture form values DIRECTLY from input ref to avoid React state sync issues
                        const messageValue = initialMessageInputRef.current?.value || initialMessage || '';
                        console.log('[Chat] Pre-chat form submit - message value:', messageValue);
                        startChatSession(undefined, messageValue);
                      }}
                      disabled={chatLoading}
                      className="w-full py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: currentBackground }}
                      data-testid="button-start-chat"
                    >
                      {chatLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        "Start Chat"
                      )}
                    </button>
                  </div>
                  
                  {/* Footer */}
                  <div className="absolute bottom-0 left-0 right-0 py-2 border-t border-slate-100 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-800/50">
                    <a href="https://curbe.io" target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 flex items-center justify-center gap-1 hover:text-slate-600 transition-colors">
                      Powered by <img src={curbeLogo} alt="Curbe" className="h-2.5 w-auto inline-block opacity-60" />
                    </a>
                  </div>
                </div>
              ) : chatFlowState === 'idle' && effectiveWidgetData?.widget ? (
                <WidgetRenderer 
                  config={mapChatWidgetToConfig(effectiveWidgetData.widget)}
                  mode="embed"
                  activeTab={activeWidgetTab}
                  onTabChange={(tab) => {
                    setActiveWidgetTab(tab);
                  }}
                  onClose={() => setWidgetOpen(false)}
                  onChannelClick={(channel) => {
                    if (channel === 'liveChat') {
                      // Reset session state first to ensure clean slate
                      resetChatSession();
                      
                      const storedProfile = localStorage.getItem(`chatVisitorProfile-${widgetId}`);
                      if (storedProfile) {
                        try {
                          const profile = JSON.parse(storedProfile);
                          if (profile.name || profile.email) {
                            // Has profile - start chat directly
                            setChatFlowState('activeChat');
                            startChatSession();
                            return;
                          }
                        } catch (e) {
                          console.error('[Chat] Failed to parse stored profile:', e);
                        }
                      }
                      // No profile - show pre-chat form
                      setChatFlowState('preChatForm');
                      setShowPreChatForm(true);
                    } else {
                      setActiveChannel(channel);
                    }
                  }}
                  existingSession={existingSession}
                  onResumeChat={() => {
                    if (existingSession?.status === 'solved' || existingSession?.status === 'closed') {
                      viewSolvedChat();
                    } else {
                      resumeChat();
                    }
                  }}
                  isOffline={!scheduleStatus.isOnline}
                  nextAvailable={scheduleStatus.nextAvailable}
                  activeChannel={activeChannel}
                  onBackFromChannel={() => setActiveChannel(null)}
                  channelContent={activeChannel ? renderChannelContentInline() : undefined}
                  sessions={allSessions}
                  onSelectSession={(sessionId) => {
                    const session = allSessions.find(s => s.sessionId === sessionId);
                    if (session) {
                      if (session.status === 'solved' || session.status === 'archived') {
                        // View solved chat (read-only)
                        setChatSessionId(sessionId);
                        loadAndViewSolvedChat(sessionId);
                      } else {
                        // Resume active chat
                        setChatSessionId(sessionId);
                        setActiveChannel('liveChat');
                        loadExistingMessages(sessionId);
                      }
                    }
                  }}
                  onStartNewChat={() => {
                    // Use state machine to start a new chat cleanly
                    resetChatSession();
                    setForceNewChat(true);
                    
                    const storedProfile = localStorage.getItem(`chatVisitorProfile-${widgetId}`);
                    if (storedProfile) {
                      try {
                        const profile = JSON.parse(storedProfile);
                        if (profile.name || profile.email) {
                          setChatFlowState('activeChat');
                          startChatSession(true);
                          return;
                        }
                      } catch (e) {
                        console.error('[Chat] Failed to parse stored profile:', e);
                      }
                    }
                    // No profile - show pre-chat form
                    setChatFlowState('preChatForm');
                    setShowPreChatForm(true);
                  }}
                />
              ) : chatFlowState === 'idle' && !effectiveWidgetData?.widget ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-slate-500">Loading chat widget...</p>
                  </div>
                </div>
              ) : null}
              
              {/* Offline status overlay for WidgetRenderer mode */}
              {!showPreChatForm && effectiveWidgetData?.widget && !scheduleStatus.isOnline && (
                <div className="absolute top-[80px] left-5 right-5 z-10">
                  <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-200">We're currently offline</span>
                    </div>
                    {scheduleStatus.nextAvailable && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-4">
                        Back {scheduleStatus.nextAvailable}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Survey Modal Overlay - Textmagic style */}
              {showSurveyModal && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4 rounded-xl z-50">
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-5">
                    {surveyModalStep === 'rating' ? (
                      <>
                        <h5 className="font-semibold text-slate-900 dark:text-slate-100 text-center mb-2">
                          How was the help you received?
                        </h5>
                        <p className="text-xs text-slate-500 text-center mb-5">
                          We're always striving to improve and would love your feedback on the experience.
                        </p>
                        <div className="flex justify-center gap-8 mb-5">
                          <button 
                            onClick={() => {
                              setSurveyRating(5);
                              setSurveyModalStep('feedback');
                            }}
                            className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                            data-testid="survey-modal-thumbs-up"
                          >
                            <ThumbsUp className="h-8 w-8 text-white" />
                          </button>
                          <button 
                            onClick={() => {
                              setSurveyRating(1);
                              setSurveyModalStep('feedback');
                            }}
                            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                            data-testid="survey-modal-thumbs-down"
                          >
                            <ThumbsDown className="h-8 w-8 text-white" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setShowSurveyModal(false);
                            setSurveyModalStep('rating');
                            setSurveyRating(null);
                            localStorage.removeItem(`chatSurveyState-${widgetId}`);
                          }}
                          className="text-sm text-slate-400 hover:text-slate-600 text-center cursor-pointer w-full"
                          data-testid="survey-modal-skip"
                        >
                          Skip for now
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-center mb-4">
                          {surveyRating && surveyRating >= 4 ? (
                            <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                              <ThumbsUp className="h-7 w-7 text-white" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                              <ThumbsDown className="h-7 w-7 text-white" />
                            </div>
                          )}
                        </div>
                        <h5 className="font-semibold text-slate-900 dark:text-slate-100 text-center mb-2">
                          {surveyRating && surveyRating >= 4 ? "We are glad you liked it" : "Sorry to hear that"}
                        </h5>
                        <p className="text-xs text-slate-500 text-center mb-4">
                          We're always striving to improve and would love your feedback on the experience.
                        </p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1.5">
                              {surveyRating && surveyRating >= 4 ? "Tell us where we did good" : "Tell us how we can improve"}
                            </label>
                            <textarea
                              value={surveyFeedback}
                              onChange={(e) => setSurveyFeedback(e.target.value)}
                              placeholder={surveyRating && surveyRating >= 4 ? "What did you like about this chat?" : "What could we do better?"}
                              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={3}
                              data-testid="survey-modal-feedback"
                            />
                          </div>
                          <button
                            onClick={async () => {
                              await submitSatisfactionSurvey();
                              setShowSurveyModal(false);
                              setSurveyModalStep('rating');
                              if (solvedChatData) {
                                setSolvedChatData({
                                  ...solvedChatData,
                                  rating: surveyRating,
                                  feedback: surveyFeedback || null,
                                });
                              }
                              if (existingSession) {
                                setExistingSession({
                                  ...existingSession,
                                  rating: surveyRating,
                                  feedback: surveyFeedback || null,
                                });
                              }
                            }}
                            disabled={surveySubmitting}
                            className="w-full py-2.5 px-4 rounded-lg text-white font-medium transition-all disabled:opacity-50"
                            style={{ background: currentBackground }}
                            data-testid="survey-modal-submit"
                          >
                            {surveySubmitting ? 'Sending...' : 'Send feedback'}
                          </button>
                          <button
                            onClick={() => {
                              setShowSurveyModal(false);
                              setSurveyModalStep('rating');
                              setSurveyRating(null);
                              setSurveyFeedback('');
                            }}
                            className="text-sm text-slate-400 hover:text-slate-600 text-center cursor-pointer w-full"
                            data-testid="survey-modal-skip-feedback"
                          >
                            Skip for now
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
