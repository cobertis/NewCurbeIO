import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  User,
  UserMinus,
  CheckCircle2,
  Inbox,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type MessengerView = 
  | "open" 
  | "assigned" 
  | "unassigned" 
  | "solved";

interface MessengerLayoutProps {
  children: React.ReactNode;
  activeView: MessengerView;
  onViewChange: (view: MessengerView) => void;
  counts?: {
    open?: number;
    assigned?: number;
    unassigned?: number;
    solved?: number;
  };
}

const viewItems = [
  { id: "open" as const, label: "Open", icon: Inbox },
  { id: "assigned" as const, label: "Assigned to me", icon: User },
  { id: "unassigned" as const, label: "Unassigned", icon: UserMinus },
  { id: "solved" as const, label: "Solved", icon: CheckCircle2 },
];

export function MessengerLayout({ 
  children, 
  activeView, 
  onViewChange,
  counts = {}
}: MessengerLayoutProps) {
  const [sidebarHidden, setSidebarHidden] = useState(false);

  const isViewActive = (id: MessengerView) => activeView === id;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white dark:bg-gray-900 rounded-lg border overflow-hidden" data-testid="messenger-layout">
      {sidebarHidden ? (
        <div className="w-10 border-r flex flex-col items-center py-2 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarHidden(false)}
                data-testid="btn-show-sidebar"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Show sidebar</TooltipContent>
          </Tooltip>
        </div>
      ) : (
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
                    <span className="text-xs text-muted-foreground">{counts[item.id as keyof typeof counts]}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
      <div className="flex-1 flex min-w-0">
        {children}
      </div>
    </div>
  );
}
