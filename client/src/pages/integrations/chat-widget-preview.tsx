import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Mail, ExternalLink, MessageSquare, MessageCircle, Phone, Loader2, ChevronLeft, ChevronRight, X, Monitor, Send, Smartphone, Globe, Check, CheckCheck, Paperclip, Smile, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";
import QRCode from "qrcode";
import curbeLogo from "@assets/logo no fondo_1760457183587.png";

function formatMessageTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('default', { hour: 'numeric', minute: '2-digit' }).format(d);
}

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", hex: "#3B82F6", gradient: "linear-gradient(135deg, #3B82F6, #1D4ED8)" },
  { value: "green", bg: "bg-green-500", hex: "#22C55E", gradient: "linear-gradient(135deg, #22C55E, #16A34A)" },
  { value: "purple", bg: "bg-purple-500", hex: "#A855F7", gradient: "linear-gradient(135deg, #A855F7, #7C3AED)" },
  { value: "red", bg: "bg-red-500", hex: "#EF4444", gradient: "linear-gradient(135deg, #EF4444, #DC2626)" },
  { value: "orange", bg: "bg-orange-500", hex: "#F97316", gradient: "linear-gradient(135deg, #F97316, #EA580C)" },
  { value: "teal", bg: "bg-teal-500", hex: "#14B8A6", gradient: "linear-gradient(135deg, #14B8A6, #0D9488)" },
  { value: "pink", bg: "bg-pink-500", hex: "#EC4899", gradient: "linear-gradient(135deg, #EC4899, #DB2777)" },
  { value: "indigo", bg: "bg-indigo-500", hex: "#6366F1", gradient: "linear-gradient(135deg, #6366F1, #4F46E5)" },
  { value: "rose", bg: "bg-rose-500", hex: "#F43F5E", gradient: "linear-gradient(135deg, #F43F5E, #E11D48)" },
  { value: "cyan", bg: "bg-cyan-500", hex: "#06B6D4", gradient: "linear-gradient(135deg, #06B6D4, #0891B2)" },
  { value: "amber", bg: "bg-amber-500", hex: "#F59E0B", gradient: "linear-gradient(135deg, #F59E0B, #D97706)" },
  { value: "lime", bg: "bg-lime-500", hex: "#84CC16", gradient: "linear-gradient(135deg, #84CC16, #65A30D)" },
  { value: "emerald", bg: "bg-emerald-500", hex: "#10B981", gradient: "linear-gradient(135deg, #10B981, #059669)" },
  { value: "sky", bg: "bg-sky-500", hex: "#0EA5E9", gradient: "linear-gradient(135deg, #0EA5E9, #0284C7)" },
  { value: "violet", bg: "bg-violet-500", hex: "#8B5CF6", gradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)" },
  { value: "fuchsia", bg: "bg-fuchsia-500", hex: "#D946EF", gradient: "linear-gradient(135deg, #D946EF, #C026D3)" },
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

