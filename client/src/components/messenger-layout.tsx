import { useState, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { 
  User,
  CheckCircle2,
  Inbox,
  PanelLeftClose,
  PanelLeft,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface CustomInbox {
  id: string;
  name: string;
  emoji: string;
  type: "team" | "custom";
  description?: string;
}

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
  activeCustomInbox?: string | null;
  onCustomInboxChange?: (inboxId: string | null) => void;
}

const viewItems = [
  { id: "open" as const, label: "All Open", icon: Inbox },
  { id: "assigned" as const, label: "Assigned to me", icon: User },
  { id: "solved" as const, label: "Solved", icon: CheckCircle2 },
];

const lifecycleItems = [
  { id: "new_lead", label: "New Lead", emoji: "🆕" },
  { id: "hot_lead", label: "Hot Lead", emoji: "🔥" },
  { id: "payment", label: "Payment", emoji: "🤑" },
  { id: "customer", label: "Customer", emoji: "🤩" },
];

const commonEmojis = ["📥", "📧", "💼", "🎯", "⭐", "🚀", "💡", "📌", "🔔", "📂", "🏷️", "✨"];

export function MessengerLayout({ 
  children, 
  activeView, 
  onViewChange,
  counts = {},
  lifecycleCounts = {},
  activeLifecycle = null,
  onLifecycleChange,
  activeCustomInbox = null,
  onCustomInboxChange
}: MessengerLayoutProps) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [teamInboxOpen, setTeamInboxOpen] = useState(true);
  const [customInboxOpen, setCustomInboxOpen] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"team" | "custom">("team");
  const [newInboxName, setNewInboxName] = useState("");
  const [newInboxEmoji, setNewInboxEmoji] = useState("📥");
  const { toast } = useToast();

  const isViewActive = (id: MessengerView) => activeView === id;

  // Fetch custom inboxes
  const { data: inboxes = [] } = useQuery<CustomInbox[]>({
    queryKey: ["/api/custom-inboxes"],
  });

  const teamInboxes = inboxes.filter(i => i.type === "team");
  const userInboxes = inboxes.filter(i => i.type === "custom");

  // Create inbox mutation
  const createInboxMutation = useMutation({
    mutationFn: async (data: { name: string; emoji: string; type: "team" | "custom" }) => {
      return apiRequest("POST", "/api/custom-inboxes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-inboxes"] });
      setCreateDialogOpen(false);
      setNewInboxName("");
      setNewInboxEmoji("📥");
      toast({ title: "Inbox created", description: "Your new inbox has been created successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create inbox", variant: "destructive" });
    },
  });

  // Delete inbox mutation
  const deleteInboxMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/custom-inboxes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-inboxes"] });
      toast({ title: "Inbox deleted" });
    },
    onError: (error: any) => {
      // Parse error message - may contain JSON or be a plain message
      let errorMessage = "Failed to delete inbox";
      try {
        if (error.message) {
          // Check if message contains JSON
          const jsonMatch = error.message.match(/\{.*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            errorMessage = parsed.message || errorMessage;
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error.message || errorMessage;
      }
      toast({ title: "Cannot Delete Inbox", description: errorMessage, variant: "destructive" });
    },
  });

  const handleCreateInbox = () => {
    if (!newInboxName.trim()) {
      toast({ title: "Error", description: "Please enter a name for the inbox", variant: "destructive" });
      return;
    }
    createInboxMutation.mutate({
      name: newInboxName.trim(),
      emoji: newInboxEmoji,
      type: createType,
    });
  };

  const openCreateDialog = (type: "team" | "custom") => {
    setCreateType(type);
    setNewInboxName("");
    setNewInboxEmoji("📥");
    setCreateDialogOpen(true);
  };

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
                    onCustomInboxChange?.(null);
                  }}
                  data-testid={`nav-${item.id}`}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                    isViewActive(item.id) && !activeLifecycle && !activeCustomInbox
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {counts[item.id as keyof typeof counts] !== undefined && counts[item.id as keyof typeof counts]! > 0 && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                      isViewActive(item.id) && !activeLifecycle && !activeCustomInbox
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
                  const isActive = activeLifecycle === item.id && !activeCustomInbox;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onLifecycleChange?.(isActive ? null : item.id as LifecycleStage);
                        onCustomInboxChange?.(null);
                      }}
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5" 
                      onClick={() => openCreateDialog("team")}
                      data-testid="btn-add-team-inbox"
                    >
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
                  <nav className="space-y-0.5">
                    {teamInboxes.length === 0 ? (
                      <div className="px-3 py-2">
                        <p className="text-xs text-muted-foreground">No inboxes created</p>
                      </div>
                    ) : (
                      teamInboxes.map((inbox) => (
                        <button
                          key={inbox.id}
                          onClick={() => {
                            if (activeCustomInbox === inbox.id) {
                              onCustomInboxChange?.(null);
                            } else {
                              onCustomInboxChange?.(inbox.id);
                              onLifecycleChange?.(null);
                            }
                          }}
                          className={cn(
                            "group w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer",
                            activeCustomInbox === inbox.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                          data-testid={`inbox-${inbox.id}`}
                        >
                          <span className="text-base">{inbox.emoji}</span>
                          <span className="flex-1 text-left truncate">{inbox.name}</span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteInboxMutation.mutate(inbox.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`delete-inbox-${inbox.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </span>
                        </button>
                      ))
                    )}
                  </nav>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Custom Inbox Section */}
            <div className="mt-2 px-2">
              <Collapsible open={customInboxOpen} onOpenChange={setCustomInboxOpen}>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom Inbox</span>
                  <div className="flex items-center gap-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5" 
                      onClick={() => openCreateDialog("custom")}
                      data-testid="btn-add-custom-inbox"
                    >
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
                  <nav className="space-y-0.5">
                    {userInboxes.length === 0 ? (
                      <div className="px-3 py-2">
                        <p className="text-xs text-muted-foreground">No inboxes created</p>
                      </div>
                    ) : (
                      userInboxes.map((inbox) => (
                        <button
                          key={inbox.id}
                          onClick={() => {
                            if (activeCustomInbox === inbox.id) {
                              onCustomInboxChange?.(null);
                            } else {
                              onCustomInboxChange?.(inbox.id);
                              onLifecycleChange?.(null);
                            }
                          }}
                          className={cn(
                            "group w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer",
                            activeCustomInbox === inbox.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                          data-testid={`inbox-${inbox.id}`}
                        >
                          <span className="text-base">{inbox.emoji}</span>
                          <span className="flex-1 text-left truncate">{inbox.name}</span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteInboxMutation.mutate(inbox.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`delete-inbox-${inbox.id}`}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </span>
                        </button>
                      ))
                    )}
                  </nav>
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

      {/* Create Inbox Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Create {createType === "team" ? "Team" : "Custom"} Inbox
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewInboxEmoji(emoji)}
                    className={cn(
                      "w-9 h-9 text-lg rounded-md border flex items-center justify-center transition-colors",
                      newInboxEmoji === emoji 
                        ? "border-primary bg-primary/10" 
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                    )}
                    data-testid={`emoji-${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbox-name">Name</Label>
              <Input
                id="inbox-name"
                placeholder="Enter inbox name..."
                value={newInboxName}
                onChange={(e) => setNewInboxName(e.target.value)}
                data-testid="input-inbox-name"
              />
            </div>
            {createType === "team" && (
              <p className="text-xs text-muted-foreground">
                Team inboxes are visible to all users in your company.
              </p>
            )}
            {createType === "custom" && (
              <p className="text-xs text-muted-foreground">
                Custom inboxes are private and only visible to you.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="btn-cancel-inbox">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInbox} 
              disabled={createInboxMutation.isPending}
              data-testid="btn-create-inbox"
            >
              {createInboxMutation.isPending ? "Creating..." : "Create Inbox"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MessengerSidebarContext.Provider>
  );
}

export function ExpandSidebarButton() {
  const context = useMessengerSidebar();
  if (!context || !context.sidebarHidden) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => context.setSidebarHidden(false)}
          data-testid="btn-expand-sidebar"
        >
          <PanelLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Show sidebar</TooltipContent>
    </Tooltip>
  );
}
