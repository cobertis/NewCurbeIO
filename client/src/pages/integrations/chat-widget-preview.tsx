import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Copy, Mail, ExternalLink, MessageSquare, Phone, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
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

  const { data: widgetData, isLoading } = useQuery<{ widget: any }>({
    queryKey: [`/api/integrations/chat-widget/${widgetId}`],
    enabled: !!widgetId,
  });

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
    },
    channelOrder: ["liveChat", "email", "sms", "phone", "whatsapp", "facebook", "instagram"],
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

  const widget = { ...defaultWidget, ...widgetData?.widget };
  
  const currentColor = colorOptions.find(c => c.value === widget.colorTheme) || colorOptions[0];
  const currentBackground = widget.themeType === "solid" 
    ? (widget.customColor || currentColor.hex)
    : currentColor.gradient;

  const embedCode = `<script src="https://widgets.curbe.io/messenger-widget-script.js" data-code="${widgetId}" defer=""></script>`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Embed code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const enabledChannels = (widget.channelOrder || []).filter(
    (ch: string) => widget.channels?.[ch as keyof typeof widget.channels]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

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
                {activeChannel === "whatsapp" ? "Scan QR code to open a chat" : activeChannel === "phone" ? "Scan QR code to call" : "Scan QR code to send a text"}
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

      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2">
        {!widgetOpen && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Hello, how can we help?</span>
            <button className="text-slate-400 hover:text-slate-600">×</button>
          </div>
        )}
        
        <div className="relative">
          <button
            onClick={() => { setWidgetOpen(!widgetOpen); setActiveChannel(null); }}
            className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
            style={{ background: currentBackground }}
            data-testid="button-widget-toggle"
          >
            {widgetOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <MessageSquare className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {widgetOpen && (
        <div className="fixed bottom-24 right-6 w-80">
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
              
              <div className="p-4 space-y-3">
                {widget.channels?.liveChat && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 space-y-3">
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {widget.liveChatSettings?.preChatForm?.title || "Chat with our agent"}
                    </h5>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-500 font-medium">
                        {widget.liveChatSettings?.welcomeScreen?.fieldLabel || "Message"}
                      </span>
                      <textarea 
                        placeholder="Type your message here" 
                        disabled 
                        className="w-full p-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-700 resize-none" 
                        rows={3} 
                      />
                    </div>
                    <button 
                      className="w-full py-2 px-4 rounded-lg text-white text-sm font-medium"
                      style={{ background: currentBackground }}
                    >
                      {widget.liveChatSettings?.welcomeScreen?.buttonLabel || "Start chat"}
                    </button>
                  </div>
                )}
                
                {enabledChannels.filter(id => id !== "liveChat").map((channelId: string) => {
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
  );
}
