import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { MessageCircle, Loader2 } from "lucide-react";
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

export default function ChatWidgetEmbed() {
  const { id } = useParams<{ id: string }>();
  const [widgetData, setWidgetData] = useState<WidgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "messages" | "help" | "news">("home");

  useEffect(() => {
    if (!id) return;
    
    fetch(`/api/public/chat-widget/${id}`)
      .then(res => {
        if (!res.ok) throw new Error("Widget not found");
        return res.json();
      })
      .then(data => {
        setWidgetData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleChannelClick = useCallback((channel: string) => {
    console.log("[ChatWidgetEmbed] Channel clicked:", channel);
  }, []);

  if (loading) {
    return (
      <div className="fixed bottom-5 right-5 w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    );
  }

  if (error || !widgetData) {
    return null;
  }

  const config = mapChatWidgetToConfig(widgetData.widget);
  const branding = widgetData.widget.branding as { primaryColor?: string; gradientStart?: string; gradientEnd?: string } | null;
  const buttonColor = branding?.primaryColor || branding?.gradientStart || "#2563eb";
  const buttonGradient = branding?.gradientStart && branding?.gradientEnd
    ? `linear-gradient(135deg, ${branding.gradientStart}, ${branding.gradientEnd})`
    : buttonColor;

  return (
    <div 
      className="fixed bottom-0 right-0 z-[2147483647]" 
      style={{ 
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        pointerEvents: "none"
      }}
    >
      {isOpen ? (
        <div 
          className="absolute bottom-5 right-5"
          style={{ 
            width: "380px", 
            maxWidth: "calc(100vw - 40px)",
            pointerEvents: "auto"
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: "min(580px, calc(100vh - 100px))" }}
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
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
          style={{ 
            background: buttonGradient,
            pointerEvents: "auto"
          }}
          data-testid="button-open-widget"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
