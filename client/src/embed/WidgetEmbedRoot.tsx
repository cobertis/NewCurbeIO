import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Loader2 } from "lucide-react";
import { WidgetRenderer } from "@/components/chat/widget-renderer";
import { mapChatWidgetToConfig } from "@shared/widget-config";
import type { ChatWidget } from "@shared/schema";

interface WidgetResponse {
  widget: ChatWidget;
  company: {
    name: string;
    logo?: string;
  };
  agents?: Array<{
    id: string;
    fullName: string;
    avatar?: string | null;
  }>;
}

interface WidgetEmbedRootProps {
  widgetId: string;
}

export function WidgetEmbedRoot({ widgetId }: WidgetEmbedRootProps) {
  const [widgetData, setWidgetData] = useState<WidgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "messages" | "help" | "news">("home");
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 480);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch widget data
  useEffect(() => {
    if (!widgetId) return;

    fetch(`/api/public/chat-widget/${widgetId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Widget not found");
        return res.json();
      })
      .then((data) => {
        setWidgetData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [widgetId]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleChannelClick = useCallback((channel: string) => {
    console.log("[WidgetEmbed] Channel clicked:", channel);
  }, []);

  if (loading) {
    return (
      <button
        className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg"
        style={{ background: "#2563eb" }}
        disabled
      >
        <Loader2 className="h-6 w-6 animate-spin" />
      </button>
    );
  }

  if (error || !widgetData) {
    return null;
  }

  const config = mapChatWidgetToConfig(widgetData.widget);
  const branding = widgetData.widget.branding as {
    primaryColor?: string;
    gradientStart?: string;
    gradientEnd?: string;
  } | null;
  const buttonColor = branding?.primaryColor || branding?.gradientStart || "#2563eb";
  const buttonGradient =
    branding?.gradientStart && branding?.gradientEnd
      ? `linear-gradient(135deg, ${branding.gradientStart}, ${branding.gradientEnd})`
      : buttonColor;

  // Panel styles based on mobile/desktop
  const panelStyles = isMobile
    ? {
        position: "fixed" as const,
        inset: 0,
        width: "100%",
        height: "100%",
        borderRadius: 0,
        zIndex: 2147483647,
      }
    : {
        position: "absolute" as const,
        right: 0,
        bottom: "72px",
        width: "380px",
        maxWidth: "calc(100vw - 48px)",
        height: "560px",
        maxHeight: "calc(100vh - 140px)",
        borderRadius: "16px",
        zIndex: 2147483647,
      };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: 2147483646 }}
          onClick={handleClose}
        />
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="bg-white shadow-2xl overflow-hidden flex flex-col"
          style={panelStyles}
        >
          <WidgetRenderer
            config={config}
            mode="embed"
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={handleClose}
            onChannelClick={handleChannelClick}
          />
        </div>
      )}

      {/* Launcher Button - hidden when panel is open on mobile */}
      {!(isOpen && isMobile) && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
          style={{ background: buttonGradient }}
          data-testid="button-widget-launcher"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </button>
      )}
    </>
  );
}
