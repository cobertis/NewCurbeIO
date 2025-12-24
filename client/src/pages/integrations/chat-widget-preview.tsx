import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Mail, ExternalLink, MessageSquare, MessageCircle, Phone, Loader2, ChevronLeft, ChevronRight, X, Monitor, Send, Smartphone, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";
import QRCode from "qrcode";
import curbeLogo from "@assets/logo no fondo_1760457183587.png";

const colorOptions = [
  { value: "blue", bg: "bg-blue-500", hex: "#3B82F6", gradient: "linear-gradient(135deg, #3B82F6, #1D4ED8)" },
  { value: "green", bg: "bg-green-500", hex: "#22C55E", gradient: "linear-gradient(135deg, #22C55E, #16A34A)" },
  { value: "purple", bg: "bg-purple-500", hex: "#A855F7", gradient: "linear-gradient(135deg, #A855F7, #7C3AED)" },
  { value: "red", bg: "bg-red-500", hex: "#EF4444", gradient: "linear-gradient(135deg, #EF4444, #DC2626)" },
  { value: "orange", bg: "bg-orange-500", hex: "#F97316", gradient: "linear-gradient(135deg, #F97316, #EA580C)" },
  { value: "teal", bg: "bg-teal-500", hex: "#14B8A6", gradient: "linear-gradient(135deg, #14B8A6, #0D9488)" },
  { value: "pink", bg: "bg-pink-500", hex: "#EC4899", gradient: "linear-gradient(135deg, #EC4899, #DB2777)" },
  { value: "indigo", bg: "bg-indigo-500", hex: "#6366F1", gradient: "linear-gradient(135deg, #6366F1, #4F46E5)" },
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

  // Live chat state
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatVisitorId, setChatVisitorId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; text: string; direction: string; createdAt: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');

  const { data: widgetData, isLoading } = useQuery<{ widget: any }>({
    queryKey: [`/api/integrations/chat-widget/${widgetId}`],
    enabled: !!widgetId,
  });

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


  // Resume existing chat session for returning visitors
  useEffect(() => {
    if (!widgetId || !widgetOpen) return;
    
    const storedVisitorId = localStorage.getItem(`chat_visitor_${widgetId}`);
    if (!storedVisitorId || chatSessionId) return;
    
    const resumeSession = async () => {
      try {
        // Try to resume existing session
        const sessionRes = await fetch('/api/public/live-chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widgetId,
            visitorId: storedVisitorId,
          }),
        });
        
        if (!sessionRes.ok) return;
        
        const { sessionId, visitorId } = await sessionRes.json();
        
        // Fetch existing messages
        const msgRes = await fetch(`/api/public/live-chat/messages/${sessionId}`);
        if (msgRes.ok) {
          const { messages } = await msgRes.json();
          if (messages.length > 0) {
            // Has existing messages - resume the session
            setChatSessionId(sessionId);
            setChatVisitorId(visitorId);
            setChatMessages(messages);
          }
        }
      } catch (error) {
        console.error('Failed to resume session:', error);
      }
    };
    
    resumeSession();
  }, [widgetId, widgetOpen, chatSessionId]);
  // Live chat functions
  const startChatSession = async () => {
    if (!widgetId || !initialMessage.trim()) return;
    
    setChatLoading(true);
    try {
      // Get or create visitor ID from localStorage
      let storedVisitorId = localStorage.getItem(`chat_visitor_${widgetId}`);
      if (!storedVisitorId) {
        storedVisitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(`chat_visitor_${widgetId}`, storedVisitorId);
      }
      
      // Create or resume session
      const sessionRes = await fetch('/api/public/live-chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId,
          visitorId: storedVisitorId,
          visitorName: visitorName || 'Website Visitor',
        }),
      });
      
      if (!sessionRes.ok) throw new Error('Failed to create session');
      
      const { sessionId, visitorId } = await sessionRes.json();
      
      // Send initial message FIRST before activating chat view
      const msgRes = await fetch('/api/public/live-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text: initialMessage.trim(),
          visitorName: visitorName || 'Website Visitor',
        }),
      });
      
      if (!msgRes.ok) throw new Error('Failed to send message');
      
      const { message } = await msgRes.json();
      // Only activate chat AFTER message is successfully sent
      setChatSessionId(sessionId);
      setChatVisitorId(visitorId);
      setChatMessages([message]);
      setInitialMessage('');
    } catch (error) {
      console.error('Failed to start chat:', error);
      toast({ title: "Error", description: "Failed to start chat session", variant: "destructive" });
    } finally {
      setChatLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatSessionId || !chatInput.trim()) return;
    
    const text = chatInput.trim();
    setChatInput('');
    
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
          const { messages } = await res.json();
          if (messages.length > 0) {
            setChatMessages(prev => {
              const newIds = new Set(messages.map((m: any) => m.id));
              const filtered = prev.filter(m => !newIds.has(m.id));
              return [...filtered, ...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    };
    
    pollMessages();
    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [chatSessionId, chatMessages.length]);

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
    ...widgetData?.widget,
    channels: { ...defaultWidget.channels, ...widgetData?.widget?.channels },
    channelOrder: widgetData?.widget?.channelOrder || defaultWidget.channelOrder,
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

        {/* Targeting status banner */}
        {getTargetingBanner()}
        
        {/* Schedule status banner */}
        {getScheduleBanner()}
        
        {/* Device type status banner */}
        {getDeviceTypeBanner()}
        
        {/* Widget hidden message */}
        {shouldDisplay === false && (
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
        {!widgetOpen && widget.minimizedState?.eyeCatcherEnabled && widget.minimizedState?.eyeCatcherMessage && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">{widget.minimizedState.eyeCatcherMessage}</span>
            <button className="text-slate-400 hover:text-slate-600">×</button>
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
          {activeChannel ? (
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
                {widget.channels?.liveChat && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
                    {chatSessionId ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {widget.liveChatSettings?.preChatForm?.title || "Chat with our agent"}
                          </h5>
                          <button 
                            onClick={() => { setChatSessionId(null); setChatMessages([]); }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                            data-testid="close-chat"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="h-48 overflow-y-auto space-y-2 border rounded-lg p-2 bg-slate-50 dark:bg-slate-700">
                          {chatMessages.map((msg) => (
                            <div 
                              key={msg.id}
                              className={`p-2 rounded-lg text-sm max-w-[85%] ${
                                msg.direction === 'inbound' 
                                  ? 'bg-slate-200 dark:bg-slate-600 ml-auto' 
                                  : 'text-white'
                              }`}
                              style={msg.direction !== 'inbound' ? { background: currentBackground } : {}}
                            >
                              {msg.text}
                            </div>
                          ))}
                          {chatMessages.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4">No messages yet</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder="Type a message..."
                            className="flex-1 p-2 border rounded-lg text-sm bg-white dark:bg-slate-600"
                            data-testid="chat-input"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={!chatInput.trim()}
                            className="p-2 rounded-lg text-white disabled:opacity-50"
                            style={{ background: currentBackground }}
                            data-testid="send-message"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {widget.liveChatSettings?.preChatForm?.title || "Chat with our agent"}
                        </h5>
                        {widget.liveChatSettings?.preChatForm?.collectName && (
                          <div className="space-y-1">
                            <span className="text-xs text-slate-500 font-medium">Your name</span>
                            <input 
                              type="text"
                              value={visitorName}
                              onChange={(e) => setVisitorName(e.target.value)}
                              placeholder="Enter your name"
                              className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-700"
                              data-testid="visitor-name-input"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500 font-medium">
                            {widget.liveChatSettings?.welcomeScreen?.fieldLabel || "Message"}
                          </span>
                          <textarea 
                            value={initialMessage}
                            onChange={(e) => setInitialMessage(e.target.value)}
                            placeholder="Type your message here" 
                            className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-slate-700 resize-none" 
                            rows={3}
                            data-testid="initial-message-input"
                          />
                        </div>
                        <button 
                          onClick={startChatSession}
                          disabled={chatLoading || !initialMessage.trim()}
                          className="w-full py-2 px-4 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                          style={{ background: currentBackground }}
                          data-testid="start-chat-button"
                        >
                          {chatLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                          {widget.liveChatSettings?.welcomeScreen?.buttonLabel || "Start chat"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                
                {enabledChannels.filter((id: string) => id !== "liveChat").map((channelId: string) => {
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
                  Powered by <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
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
