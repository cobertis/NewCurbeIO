import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  User,
  UserMinus,
  CheckCircle2,
  Inbox,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [, setLocation] = useLocation();

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
                  <span className="text-xs text-muted-foreground">{counts[item.id as keyof typeof counts]}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 flex min-w-0">
        {children}
      </div>
    </div>
  );
}
