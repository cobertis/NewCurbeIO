import { useRef, useEffect } from "react";
import { Search, Home, MessageSquare, HelpCircle, Newspaper, ChevronRight, Send } from "lucide-react";
import type { WidgetConfig } from "@shared/widget-config";
import { WidgetHeader } from "./WidgetHeader";
import { WidgetChannelList } from "./WidgetChannelList";
import { applyWidgetTheme, getIconColor } from "./theme-utils";
import curbeLogo from "@assets/logo no fondo_1760457183587.png";

interface HelpArticle {
  id: string;
  title: string;
}

interface ExistingSession {
  sessionId: string;
  displayName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  status?: string | null;
}

interface WidgetRendererProps {
  config: WidgetConfig;
  mode: "preview" | "embed";
  activeTab?: "home" | "messages" | "help" | "news";
  onTabChange?: (tab: "home" | "messages" | "help" | "news") => void;
  onClose?: () => void;
  onChannelClick?: (channel: string) => void;
  onSearchClick?: () => void;
  onArticleClick?: (articleId: string) => void;
  existingSession?: ExistingSession | null;
  onResumeChat?: () => void;
  helpArticles?: HelpArticle[];
  isOffline?: boolean;
  nextAvailable?: string | null;
}

const defaultArticles: HelpArticle[] = [
  { id: "1", title: "Getting Started Guide" },
  { id: "2", title: "Frequently Asked Questions" },
  { id: "3", title: "How to contact support" },
  { id: "4", title: "Account settings and preferences" },
];

