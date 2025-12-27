import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { Loader2 } from "lucide-react";
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
        
        const buttonColor = data.widget?.branding?.primaryColor || 
                           data.widget?.branding?.gradientStart || 
                           "#2563eb";
        window.parent.postMessage({ type: "curbe-widget-config", buttonColor }, "*");
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleClose = useCallback(() => {
    window.parent.postMessage({ type: "curbe-widget-close" }, "*");
  }, []);

  const handleChannelClick = useCallback((channel: string) => {
    console.log("[ChatWidgetEmbed] Channel clicked:", channel);
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !widgetData) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <p className="text-red-500 text-sm">{error || "Widget not found"}</p>
      </div>
    );
  }

  const config = mapChatWidgetToConfig(widgetData.widget);

  return (
    <div className="h-full w-full bg-white" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <WidgetRenderer
        config={config}
        mode="embed"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={handleClose}
        onChannelClick={handleChannelClick}
      />
    </div>
  );
}
