import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { WidgetRenderer } from "@/components/chat/widget-renderer";
import { mapChatWidgetToConfig } from "@shared/widget-config";
import type { ChatWidget } from "@shared/schema";

declare global {
  interface Window {
    __CURBE_WIDGET_MODE?: string;
  }
}

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

/**
 * WidgetEmbedRoot - Panel mode only
 * This component is loaded inside an iframe when the user clicks the launcher button.
 * It renders the widget content directly without a launcher button.
 * The launcher is handled by widget-script.js on the parent page.
 */
export function WidgetEmbedRoot({ widgetId }: WidgetEmbedRootProps) {
  const [widgetData, setWidgetData] = useState<WidgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "messages" | "help" | "news">("home");

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

  // Handle close - notify parent frame to close the panel
  const handleClose = useCallback(() => {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "curbe-widget-close" }, "*");
    }
  }, []);

  const handleChannelClick = useCallback((channel: string) => {
    console.log("[WidgetEmbed] Channel clicked:", channel);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !widgetData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white text-gray-500">
        <p>Unable to load chat</p>
      </div>
    );
  }

  const config = mapChatWidgetToConfig(widgetData.widget);

  // Panel mode - render content directly, full size within iframe
  return (
    <div className="w-full h-full bg-white overflow-hidden flex flex-col">
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