export function WidgetRenderer({ 
  config, 
  mode, 
  activeTab = "home",
  onTabChange,
  onClose, 
  onChannelClick,
  onSearchClick,
  onArticleClick,
  existingSession,
  onResumeChat,
  helpArticles = defaultArticles,
  isOffline = false,
  nextAvailable,
}: WidgetRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconColor = getIconColor(config.theme);

  useEffect(() => {
    applyWidgetTheme(containerRef.current, config.theme);
  }, [config.theme]);

  const handleTabChange = (tab: "home" | "messages" | "help" | "news") => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const renderHomeContent = () => (
    <>
      {/* Welcome Message */}
      <div className="mt-4 mb-6">
        <h3 className="font-bold text-slate-900 leading-tight" style={{ fontSize: "26px" }}>
          {config.welcomeTitle}
        </h3>
        <p className="font-bold text-slate-900 leading-tight" style={{ fontSize: "26px" }}>
          How can we help?
        </p>
      </div>

      {/* Offline Status Banner */}
      {isOffline && (
        <div className="bg-amber-50 rounded-lg px-4 py-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium text-amber-800">We're currently offline</span>
          </div>
          {nextAvailable && (
            <p className="text-xs text-amber-600 mt-1 ml-4">
              Back {nextAvailable}
            </p>
          )}
        </div>
      )}

      {/* Existing Session Card */}
      {existingSession && (
        <button
          onClick={onResumeChat}
          className="w-full flex items-center justify-between py-4 px-4 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer mb-3"
          data-testid="widget-resume-chat"
        >
          <div className="flex flex-col items-start">
            <span className="text-base font-medium text-slate-900">
              Back to your chat
            </span>
            {existingSession.lastMessage && (
              <span className="text-xs text-slate-500 truncate max-w-[200px]">
                {existingSession.lastMessage}
              </span>
            )}
          </div>
          <Send className="h-5 w-5" style={{ color: iconColor }} />
        </button>
      )}

      {/* Primary Action - Send us a message (only show if no existing session) */}
      {config.channels.liveChat && !existingSession && (
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
      <button 
        onClick={onSearchClick}
        className="w-full relative mb-4"
        data-testid="widget-search"
      >
        <div className="flex items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
          <Search className="h-4 w-4 text-slate-400 mr-2" />
          <span className="text-sm text-slate-400">Search for help</span>
        </div>
      </button>

      {/* Help Articles */}
      <div className="space-y-1 mb-4">
        {helpArticles.slice(0, 4).map((article) => (
          <button
            key={article.id}
            onClick={() => onArticleClick?.(article.id)}
            className="w-full flex items-center justify-between py-3 px-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
            data-testid={`widget-article-${article.id}`}
          >
            <span className="text-sm text-slate-700">{article.title}</span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>

      {/* Other Channels */}
      <WidgetChannelList config={config} onChannelClick={onChannelClick} hideLiveChat />
    </>
  );

  const renderMessagesContent = () => (
    <div className="flex-1 flex flex-col items-center justify-center py-10">
      {existingSession ? (
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4" style={{ color: iconColor }} />
          <h4 className="font-semibold text-slate-900 mb-2">Your conversation</h4>
          <p className="text-sm text-slate-500 mb-4">
            {existingSession.status === 'solved' ? 'This chat has been resolved' : 'Continue your chat'}
          </p>
          <button
            onClick={onResumeChat}
            className="px-6 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: iconColor }}
            data-testid="widget-open-messages"
          >
            Open chat
          </button>
        </div>
      ) : (
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <h4 className="font-semibold text-slate-900 mb-2">No messages yet</h4>
          <p className="text-sm text-slate-500 mb-4">
            Start a conversation with us
          </p>
          {config.channels.liveChat && (
            <button
              onClick={() => onChannelClick?.("liveChat")}
              className="px-6 py-2 rounded-lg text-white font-medium"
              style={{ backgroundColor: iconColor }}
              data-testid="widget-start-chat"
            >
              Send us a message
            </button>
          )}
        </div>
      )}
    </div>
  );

  const renderHelpContent = () => (
    <div className="py-4">
      <h4 className="font-semibold text-slate-900 mb-4">Help Articles</h4>
      
      {/* Search Bar */}
      <button 
        onClick={onSearchClick}
        className="w-full relative mb-4"
        data-testid="widget-help-search"
      >
        <div className="flex items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
          <Search className="h-4 w-4 text-slate-400 mr-2" />
          <span className="text-sm text-slate-400">Search for help</span>
        </div>
      </button>

      {/* All Help Articles */}
      <div className="space-y-1">
        {helpArticles.map((article) => (
          <button
            key={article.id}
            onClick={() => onArticleClick?.(article.id)}
            className="w-full flex items-center justify-between py-3 px-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
            data-testid={`widget-help-article-${article.id}`}
          >
            <span className="text-sm text-slate-700">{article.title}</span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderNewsContent = () => (
    <div className="flex-1 flex flex-col items-center justify-center py-10">
      <Newspaper className="h-12 w-12 mx-auto mb-4 text-slate-300" />
      <h4 className="font-semibold text-slate-900 mb-2">No news yet</h4>
      <p className="text-sm text-slate-500 text-center">
        Check back later for updates and announcements
      </p>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "messages":
        return renderMessagesContent();
      case "help":
        return renderHelpContent();
      case "news":
        return renderNewsContent();
      default:
        return renderHomeContent();
    }
  };

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden shadow-lg bg-white flex flex-col"
      data-testid="widget-renderer"
      data-mode={mode}
    >
      {/* Header */}
      <div className="p-4">
        <WidgetHeader config={config} onClose={onClose} />
      </div>

      {/* Content */}
      <div className="px-5">
        {renderContent()}

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
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "home" ? "text-slate-900" : "text-slate-400"}`}
            onClick={() => handleTabChange("home")}
            data-testid="widget-nav-home"
          >
            <Home className="h-5 w-5" style={activeTab === "home" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">Home</span>
          </button>
          <button
            className={`flex flex-col items-center px-4 py-2 relative ${activeTab === "messages" ? "text-slate-900" : "text-slate-400"}`}
            onClick={() => handleTabChange("messages")}
            data-testid="widget-nav-messages"
          >
            <MessageSquare className="h-5 w-5" style={activeTab === "messages" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">Messages</span>
            {existingSession && existingSession.status !== 'solved' && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "help" ? "text-slate-900" : "text-slate-400"}`}
            onClick={() => handleTabChange("help")}
            data-testid="widget-nav-help"
          >
            <HelpCircle className="h-5 w-5" style={activeTab === "help" ? { color: iconColor } : {}} />
            <span className="text-xs mt-1 font-medium">Help</span>
          </button>
          <button
            className={`flex flex-col items-center px-4 py-2 ${activeTab === "news" ? "text-slate-900" : "text-slate-400"}`}
            onClick={() => handleTabChange("news")}
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