export default function ChatWidgetPreviewPage() {
  const { id: widgetId } = useParams<{ id: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [shouldDisplay, setShouldDisplay] = useState<boolean | null>(null);
  const [visitorCountry, setVisitorCountry] = useState<string | null>(null);
  const [targetingChecked, setTargetingChecked] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<{ isOnline: boolean; nextAvailable: string | null }>({ isOnline: true, nextAvailable: null });
  const [deviceInfo, setDeviceInfo] = useState<{ visitorDeviceType: string; widgetDeviceType: string; matches: boolean } | null>(null);
  const [pageUrlInfo, setPageUrlInfo] = useState<{ pageUrls: string; urlRules: Array<{ condition: string; value: string }> }>({ pageUrls: 'all', urlRules: [] });
  const [testUrl, setTestUrl] = useState<string>('https://example.com/contact');
  const [publicWidgetData, setPublicWidgetData] = useState<any>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  
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
  } | null>(null);
  const [showOfflineFallback, setShowOfflineFallback] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [showLeaveMessageForm, setShowLeaveMessageForm] = useState(false);
  const [offlineMessageSent, setOfflineMessageSent] = useState(false);
  const [offlineMessageLoading, setOfflineMessageLoading] = useState(false);
  const [showEyeCatcher, setShowEyeCatcher] = useState(false);
  const eyeCatcherTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const agentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPreviewSentRef = useRef<number>(0);
  const liveChatWsRef = useRef<WebSocket | null>(null);
  const wsReconnectAttemptRef = useRef<number>(0);
  const wsReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  
  // Determine which data to use based on mode
  const isLoading = isPublicMode ? publicLoading : authLoading;
  const effectiveWidgetData = isPublicMode ? publicWidgetData : authWidgetData;

  // Eye-catcher message delay - show after configured seconds
  useEffect(() => {
    const widget = effectiveWidgetData?.widget;
    if (!widget?.minimizedState?.eyeCatcherEnabled || !widget?.minimizedState?.eyeCatcherMessage) {
      setShowEyeCatcher(false);
      return;
    }
    
    // Hide eye-catcher when widget is open
    if (widgetOpen) {
      setShowEyeCatcher(false);
      if (eyeCatcherTimeoutRef.current) {
        clearTimeout(eyeCatcherTimeoutRef.current);
        eyeCatcherTimeoutRef.current = null;
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
      widgetOpen]);

  // WebSocket connection for live chat - connects when waiting for agent
  useEffect(() => {
    if (!chatSessionId || !widgetId) return;
    
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
        
        const { sessionId, visitorId, pendingSession, resumed, lastMessage, lastMessageAt, displayName, agent } = await sessionRes.json();
        
        setChatVisitorId(visitorId);
        
        // If there's an existing open session, show the "Back to chat" card
        if (resumed && sessionId) {
          setExistingSession({
            sessionId,
            displayName: displayName || 'Chat',
            lastMessage: lastMessage || null,
            lastMessageAt: lastMessageAt || null,
          });
          // CRITICAL: Set chatSessionId immediately so messages can be sent
          setChatSessionId(sessionId);
          // Store agent info if available
          if (agent) {
            setConnectedAgent(agent);
          }
          console.log('[Chat] Found existing session, set chatSessionId:', sessionId);
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
  }, [widgetId, sessionChecked]);

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
      
      const res = await fetch('/api/public/live-chat/offline-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId,
          visitorId: visitorIdStored || chatVisitorId,
          sessionId: chatSessionId,
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
        } else if (status === 'pending' || status === 'queued') {
          setIsWaitingForAgent(true);
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
  const startChatSession = async () => {
    if (!widgetId) return;
    
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
        }),
      });
      
      if (!sessionRes.ok) throw new Error('Failed to create session');
      
      const { sessionId, visitorId, pendingSession } = await sessionRes.json();
      
      setChatVisitorId(visitorId);
      setShowPreChatForm(false);
      setIsWaitingForAgent(true);
      
      // Save initial message for display in queue view
      const messageToSend = initialMessage.trim();
      setSentInitialMessage(messageToSend || 'Hello');
      
      // Use browserName and osName from earlier detection
      
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
          }),
        });
        
        if (msgRes.ok) {
          const { message, conversationId } = await msgRes.json();
          setChatSessionId(conversationId || sessionId);
          setChatMessages([message]);
        }
        setInitialMessage('');
      } else {
        // No message - don't create conversation yet, user can type one
        setChatSessionId(sessionId);
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
    if (!chatSessionId) return;
    fetch('/api/public/live-chat/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: chatSessionId, text }),
    }).catch(() => {});
  };

  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    
    try {
      const res = await fetch('/api/public/live-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: chatSessionId,
          text,
          visitorName: visitorName || 'Website Visitor',
        }),
      });
      
      if (res.ok) {
        const { message } = await res.json();
        setChatMessages(prev => [...prev, message]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Poll for new messages when in active chat
  useEffect(() => {
    if (!chatSessionId) return;
    
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
          }
          
          // Also check status for when agent accepts but hasn't sent a message yet
          if (status === 'open' && !connectedAgent && agent) {
            setConnectedAgent(agent);
            setIsWaitingForAgent(false);
          }
          
          if (messages.length > 0) {
            setChatMessages(prev => {
              const newIds = new Set(messages.map((m: any) => m.id));
              const filtered = prev.filter(m => !newIds.has(m.id));
              return [...filtered, ...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
            // Check if any message is from agent (outbound = from company)
            const hasAgentMessage = messages.some((m: any) => m.direction === 'outbound');
            if (hasAgentMessage) {
              setIsWaitingForAgent(false);
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
  }, [chatSessionId, chatMessages.length, connectedAgent]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Poll for agent typing indicator
  useEffect(() => {
    if (!chatSessionId) return;
    
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
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
              Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
            </p>
          </div>
        </div>
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
        {showEyeCatcher && !widgetOpen && widget.minimizedState?.eyeCatcherEnabled && widget.minimizedState?.eyeCatcherMessage && (
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
            onClick={() => { setWidgetOpen(!widgetOpen); setActiveChannel(null); }}
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
            className="fixed w-80"
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center" style={{ height: '520px' }}>
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
          ) : chatSessionId ? (
            /* Active Live Chat View - Professional Design */
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col" style={{ height: '520px' }}>
              {/* Header with agent info */}
              <div className="px-4 py-3 text-white flex items-center gap-3" style={{ background: currentBackground }}>
                <button 
                  onClick={() => { 
                    // Keep session in localStorage so visitor can return to chat
                    // Save current session info for "Back to chat" card
                    const lastMsg = chatMessages[chatMessages.length - 1];
                    setExistingSession({
                      sessionId: chatSessionId,
                      displayName: connectedAgent?.fullName || visitorName || 'Support Chat',
                      lastMessage: lastMsg?.text || null,
                      lastMessageAt: lastMsg?.createdAt || null,
                    });
                    setChatSessionId(null); 
                    setChatMessages([]); 
                    setConnectedAgent(null); 
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                  data-testid="back-from-chat"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="relative">
                  {connectedAgent?.profileImageUrl ? (
                    <img 
                      src={connectedAgent.profileImageUrl} 
                      alt={connectedAgent.fullName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm text-sm font-semibold">
                      {connectedAgent ? (
                        `${connectedAgent.firstName?.[0] || ''}${connectedAgent.lastName?.[0] || ''}`.toUpperCase() || 'SA'
                      ) : (
                        <MessageCircle className="h-5 w-5" />
                      )}
                    </div>
                  )}
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm">
                    {connectedAgent ? connectedAgent.fullName : 'Live Chat'}
                  </span>
                  <p className="text-xs opacity-80">
                    {connectedAgent ? 'Support Agent' : 'Usually replies in a few minutes'}
                  </p>
                </div>
              </div>
              
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
                
                {/* Offline Fallback UI */}
                {showOfflineFallback && !offlineMessageSent && (
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
              
              {/* Input Area */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400"
                    data-testid="chat-input"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim()}
                    className="p-2 rounded-full transition-all disabled:opacity-30 hover:scale-110"
                    style={{ background: chatInput.trim() ? currentBackground as string : 'transparent' }}
                    data-testid="send-message"
                  >
                    <Send className={`h-4 w-4 ${chatInput.trim() ? 'text-white' : 'text-slate-400'}`} />
                  </button>
                </div>
              </div>
              
              {/* Footer */}
              <div className="py-2 border-t border-slate-100 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-800/50">
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                  Powered by <img src={curbeLogo} alt="Curbe" className="h-2.5 w-auto inline-block opacity-60" />
                </p>
              </div>
            </div>
          ) : activeChannel ? (
            renderChannelContent()
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="p-5 text-white" style={{ background: currentBackground }}>
                {widget.branding?.customLogo && (
                  <div className="mb-3">
                    <img src={widget.branding.customLogo} alt="Logo" className="h-10 object-contain" />
                  </div>
                )}
                <h4 className="text-lg font-bold">{widget.welcomeTitle}</h4>
                <p className="text-sm opacity-90 mt-1">{widget.welcomeMessage}</p>
              </div>
              
              {/* Offline status banner */}
              {!scheduleStatus.isOnline && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
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
              )}
              
              <div className="p-4 space-y-3">
                {/* Back to chat card for returning visitors - Textmagic style */}
                {existingSession && !chatSessionId && !showPreChatForm && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: currentBackground }}
                        >
                          <MessageCircle className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {existingSession.displayName || 'Support Chat'}
                            </span>
                            {existingSession.lastMessageAt && (
                              <span className="text-xs text-slate-400">
                                {formatRelativeTime(existingSession.lastMessageAt)}
                              </span>
                            )}
                          </div>
                          {existingSession.lastMessage && (
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {existingSession.lastMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={resumeChat}
                      disabled={chatLoading}
                      className="w-full py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                      style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : '#3b82f6' }}
                      data-testid="back-to-chat-card"
                    >
                      <span className="text-sm font-semibold">Back to chat</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {widget.channels?.liveChat && !chatSessionId && !showPreChatForm && !existingSession && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {widget.liveChatSettings?.preChatForm?.title || "Chat with our agent"}
                    </h5>
                    <textarea 
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Type your message here"
                      rows={3}
                      className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      data-testid="initial-message-input"
                    />
                    <button 
                      onClick={() => setShowPreChatForm(true)}
                      className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2"
                      style={{ background: currentBackground }}
                      data-testid="start-chat-button"
                    >
                      {widget.liveChatSettings?.welcomeScreen?.buttonLabel || "Start chat"}
                    </button>
                  </div>
                )}
                
                {widget.channels?.liveChat && !chatSessionId && showPreChatForm && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {widget.liveChatSettings?.preChatForm?.title || "Chat with our agent"}
                    </h5>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 font-medium">
                          Name {widget.liveChatSettings?.preChatForm?.nameFieldRequired && <span className="text-red-500">*</span>}
                        </span>
                        <input 
                          type="text"
                          value={visitorName}
                          onChange={(e) => setVisitorName(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          data-testid="visitor-name-input"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 font-medium">
                          Email {widget.liveChatSettings?.preChatForm?.emailFieldRequired !== false && <span className="text-red-500">*</span>}
                        </span>
                        <input 
                          type="email"
                          value={visitorEmail}
                          onChange={(e) => setVisitorEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="w-full p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          data-testid="visitor-email-input"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={startChatSession}
                      disabled={chatLoading || (widget.liveChatSettings?.preChatForm?.emailFieldRequired !== false && !visitorEmail.trim())}
                      className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: currentBackground }}
                      data-testid="submit-prechat-button"
                    >
                      {chatLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {widget.liveChatSettings?.preChatForm?.buttonLabel || "Start chat"}
                    </button>
                    <button 
                      onClick={() => setShowPreChatForm(false)}
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Select another channel
                    </button>
                  </div>
                )}
                
                {!chatSessionId && !showPreChatForm && enabledChannels.filter((id: string) => id !== "liveChat").map((channelId: string) => {
                  const channel = channelIcons[channelId];
                  if (!channel) return null;
                  
                  // Get configured channel name from widget settings
                  let channelLabel = channel.label;
                  if (channelId === "sms") {
                    channelLabel = widget.smsSettings?.welcomeScreen?.channelName || "Text us";
                  } else if (channelId === "whatsapp") {
                    channelLabel = widget.whatsappSettings?.welcomeScreen?.channelName || "Chat on WhatsApp";
                  } else if (channelId === "email") {
                    channelLabel = widget.emailSettings?.welcomeScreen?.channelName || "Send an email";
                  }
                  
                  return (
                    <button
                      key={channelId}
                      onClick={() => setActiveChannel(channelId)}
                      className="w-full flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      data-testid={`channel-${channelId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div style={{ color: typeof currentBackground === 'string' && currentBackground.startsWith('#') ? currentBackground : currentColor.hex }}>
                          {channel.icon}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{channelLabel}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  );
                })}
              </div>
              
              <div className="p-2 border-t text-center">
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                  Powered by <a href="https://curbe.io" target="_blank" rel="noopener noreferrer"><img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" /></a>
                </p>
              </div>
            </div>
          )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
