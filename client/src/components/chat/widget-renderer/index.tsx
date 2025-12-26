import { useRef, useEffect, useState } from "react";
import { Search, Home, MessageSquare, HelpCircle, Newspaper, ChevronRight } from "lucide-react";
import type { WidgetConfig } from "@shared/widget-config";
import { WidgetHeader } from "./WidgetHeader";
import { WidgetChannelList } from "./WidgetChannelList";
import { applyWidgetTheme, getIconColor } from "./theme-utils";
import curbeLogo from "@assets/logo no fondo_1760457183587.png";

interface WidgetRendererProps {
  config: WidgetConfig;
  mode: "preview" | "embed";
  onClose?: () => void;
  onChannelClick?: (channel: string) => void;
}

interface HelpArticle {
  id: string;
  title: string;
  isNew?: boolean;
  isFeatureUpdate?: boolean;
}

const defaultArticles: HelpArticle[] = [
  { id: "1", title: "Getting Started Guide", isNew: true },
  { id: "2", title: "Frequently Asked Questions" },
  { id: "3", title: "How to contact support" },
  { id: "4", title: "Account settings and preferences", isFeatureUpdate: true },
];

export function WidgetRenderer({ config, mode, onClose, onChannelClick }: WidgetRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"home" | "messages" | "help" | "news">("home");
  const iconColor = getIconColor(config.theme);

  useEffect(() => {
    applyWidgetTheme(containerRef.current, config.theme);
  }, [config.theme]);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden shadow-lg bg-white flex flex-col"
      style={{ maxHeight: "600px" }}
      data-testid="widget-renderer"
      data-mode={mode}
    >
      {/* Header */}
      <div className="p-4">
        <WidgetHeader config={config} onClose={onClose} />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5">
        {/* Welcome Message */}
        <div className="mt-4 mb-6">
          <h3 className="font-bold text-slate-900 leading-tight" style={{ fontSize: "26px" }}>
            {config.welcomeTitle}
          </h3>
          <p className="font-bold text-slate-900 leading-tight" style={{ fontSize: "26px" }}>
            How can we help?
          </p>
        </div>

        {/* Primary Action - Send us a message */}
        {config.channels.liveChat && (
          <button
            className="w-full flex items-center justify-between py-4 px-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer mb-3"
            onClick={() => onChannelClick?.("liveChat")}
            data-testid="widget-channel-liveChat"
          >
            <span className="text-base font-medium text-slate-900">
              Send us a message
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        )}

        {/* Search Bar */}
        <div className="relative mb-4">
          <div className="flex items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
            <Search className="h-4 w-4 text-slate-400 mr-2" />
            <span className="text-sm text-slate-400">Search for help</span>
          </div>
        </div>

        {/* Help Articles */}
        <div className="space-y-1 mb-4">
          {defaultArticles.map((article) => (
            <button
              key={article.id}
              className="w-full flex items-center justify-between py-3 px-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
              data-testid={`widget-article-${article.id}`}
            >
              <span className="text-sm text-slate-700">{article.title}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          ))}
        </div>

        {/* Tags */}
        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full">
            New
          </span>
          <span className="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded-full">
            Feature update
          </span>
        </div>

        {/* Other Channels */}
        <WidgetChannelList config={config} onChannelClick={onChannelClick} hideLiveChat />

        {/* Footer Branding */}
        {config.branding.showBranding && (
          <div className="text-center py-4">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
              Powered by{" "}
              <a href="https://curbe.io" target="_blank" rel="noopener noreferrer">
                <img src={curbeLogo} alt="Curbe" className="h-3 w-auto inline-block" />
              </a>
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="border-t border-slate-100 bg-white">
        <div className="flex justify-around py-2">
          <button
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "home" ? "text-indigo-600" : "text-slate-400"}`}
            onClick={() => setActiveTab("home")}
            data-testid="widget-nav-home"
          >
            <Home className="h-5 w-5" style={activeTab === "home" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">Home</span>
          </button>
          <button
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "messages" ? "text-indigo-600" : "text-slate-400"}`}
            onClick={() => setActiveTab("messages")}
            data-testid="widget-nav-messages"
          >
            <MessageSquare className="h-5 w-5" style={activeTab === "messages" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">Messages</span>
          </button>
          <button
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "help" ? "text-indigo-600" : "text-slate-400"}`}
            onClick={() => setActiveTab("help")}
            data-testid="widget-nav-help"
          >
            <HelpCircle className="h-5 w-5" style={activeTab === "help" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">Help</span>
          </button>
          <button
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "news" ? "text-indigo-600" : "text-slate-400"}`}
            onClick={() => setActiveTab("news")}
            data-testid="widget-nav-news"
          >
            <Newspaper className="h-5 w-5" style={activeTab === "news" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">News</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { WidgetHeader } from "./WidgetHeader";
export { WidgetChannelList } from "./WidgetChannelList";
export { applyWidgetTheme, getHeaderStyle, getIconColor } from "./theme-utils";
