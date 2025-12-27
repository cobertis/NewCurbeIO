import { useState } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  MessageSquare,
  User,
  UserMinus,
  Clock,
  CheckCircle2,
  Inbox,
  Settings,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { Button } from "@/components/ui/button";

export type MessengerView = 
  | "open" 
  | "assigned" 
  | "unassigned" 
  | "waiting" 
  | "visitors"
  | "solved" 
  | "sms"
  | "live-chat"
  | "whatsapp"
  | "facebook"
  | "instagram";

interface MessengerLayoutProps {
  children: React.ReactNode;
  activeView: MessengerView;
  onViewChange: (view: MessengerView) => void;
  counts?: {
    open?: number;
    assigned?: number;
    unassigned?: number;
    waiting?: number;
    visitors?: number;
    solved?: number;
  };
}

const viewItems = [
  { id: "open" as const, label: "Open", icon: Inbox },
  { id: "assigned" as const, label: "Assigned to me", icon: User },
  { id: "unassigned" as const, label: "Unassigned", icon: UserMinus },
  { id: "waiting" as const, label: "Waiting live chats", icon: Clock },
  { id: "visitors" as const, label: "Live visitors", icon: Eye },
  { id: "solved" as const, label: "Solved", icon: CheckCircle2 },
];

const channelItems = [
  { id: "sms" as const, label: "SMS", icon: MessageSquare, hasPlus: false },
  { id: "live-chat" as const, label: "Live chat", icon: MessageSquare, hasPlus: false },
  { id: "whatsapp" as const, label: "WhatsApp", icon: SiWhatsapp, hasPlus: true },
  { id: "facebook" as const, label: "Facebook", icon: SiFacebook, hasPlus: true },
  { id: "instagram" as const, label: "Instagram", icon: SiInstagram, hasPlus: true },
];

export function MessengerLayout({ 
  children, 
  activeView, 
  onViewChange,
  counts = {}
}: MessengerLayoutProps) {
  const [, setLocation] = useLocation();
  const [savedViewsOpen, setSavedViewsOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);

  const isViewActive = (id: MessengerView) => activeView === id;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-lg border overflow-hidden" data-testid="messenger-layout">
      <div className="w-56 border-r flex flex-col bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
        <div className="h-[49px] px-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-base">Messenger</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setLocation("/settings/integrations")}
            data-testid="btn-messenger-settings"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <nav className="px-2 space-y-0.5">
            {viewItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                data-testid={`nav-${item.id}`}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                  isViewActive(item.id)
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {counts[item.id as keyof typeof counts] !== undefined && counts[item.id as keyof typeof counts]! > 0 && (
                  item.id === "waiting" ? (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold bg-red-500 text-white rounded-full px-1">
                      {counts[item.id as keyof typeof counts]}
                    </span>
                  ) : item.id === "visitors" ? (
                    <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold bg-green-500 text-white rounded-full px-1">
                      {counts[item.id as keyof typeof counts]}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{counts[item.id as keyof typeof counts]}</span>
                  )
                )}
              </button>
            ))}
          </nav>

          <div className="mt-4 px-2">
            <button
              onClick={() => setSavedViewsOpen(!savedViewsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              data-testid="toggle-saved-views"
            >
              <span>Saved Views</span>
              {savedViewsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {savedViewsOpen && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                data-testid="btn-new-filtered-view"
              >
                <Plus className="h-4 w-4" />
                <span>New filtered view</span>
              </button>
            )}
          </div>

          <div className="mt-4 px-2">
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              data-testid="toggle-channels"
            >
              <span>Channels</span>
              {channelsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {channelsOpen && (
              <nav className="space-y-0.5">
                {channelItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    data-testid={`nav-channel-${item.id}`}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                      isViewActive(item.id)
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.hasPlus && (
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-w-0">
        {children}
      </div>
    </div>
  );
}
