import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Inbox, 
  Mail, 
  UserCheck, 
  UserX, 
  Clock, 
  Users, 
  CheckCircle, 
  LayoutGrid 
} from "lucide-react";

export type MessengerView = 
  | "open" 
  | "unread" 
  | "assigned" 
  | "unassigned" 
  | "waiting" 
  | "visitors" 
  | "solved" 
  | "all";

interface MessengerLayoutProps {
  activeView: MessengerView;
  onViewChange: (view: MessengerView) => void;
  counts: {
    open: number;
    unread: number;
    assigned: number;
    unassigned: number;
    waiting: number;
    visitors: number;
    solved: number;
    all: number;
  };
  children: React.ReactNode;
}

const viewConfig: { key: MessengerView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "open", label: "Open", icon: Inbox },
  { key: "unread", label: "Unread", icon: Mail },
  { key: "assigned", label: "Mine", icon: UserCheck },
  { key: "unassigned", label: "Unassigned", icon: UserX },
  { key: "waiting", label: "Waiting", icon: Clock },
  { key: "visitors", label: "Visitors", icon: Users },
  { key: "solved", label: "Solved", icon: CheckCircle },
  { key: "all", label: "All", icon: LayoutGrid },
];

export function MessengerLayout({ 
  activeView, 
  onViewChange, 
  counts, 
  children 
}: MessengerLayoutProps) {
  return (
    <div className="flex h-full" data-testid="messenger-layout">
      <aside className="w-14 border-r bg-muted/30 flex flex-col py-2">
        {viewConfig.map(({ key, label, icon: Icon }) => {
          const count = counts[key];
          const isActive = activeView === key;
          
          return (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              className={cn(
                "flex flex-col items-center gap-0.5 h-auto py-2 px-1 rounded-none relative",
                isActive && "bg-accent text-accent-foreground"
              )}
              onClick={() => onViewChange(key)}
              data-testid={`btn-view-${key}`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium">{label}</span>
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px]"
                >
                  {count > 99 ? "99+" : count}
                </Badge>
              )}
            </Button>
          );
        })}
      </aside>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
