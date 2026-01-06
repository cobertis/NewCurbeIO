import { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { 
  User,
  UserMinus,
  CheckCircle2,
  Inbox,
  PanelLeftClose,
  PanelLeft,
  Plus,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MessengerSidebarContextType {
  sidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
}

const MessengerSidebarContext = createContext<MessengerSidebarContextType | null>(null);

export function useMessengerSidebar() {
  return useContext(MessengerSidebarContext);
}

export type MessengerView = 
  | "open" 
  | "assigned" 
  | "solved";

export type LifecycleStage = "new_lead" | "hot_lead" | "payment" | "customer";

interface MessengerLayoutProps {
  children: React.ReactNode;
  activeView: MessengerView;
  onViewChange: (view: MessengerView) => void;
  counts?: {
    open?: number;
    assigned?: number;
    solved?: number;
  };
  lifecycleCounts?: {
    new_lead?: number;
    hot_lead?: number;
    payment?: number;
    customer?: number;
  };
  activeLifecycle?: LifecycleStage | null;
  onLifecycleChange?: (lifecycle: LifecycleStage | null) => void;
}

const viewItems = [
  { id: "open" as const, label: "All", icon: Inbox },
  { id: "assigned" as const, label: "Assigned to me", icon: User },
  { id: "solved" as const, label: "Solved", icon: CheckCircle2 },
];

const lifecycleItems = [
  { id: "new_lead", label: "New Lead", emoji: "🆕" },
  { id: "hot_lead", label: "Hot Lead", emoji: "🔥" },
  { id: "payment", label: "Payment", emoji: "🤑" },
  { id: "customer", label: "Customer", emoji: "🤩" },
];

export function MessengerLayout({ 
  children, 
  activeView, 
  onViewChange,
  counts = {},
  lifecycleCounts = {},
  activeLifecycle = null,
  onLifecycleChange
}: MessengerLayoutProps) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [teamInboxOpen, setTeamInboxOpen] = useState(true);
  const [customInboxOpen, setCustomInboxOpen] = useState(true);

  const isViewActive = (id: MessengerView) => activeView === id;

  return (
    <MessengerSidebarContext.Provider value={{ sidebarHidden, setSidebarHidden }}>
      <div className="flex h-full bg-white dark:bg-gray-900 overflow-hidden" data-testid="messenger-layout">
        {!sidebarHidden && (
        <div className="w-56 border-r flex flex-col bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="h-[49px] px-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-base">Inbox</h2>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSidebarHidden(true)}
                    data-testid="btn-hide-sidebar"
                  >
                    <PanelLeftClose className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hide sidebar</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <nav className="px-2 space-y-0.5">
              {viewItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    onLifecycleChange?.(null);
                  }}
                  data-testid={`nav-${item.id}`}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                    isViewActive(item.id) && !activeLifecycle
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {counts[item.id as keyof typeof counts] !== undefined && counts[item.id as keyof typeof counts]! > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                      isViewActive(item.id) && !activeLifecycle
                        ? "bg-primary/20 text-primary" 
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    )}>
                      {counts[item.id as keyof typeof counts]}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Lifecycle Section */}
            <div className="mt-4 px-2">
              <div className="px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lifecycle</span>
              </div>
              <nav className="space-y-0.5">
                {lifecycleItems.map((item) => {
                  const count = lifecycleCounts[item.id as keyof typeof lifecycleCounts] || 0;
                  const isActive = activeLifecycle === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onLifecycleChange?.(isActive ? null : item.id as LifecycleStage)}
                      data-testid={`nav-lifecycle-${item.id}`}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <span className="text-base">{item.emoji}</span>
                      <span className="flex-1 text-left">{item.label}</span>
                      {count > 0 && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                          isActive 
                            ? "bg-primary/20 text-primary" 
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Team Inbox Section */}
            <div className="mt-4 px-2">
              <Collapsible open={teamInboxOpen} onOpenChange={setTeamInboxOpen}>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team Inbox</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" data-testid="btn-add-team-inbox">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5">
                        {teamInboxOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">No inboxes created</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Custom Inbox Section */}
            <div className="mt-2 px-2">
              <Collapsible open={customInboxOpen} onOpenChange={setCustomInboxOpen}>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Inbox</span>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" data-testid="btn-add-custom-inbox">
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5">
                        {customInboxOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="px-3 py-2">
                    <p className="text-xs text-muted-foreground">No inboxes created</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>
        )}
        <div className="flex-1 flex min-w-0">
          {children}
        </div>
      </div>
    </MessengerSidebarContext.Provider>
  );
}
