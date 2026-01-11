import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Play, Pause, StopCircle, RefreshCw, Users, Clock, ChevronRight, AlertCircle, CheckCircle, XCircle, Mail, MessageSquare, Phone, Sliders, RotateCcw, Calendar, ListTodo, Zap, Activity, AlertTriangle, Plus, Eye, Target, UserCheck, Ban, Layers, ArrowLeft, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignStats {
  total: number;
  new: number;
  attempting: number;
  engaged: number;
  stopped: number;
  dnc: number;
  unreachable: number;
}

interface OrchestratorCampaign {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  stats: CampaignStats;
}

interface SystemRunInfo {
  completedAt: string | null;
  status: string;
  startedAt: string;
}

interface SystemRunError {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  payload: any;
  createdAt: string;
}

interface CampaignContact {
  id: string;
  contactId: string;
  state: string;
  nextActionAt: string | null;
  fatigueScore: number | null;
  attemptsTotal: number | null;
  stoppedReason: string | null;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
}

interface TimelineItem {
  id: string;
  type: "event" | "job";
  eventType?: string;
  status?: string;
  channel: string | null;
  provider?: string;
  payload?: any;
  runAt?: string;
  retryCount?: number;
  maxRetries?: number;
  lastError?: string;
  createdAt: string;
}

interface VariantVoiceMetrics {
  callPlaced: number;
  callAnswered: number;
  callNoAnswer: number;
  callBusy: number;
  callFailed: number;
  voicemailDropped: number;
  answerRate: number;
}

interface VoiceMetrics {
  callPlaced: number;
  callAnswered: number;
  callNoAnswer: number;
  callBusy: number;
  callFailed: number;
  voicemailDropped: number;
  rates: {
    answerRate: number;
    noAnswerRate: number;
    busyRate: number;
    callFailureRate: number;
  };
}

interface VariantMetrics {
  attempts: number;
  delivered: number;
  replied: number;
  optOut: number;
  failedFinal: number;
  rates: {
    deliveryRate: number;
    replyRate: number;
    optOutRate: number;
    failureRateFinal: number;
  };
  avgTimeToReplySeconds: number | null;
  voice?: VariantVoiceMetrics;
}

interface CampaignMetrics {
  campaignId: string;
  window: string;
  totals: {
    contactsEnrolled: number;
    activeContacts: number;
    stoppedContacts: number;
    engagedContacts: number;
    unreachableContacts: number;
  };
  attempts: number;
  delivered: number;
  read: number;
  failed: number;
  failedFinal: number;
  replied: number;
  optOut: number;
  rates: {
    deliveryRate: number;
    replyRate: number;
    optOutRate: number;
    failureRate: number;
    failureRateFinal: number;
  };
  avgTimeToReplySeconds: number | null;
  voice: VoiceMetrics;
  breakdownByChannel: Record<string, {
    attempts: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    failedFinal: number;
    optOut: number;
    callPlaced?: number;
    callAnswered?: number;
    callNoAnswer?: number;
    callBusy?: number;
    callFailed?: number;
    voicemailDropped?: number;
    answerRate?: number;
  }>;
  metricsByVariant: Record<string, VariantMetrics>;
}

interface JobMetrics {
  campaignId: string;
  queuedCount: number;
  processingCount: number;
  failedCount: number;
  doneCount: number;
  avgRetryCount: number;
  oldestQueuedAgeSec: number | null;
}

interface AutoTuneRecommendation {
  id: string;
  computedAt: string;
  window: string;
  allocationsJson: Record<string, number>;
  metricsSnapshotJson: Array<{
    variant: string;
    attempts: number;
    replies: number;
    optOuts: number;
    failedFinal: number;
    cost: number;
    reward: number;
    rewardRate: number;
  }>;
  objective: string;
  epsilon: number | null;
  coverageWarnings: Array<{ variant: string; message: string }>;
}

interface LastApply {
  id: string;
  payload: {
    oldAllocation: Record<string, number>;
    newAllocation: Record<string, number>;
    mode: string;
  };
  createdAt: string;
}

interface OrchestratorTaskItem {
  task: {
    id: string;
    type: string;
    status: string;
    dueAt: string | null;
    completedAt: string | null;
    sourceIntent: string | null;
    payload: any;
  };
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  campaignContact: {
    id: string;
    state: string;
  };
}

interface SystemHealth {
  jobsQueued: number;
  jobsProcessing: number;
  jobsFailed: number;
  stuckProcessingVoice: number;
  serverTime: string;
  recentAuditErrors?: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
  lastRuns?: Record<string, SystemRunInfo>;
  lastErrors?: SystemRunError[];
}

interface RunOnceSummary {
  processed: number;
  enqueued: number;
  timeouts: number;
  skipped: number;
  errors: string[];
}

interface RunJobsSummary {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skipped: number;
  errors: string[];
}

export default function OrchestratorCampaigns() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<OrchestratorCampaign | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<CampaignContact | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [metricsWindow, setMetricsWindow] = useState<string>("7d");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("open");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFormName, setCreateFormName] = useState("");
  const [createFormStatus, setCreateFormStatus] = useState("draft");
  const [createFormUseSafeDefaults, setCreateFormUseSafeDefaults] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<OrchestratorCampaign[]>({
    queryKey: ["/api/orchestrator/campaigns"]
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ campaign: any; contacts: CampaignContact[] }>({
    queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts", stateFilter],
    queryFn: async () => {
      if (!selectedCampaign) return { campaign: null, contacts: [] };
      const params = new URLSearchParams();
      if (stateFilter !== "all") params.set("state", stateFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!selectedCampaign
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery<{ campaignContact: any; timeline: TimelineItem[] }>({
    queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts", selectedContact?.id, "timeline"],
    queryFn: async () => {
      if (!selectedContact || !selectedCampaign) return { campaignContact: null, timeline: [] };
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/contacts/${selectedContact.id}/timeline?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: !!selectedContact && !!selectedCampaign && timelineOpen
  });

  const { data: metricsData, isLoading: metricsLoading } = useQuery<CampaignMetrics>({
    queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "metrics", metricsWindow],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/metrics?window=${metricsWindow}`);
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    enabled: !!selectedCampaign
  });

  const { data: jobMetricsData, isLoading: jobMetricsLoading } = useQuery<JobMetrics>({
    queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "jobs", "metrics"],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/jobs/metrics`);
      if (!res.ok) throw new Error("Failed to fetch job metrics");
      return res.json();
    },
    enabled: !!selectedCampaign
  });

  const { data: autoTuneData, isLoading: autoTuneLoading, refetch: refetchAutoTune } = useQuery<AutoTuneRecommendation | { message: string }>({
    queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "auto-tune"],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/auto-tune`);
      if (!res.ok) throw new Error("Failed to fetch auto-tune data");
      return res.json();
    },
    enabled: !!selectedCampaign
  });

  const { data: lastApplyData, refetch: refetchLastApply } = useQuery<LastApply | { message: string }>({
    queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "auto-tune", "last-apply"],
    queryFn: async () => {
      if (!selectedCampaign) return null;
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/auto-tune/last-apply`);
      if (!res.ok) throw new Error("Failed to fetch last apply");
      return res.json();
    },
    enabled: !!selectedCampaign
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ tasks: OrchestratorTaskItem[] }>({
    queryKey: ['/api/orchestrator/campaigns', selectedCampaign?.id, 'tasks', taskStatusFilter],
    queryFn: async () => {
      if (!selectedCampaign) return { tasks: [] };
      const params = new URLSearchParams();
      if (taskStatusFilter !== "all") params.set("status", taskStatusFilter);
      const res = await fetch(`/api/orchestrator/campaigns/${selectedCampaign.id}/tasks?${params}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!selectedCampaign
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<SystemHealth>({
    queryKey: ["/api/orchestrator/system/health"],
    queryFn: async () => {
      const res = await fetch("/api/orchestrator/system/health");
      if (!res.ok) throw new Error("Failed to fetch health");
      return res.json();
    },
    refetchInterval: 15000
  });

  const { data: activityData, isLoading: activityLoading } = useQuery<{
    id: string;
    eventType: string;
    channel: string | null;
    provider: string | null;
    campaignId: string;
    campaignName: string | null;
    createdAt: string;
  }[]>({
    queryKey: ["/api/orchestrator/activity"],
    refetchInterval: 10000
  });

  const { data: summaryData } = useQuery<{
    campaignId: string;
    attempts: number;
    delivered: number;
    replied: number;
    optOut: number;
    failedFinal: number;
    voice: { callPlaced: number; callAnswered: number; answerRate: number };
  }[]>({
    queryKey: ["/api/orchestrator/campaigns/summary", { window: "7d" }]
  });

  const runOrchestratorMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign.id}/run-once`, { limit: 50 });
    },
    onSuccess: (data: { summary: RunOnceSummary }) => {
      const s = data.summary;
      toast({ 
        title: "Orchestrator completed", 
        description: `Processed: ${s.processed}, Enqueued: ${s.enqueued}, Timeouts: ${s.timeouts}, Skipped: ${s.skipped}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/system/health"] });
    },
    onError: (error: any) => {
      toast({ title: "Orchestrator failed", description: error.message, variant: "destructive" });
    }
  });

  const runJobsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/orchestrator/jobs/run-once", { limit: 50 });
    },
    onSuccess: (data: { summary: RunJobsSummary }) => {
      const s = data.summary;
      toast({ 
        title: "Jobs runner completed", 
        description: `Processed: ${s.processed}, Succeeded: ${s.succeeded}, Failed: ${s.failed}, Retried: ${s.retried}` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/system/health"] });
    },
    onError: (error: any) => {
      toast({ title: "Jobs runner failed", description: error.message, variant: "destructive" });
    }
  });

  const emergencyStopMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign.id}/emergency-stop`);
    },
    onSuccess: (data: { canceledJobs: number }) => {
      toast({ 
        title: "Emergency Stop", 
        description: `Campaign paused, ${data.canceledJobs} queued jobs canceled` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/system/health"] });
    },
    onError: (error: any) => {
      toast({ title: "Emergency stop failed", description: error.message, variant: "destructive" });
    }
  });

  const requeueFailedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign.id}/requeue-failed-jobs`, { limit: 200 });
    },
    onSuccess: (data: { requeuedCount: number }) => {
      toast({ 
        title: "Requeue Complete", 
        description: `${data.requeuedCount} failed jobs requeued` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/system/health"] });
    },
    onError: (error: any) => {
      toast({ title: "Requeue failed", description: error.message, variant: "destructive" });
    }
  });

  const stopAllContactsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign.id}/stop-all-contacts`);
    },
    onSuccess: (data: { stoppedCount: number }) => {
      toast({ 
        title: "Contacts Stopped", 
        description: `${data.stoppedCount} contacts set to DO_NOT_CONTACT` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Stop all failed", description: error.message, variant: "destructive" });
    }
  });

  const reapProcessingMutation = useMutation({
    mutationFn: async (dryRun: boolean = false) => {
      return apiRequest("POST", "/api/orchestrator/system/reap-processing", { timeoutMinutes: 10, dryRun });
    },
    onSuccess: (data: { reaped: number; dryRun: boolean }) => {
      if (data.dryRun) {
        toast({ title: "Dry Run", description: `Would reap ${data.reaped} stuck jobs` });
      } else {
        toast({ title: "Reap Complete", description: `Reaped ${data.reaped} stuck processing jobs` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/system/health"] });
    },
    onError: (error: any) => {
      toast({ title: "Reap failed", description: error.message, variant: "destructive" });
    }
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("POST", `/api/orchestrator/tasks/${taskId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orchestrator/campaigns', selectedCampaign?.id, 'tasks'] });
      toast({ title: "Task completed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const markBookedMutation = useMutation({
    mutationFn: async (campaignContactId: string) => {
      return apiRequest("POST", `/api/orchestrator/campaign-contacts/${campaignContactId}/mark-booked`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orchestrator/campaigns', selectedCampaign?.id, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts"] });
      toast({ title: "Contact marked as booked" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const applyMutation = useMutation({
    mutationFn: async ({ snapshotId, mode, blendFactor }: { snapshotId: string; mode: "replace" | "blend"; blendFactor?: number }) => {
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign?.id}/auto-tune/apply`, {
        snapshotId,
        mode,
        blendFactor
      });
    },
    onSuccess: () => {
      toast({ title: "Allocation applied", description: "Campaign allocation has been updated" });
      refetchAutoTune();
      refetchLastApply();
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Apply failed", description: error.message, variant: "destructive" });
    }
  });

  const rollbackMutation = useMutation({
    mutationFn: async (auditLogId: string) => {
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign?.id}/auto-tune/rollback`, { auditLogId });
    },
    onSuccess: () => {
      toast({ title: "Rollback complete", description: "Allocation has been restored" });
      refetchAutoTune();
      refetchLastApply();
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
    },
    onError: (error: any) => {
      toast({ title: "Rollback failed", description: error.message, variant: "destructive" });
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("POST", `/api/orchestrator/campaigns/${campaignId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
      toast({ title: "Campaign paused" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const resumeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest("POST", `/api/orchestrator/campaigns/${campaignId}/resume`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
      toast({ title: "Campaign resumed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: { name: string; status: string; policyJson: object }) => {
      return apiRequest("POST", "/api/orchestrator/campaigns", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] });
      setCreateDialogOpen(false);
      setCreateFormName("");
      setCreateFormStatus("draft");
      setCreateFormUseSafeDefaults(true);
      toast({ title: "Campaign created", description: "New campaign has been created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating campaign", description: error.message, variant: "destructive" });
    }
  });

  const handleCreateCampaign = () => {
    if (!createFormName.trim()) {
      toast({ title: "Name required", description: "Please enter a campaign name", variant: "destructive" });
      return;
    }
    createCampaignMutation.mutate({
      name: createFormName.trim(),
      status: createFormStatus,
      policyJson: {}
    });
  };

  const stopContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      return apiRequest("POST", `/api/orchestrator/campaigns/${selectedCampaign.id}/contacts/${contactId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns", selectedCampaign?.id, "contacts", selectedContact?.id, "timeline"] });
      setTimelineOpen(false);
      setSelectedContact(null);
      toast({ title: "Contact stopped" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string, compact = false) => {
    const baseClass = compact ? "text-xs px-2 py-0.5" : "";
    switch (status) {
      case "active":
        return <Badge className={`bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25 ${baseClass}`} data-testid="badge-status-active">Active</Badge>;
      case "paused":
        return <Badge className={`bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/25 ${baseClass}`} data-testid="badge-status-paused">Paused</Badge>;
      case "draft":
        return <Badge variant="outline" className={`bg-muted/50 ${baseClass}`} data-testid="badge-status-draft">Draft</Badge>;
      case "completed":
        return <Badge className={`bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20 ${baseClass}`} data-testid="badge-status-completed">Completed</Badge>;
      default:
        return <Badge variant="outline" className={baseClass}>{status}</Badge>;
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case "NEW":
        return <Badge variant="outline" data-testid="badge-state-new">New</Badge>;
      case "ATTEMPTING":
        return <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" data-testid="badge-state-attempting">Attempting</Badge>;
      case "ENGAGED":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" data-testid="badge-state-engaged">Engaged</Badge>;
      case "STOPPED":
        return <Badge variant="secondary" data-testid="badge-state-stopped">Stopped</Badge>;
      case "DO_NOT_CONTACT":
        return <Badge variant="destructive" data-testid="badge-state-dnc">DNC</Badge>;
      case "UNREACHABLE":
        return <Badge variant="destructive" data-testid="badge-state-unreachable">Unreachable</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const getChannelIcon = (channel: string | null) => {
    switch (channel) {
      case "sms":
      case "imessage":
      case "mms":
        return <MessageSquare className="h-4 w-4" />;
      case "voice":
      case "voicemail":
      case "rvm":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'DECISION_MADE': return <Zap className="h-3.5 w-3.5 text-purple-500" />;
      case 'ATTEMPT_QUEUED': return <Clock className="h-3.5 w-3.5 text-blue-500" />;
      case 'MESSAGE_DELIVERED': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case 'MESSAGE_FAILED': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'CALL_PLACED': 
      case 'CALL_ANSWERED': return <Phone className="h-3.5 w-3.5 text-emerald-500" />;
      case 'CALL_NO_ANSWER':
      case 'CALL_BUSY':
      case 'CALL_FAILED': return <Phone className="h-3.5 w-3.5 text-orange-500" />;
      case 'REPLY_RECEIVED': return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
      case 'OPT_OUT': return <Ban className="h-3.5 w-3.5 text-red-500" />;
      case 'TASK_CREATED': return <ListTodo className="h-3.5 w-3.5 text-amber-500" />;
      case 'BOOKED': return <Calendar className="h-3.5 w-3.5 text-green-500" />;
      default: return <Activity className="h-3.5 w-3.5 text-gray-500" />;
    }
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  const getSummaryForCampaign = (campaignId: string) => {
    return summaryData?.find(s => s.campaignId === campaignId);
  };

  const hasAlerts = (healthData?.stuckProcessingVoice ?? 0) > 0 || (healthData?.lastErrors?.length ?? 0) > 0;

  const kpiData = {
    activeCampaigns: campaigns?.filter(c => c.status === "active").length || 0,
    totalContacts: campaigns?.reduce((acc, c) => acc + (c.stats?.total || 0), 0) || 0,
    attempting: campaigns?.reduce((acc, c) => acc + (c.stats?.attempting || 0), 0) || 0,
    engaged: campaigns?.reduce((acc, c) => acc + (c.stats?.engaged || 0), 0) || 0,
    dncStopped: campaigns?.reduce((acc, c) => acc + (c.stats?.dnc || 0) + (c.stats?.stopped || 0), 0) || 0,
    jobsQueued: healthData?.jobsQueued || 0
  };

  const getRunStatusBadge = (run: SystemRunInfo | undefined) => {
    if (!run) return <span className="text-xs text-muted-foreground italic">Never</span>;
    const statusClass = run.status === 'success' ? 'bg-emerald-500/15 text-emerald-700' : 
                        run.status === 'error' ? 'bg-red-500/15 text-red-700' : 
                        'bg-yellow-500/15 text-yellow-700';
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">
          {run.completedAt ? formatDistanceToNow(new Date(run.completedAt), { addSuffix: true }) : 'Running'}
        </span>
        <Badge className={`${statusClass} text-xs px-1.5 py-0`} data-testid={`badge-run-status`}>{run.status}</Badge>
      </div>
    );
  };

  if (campaignsLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading campaigns..." />;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Campaign Control Center</h1>
            <p className="text-sm text-muted-foreground">Manage outreach campaigns and contact journeys</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  className="transition-all duration-200"
                  data-testid="button-create-campaign"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-campaign">
                <DialogHeader>
                  <DialogTitle>Create Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Name</Label>
                    <Input
                      id="campaign-name"
                      placeholder="Enter campaign name"
                      value={createFormName}
                      onChange={(e) => setCreateFormName(e.target.value)}
                      data-testid="input-campaign-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-status">Status</Label>
                    <Select value={createFormStatus} onValueChange={setCreateFormStatus}>
                      <SelectTrigger id="campaign-status" data-testid="select-campaign-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="use-safe-defaults" className="text-sm">Use safe defaults</Label>
                    <Switch
                      id="use-safe-defaults"
                      checked={createFormUseSafeDefaults}
                      onCheckedChange={setCreateFormUseSafeDefaults}
                      data-testid="switch-safe-defaults"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleCreateCampaign}
                    disabled={createCampaignMutation.isPending}
                    data-testid="button-submit-create-campaign"
                  >
                    {createCampaignMutation.isPending ? <LoadingSpinner fullScreen={false} /> : "Create"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] })}
              className="transition-all duration-200"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!selectedCampaign ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="layout-main-grid">
            {/* Left column - Campaigns list (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              {/* KPI cards row */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="p-3 transition-all duration-200 hover:shadow-md" data-testid="card-kpi-active">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Target className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Active</p>
                      <p className="text-lg font-semibold" data-testid="kpi-active-campaigns">{kpiData.activeCampaigns}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 transition-all duration-200 hover:shadow-md" data-testid="card-kpi-contacts">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contacts</p>
                      <p className="text-lg font-semibold" data-testid="kpi-total-contacts">{kpiData.totalContacts.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 transition-all duration-200 hover:shadow-md" data-testid="card-kpi-attempting">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Activity className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Attempting</p>
                      <p className="text-lg font-semibold" data-testid="kpi-attempting">{kpiData.attempting.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 transition-all duration-200 hover:shadow-md" data-testid="card-kpi-engaged">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <UserCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Engaged</p>
                      <p className="text-lg font-semibold" data-testid="kpi-engaged">{kpiData.engaged.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 transition-all duration-200 hover:shadow-md" data-testid="card-kpi-dnc">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <Ban className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">DNC/Stop</p>
                      <p className="text-lg font-semibold" data-testid="kpi-dnc-stopped">{kpiData.dncStopped.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 transition-all duration-200 hover:shadow-md" data-testid="card-kpi-queued">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Layers className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Queued</p>
                      <p className="text-lg font-semibold" data-testid="kpi-jobs-queued">{kpiData.jobsQueued}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Campaigns table */}
              <Card data-testid="card-campaigns-table">
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Campaigns</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {!campaigns || campaigns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No campaigns found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Contacts</TableHead>
                          <TableHead className="text-right">Attempts</TableHead>
                          <TableHead className="text-right">Delivered</TableHead>
                          <TableHead className="text-right">Replied</TableHead>
                          <TableHead className="text-right">Voice %</TableHead>
                          <TableHead>Funnel</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((campaign) => {
                          const total = campaign.stats?.total || 1;
                          const attemptingPct = ((campaign.stats?.attempting || 0) / total) * 100;
                          const engagedPct = ((campaign.stats?.engaged || 0) / total) * 100;
                          const dncPct = ((campaign.stats?.dnc || 0) / total) * 100;
                          const summary = getSummaryForCampaign(campaign.id);
                          return (
                            <TableRow 
                              key={campaign.id} 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              data-testid={`row-campaign-${campaign.id}`}
                            >
                              <TableCell 
                                className="font-medium" 
                                onClick={() => setSelectedCampaign(campaign)}
                                data-testid={`text-campaign-name-${campaign.id}`}
                              >
                                {campaign.name}
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)}>
                                {getStatusBadge(campaign.status, true)}
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)} className="text-right">
                                <span className="font-medium">{campaign.stats?.total || 0}</span>
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)} className="text-right text-sm text-muted-foreground" data-testid={`text-attempts-${campaign.id}`}>
                                {summary?.attempts ?? '-'}
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)} className="text-right text-sm text-muted-foreground" data-testid={`text-delivered-${campaign.id}`}>
                                {summary?.delivered ?? '-'}
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)} className="text-right text-sm text-muted-foreground" data-testid={`text-replied-${campaign.id}`}>
                                {summary?.replied ?? '-'}
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)} className="text-right text-sm text-muted-foreground" data-testid={`text-voice-${campaign.id}`}>
                                {summary?.voice?.callPlaced ? `${(summary.voice.answerRate * 100).toFixed(0)}%` : '-'}
                              </TableCell>
                              <TableCell onClick={() => setSelectedCampaign(campaign)}>
                                <div className="flex items-center gap-1 w-20">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="h-2 rounded-sm bg-amber-400" style={{ width: `${attemptingPct}%`, minWidth: attemptingPct > 0 ? '4px' : '0' }} />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Attempting: {campaign.stats?.attempting || 0}</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="h-2 rounded-sm bg-emerald-500" style={{ width: `${engagedPct}%`, minWidth: engagedPct > 0 ? '4px' : '0' }} />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Engaged: {campaign.stats?.engaged || 0}</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="h-2 rounded-sm bg-red-400" style={{ width: `${dncPct}%`, minWidth: dncPct > 0 ? '4px' : '0' }} />
                                    </TooltipTrigger>
                                    <TooltipContent><p>DNC: {campaign.stats?.dnc || 0}</p></TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {campaign.status === "active" && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 hover:bg-amber-500/10"
                                          onClick={(e) => { e.stopPropagation(); pauseMutation.mutate(campaign.id); }}
                                          disabled={pauseMutation.isPending}
                                          data-testid={`button-pause-${campaign.id}`}
                                        >
                                          <Pause className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Pause</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  {campaign.status === "paused" && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 hover:bg-emerald-500/10"
                                          onClick={(e) => { e.stopPropagation(); resumeMutation.mutate(campaign.id); }}
                                          disabled={resumeMutation.isPending}
                                          data-testid={`button-resume-${campaign.id}`}
                                        >
                                          <Play className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Resume</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={() => setSelectedCampaign(campaign)}
                                        data-testid={`button-view-${campaign.id}`}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Open</p></TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column - Mission Control (1/3 width, sticky) */}
            <div className="lg:sticky lg:top-4 space-y-4 h-fit" data-testid="panel-mission-control">
              {/* System Health card */}
              <Card data-testid="card-system-health">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">System Health</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => refetchHealth()} className="h-7 w-7 p-0" data-testid="button-refresh-health">
                      <RefreshCw className={`h-3 w-3 ${healthLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {healthLoading && !healthData ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : healthData ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold" data-testid="text-health-queued">{healthData.jobsQueued}</div>
                          <div className="text-xs text-muted-foreground">Queued</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600" data-testid="text-health-processing">{healthData.jobsProcessing}</div>
                          <div className="text-xs text-muted-foreground">Processing</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg">
                          <div className="text-lg font-bold text-red-600" data-testid="text-health-failed">{healthData.jobsFailed}</div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-lg relative">
                          <div className="text-lg font-bold" data-testid="text-health-stuck">{healthData.stuckProcessingVoice}</div>
                          <div className="text-xs text-muted-foreground">Stuck Voice</div>
                          {healthData.stuckProcessingVoice > 0 && (
                            <AlertTriangle className="h-3 w-3 text-orange-500 absolute top-1 right-1" />
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Orchestrator:</span>
                          {getRunStatusBadge(healthData.lastRuns?.orchestrator)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Jobs:</span>
                          {getRunStatusBadge(healthData.lastRuns?.jobs)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Auto-Tuner:</span>
                          {getRunStatusBadge(healthData.lastRuns?.auto_tuner)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Reaper:</span>
                          {getRunStatusBadge(healthData.lastRuns?.reaper)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Unable to load health data</p>
                  )}
                </CardContent>
              </Card>

              {/* Live Activity Feed */}
              <Card data-testid="card-live-activity">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Live Activity</CardTitle>
                    <Badge variant="outline" className="text-xs">Last 20</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {activityLoading ? (
                    <div className="p-3 space-y-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="divide-y">
                        {activityData?.map((event) => (
                          <div key={event.id} className="px-3 py-2 hover:bg-muted/50 transition-colors" data-testid={`activity-item-${event.id}`}>
                            <div className="flex items-center gap-2">
                              {getEventIcon(event.eventType)}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{formatEventType(event.eventType)}</p>
                                <p className="text-xs text-muted-foreground truncate">{event.campaignName}</p>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        ))}
                        {!activityData?.length && (
                          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Alerts card - only show if there are alerts */}
              {hasAlerts && (
                <Card className="border-orange-200 dark:border-orange-900" data-testid="card-alerts">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium flex-1">
                        {healthData?.stuckProcessingVoice && healthData.stuckProcessingVoice > 0 && `${healthData.stuckProcessingVoice} stuck voice jobs`}
                        {healthData?.stuckProcessingVoice && healthData.stuckProcessingVoice > 0 && healthData?.lastErrors && healthData.lastErrors.length > 0 && ' | '}
                        {healthData?.lastErrors && healthData.lastErrors.length > 0 && `${healthData.lastErrors.length} errors`}
                      </span>
                      {healthData?.lastErrors && healthData.lastErrors.length > 0 && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-view-errors">
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle data-testid="text-errors-dialog-title">Recent System Run Errors</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="h-[60vh]">
                              <div className="space-y-3">
                                {healthData.lastErrors.map((error) => (
                                  <div key={error.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg" data-testid={`error-item-${error.id}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <Badge variant="destructive" className="capitalize">{error.type}</Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(error.createdAt), "MMM d, yyyy HH:mm:ss")}
                                      </span>
                                    </div>
                                    <div className="text-sm text-red-700 dark:text-red-300 break-all">
                                      {error.payload?.error || 'Unknown error'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setSelectedCampaign(null)} data-testid="button-back" className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <h2 className="text-lg font-semibold" data-testid="text-campaign-detail-name">{selectedCampaign.name}</h2>
                {getStatusBadge(selectedCampaign.status)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => runOrchestratorMutation.mutate()}
                      disabled={runOrchestratorMutation.isPending}
                      data-testid="button-run-orchestrator"
                      className="gap-1.5"
                    >
                      {runOrchestratorMutation.isPending ? <LoadingSpinner fullScreen={false} /> : <Zap className="h-4 w-4" />}
                      Run Orchestrator
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Process pending contacts now</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runJobsMutation.mutate()}
                      disabled={runJobsMutation.isPending}
                      data-testid="button-run-jobs"
                      className="gap-1.5"
                    >
                      {runJobsMutation.isPending ? <LoadingSpinner fullScreen={false} /> : <Activity className="h-4 w-4" />}
                      Run Jobs
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Execute queued jobs now</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => requeueFailedMutation.mutate()}
                      disabled={requeueFailedMutation.isPending}
                      data-testid="button-requeue-failed"
                      className="gap-1.5"
                    >
                      {requeueFailedMutation.isPending ? <LoadingSpinner fullScreen={false} /> : <RotateCcw className="h-4 w-4" />}
                      Requeue Failed
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Retry failed jobs</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Stop all active contacts in this campaign? They will be set to DO_NOT_CONTACT.")) {
                          stopAllContactsMutation.mutate();
                        }
                      }}
                      disabled={stopAllContactsMutation.isPending}
                      data-testid="button-stop-all-contacts"
                    >
                      {stopAllContactsMutation.isPending ? <LoadingSpinner fullScreen={false} /> : <StopCircle className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Stop all contacts</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm("EMERGENCY STOP: This will pause the campaign and cancel all queued jobs. Continue?")) {
                          emergencyStopMutation.mutate();
                        }
                      }}
                      disabled={emergencyStopMutation.isPending}
                      data-testid="button-emergency-stop"
                    >
                      {emergencyStopMutation.isPending ? <LoadingSpinner fullScreen={false} /> : <AlertCircle className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Emergency Stop</p></TooltipContent>
                </Tooltip>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="contacts" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Contacts
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5">
                  <ListTodo className="h-3.5 w-3.5" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="metrics" className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="auto-tune" className="gap-1.5">
                  <Sliders className="h-3.5 w-3.5" />
                  Auto-Tune
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: "Total", value: selectedCampaign.stats?.total || 0, color: "" },
                    { label: "New", value: selectedCampaign.stats?.new || 0, color: "text-blue-600" },
                    { label: "Attempting", value: selectedCampaign.stats?.attempting || 0, color: "text-amber-600" },
                    { label: "Engaged", value: selectedCampaign.stats?.engaged || 0, color: "text-emerald-600" },
                    { label: "Stopped", value: selectedCampaign.stats?.stopped || 0, color: "text-gray-600" },
                    { label: "DNC", value: selectedCampaign.stats?.dnc || 0, color: "text-red-600" },
                    { label: "Unreachable", value: selectedCampaign.stats?.unreachable || 0, color: "text-orange-600" },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-3 text-center transition-all duration-200 hover:shadow-md">
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base" data-testid="text-health-title">System Health</CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => refetchHealth()} disabled={healthLoading} data-testid="button-refresh-health" className="h-8 w-8 p-0">
                        <RefreshCw className={`h-4 w-4 ${healthLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {healthLoading && !healthData ? (
                      <div className="grid grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : healthData ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold" data-testid="text-health-queued">{healthData.jobsQueued}</div>
                            <div className="text-xs text-muted-foreground">Queued</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600" data-testid="text-health-processing">{healthData.jobsProcessing}</div>
                            <div className="text-xs text-muted-foreground">Processing</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-2xl font-bold text-red-600" data-testid="text-health-failed">{healthData.jobsFailed}</div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg relative">
                            <div className="text-2xl font-bold" data-testid="text-health-stuck">{healthData.stuckProcessingVoice}</div>
                            <div className="text-xs text-muted-foreground">Stuck Voice</div>
                            {healthData.stuckProcessingVoice > 0 && (
                              <AlertTriangle className="h-4 w-4 text-orange-500 absolute top-2 right-2" />
                            )}
                          </div>
                        </div>
                        {healthData.stuckProcessingVoice > 0 && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => reapProcessingMutation.mutate(true)} disabled={reapProcessingMutation.isPending} data-testid="button-reap-dry-run">
                              Preview Reap
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { if (confirm("This will mark stuck voice jobs as failed. Continue?")) reapProcessingMutation.mutate(false); }} disabled={reapProcessingMutation.isPending} data-testid="button-reap-stuck">
                              Reap Stuck Jobs
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Unable to load health data</div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base" data-testid="text-job-health-title">Job Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {jobMetricsLoading ? (
                      <div className="grid grid-cols-5 gap-3">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : jobMetricsData ? (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600" data-testid="text-jobs-queued">{jobMetricsData.queuedCount}</div>
                          <div className="text-xs text-muted-foreground">Queued</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600" data-testid="text-jobs-processing">{jobMetricsData.processingCount}</div>
                          <div className="text-xs text-muted-foreground">Processing</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold text-red-600" data-testid="text-jobs-failed">{jobMetricsData.failedCount}</div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold" data-testid="text-jobs-avgretries">{jobMetricsData.avgRetryCount}</div>
                          <div className="text-xs text-muted-foreground">Avg Retries</div>
                        </div>
                        <div className="text-center p-3 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold" data-testid="text-jobs-oldest">
                            {jobMetricsData.oldestQueuedAgeSec !== null ? `${Math.round(jobMetricsData.oldestQueuedAgeSec / 60)}m` : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">Oldest Queued</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No job metrics available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contacts" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Contacts ({contactsData?.contacts?.length || 0})
                    </CardTitle>
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger className="w-40" data-testid="select-state-filter">
                        <SelectValue placeholder="Filter by state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        <SelectItem value="NEW">New</SelectItem>
                        <SelectItem value="ATTEMPTING">Attempting</SelectItem>
                        <SelectItem value="ENGAGED">Engaged</SelectItem>
                        <SelectItem value="STOPPED">Stopped</SelectItem>
                        <SelectItem value="DO_NOT_CONTACT">Do Not Contact</SelectItem>
                        <SelectItem value="UNREACHABLE">Unreachable</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="p-0">
                    {contactsLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                      </div>
                    ) : !contactsData?.contacts || contactsData.contacts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No contacts found</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Contact</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Next Action</TableHead>
                            <TableHead>Attempts</TableHead>
                            <TableHead>Fatigue</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactsData.contacts.map((contact) => (
                            <TableRow 
                              key={contact.id} 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => { setSelectedContact(contact); setTimelineOpen(true); }}
                              data-testid={`row-contact-${contact.id}`}
                            >
                              <TableCell>
                                <div>
                                  <div className="font-medium" data-testid={`text-contact-name-${contact.id}`}>
                                    {contact.firstName} {contact.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {contact.phone || contact.email || "No contact info"}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{getStateBadge(contact.state)}</TableCell>
                              <TableCell>
                                {contact.nextActionAt ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(contact.nextActionAt), "MMM d, h:mm a")}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{contact.attemptsTotal || 0}</TableCell>
                              <TableCell>{contact.fatigueScore?.toFixed(2) || "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(contact.updatedAt), { addSuffix: true })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListTodo className="h-4 w-4" />
                      Tasks ({tasksData?.tasks?.length || 0})
                    </CardTitle>
                    <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                      <SelectTrigger className="w-28" data-testid="select-task-status-filter">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="p-0">
                    {tasksLoading ? (
                      <div className="p-4 space-y-2">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                      </div>
                    ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No tasks found</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Contact Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Source Intent</TableHead>
                            <TableHead>Due At</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tasksData.tasks.map((item) => (
                            <TableRow key={item.task.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-task-${item.task.id}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{item.contact.firstName} {item.contact.lastName}</div>
                                  <div className="text-xs text-muted-foreground">{item.contact.phone || item.contact.email || "No contact info"}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">
                                  {item.task.type === "callback" ? (
                                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />Callback</span>
                                  ) : (
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Follow-up</span>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell><span className="text-xs">{item.task.sourceIntent || "-"}</span></TableCell>
                              <TableCell>
                                {item.task.dueAt ? (
                                  <div className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3" />{format(new Date(item.task.dueAt), "MMM d, h:mm a")}</div>
                                ) : <span className="text-muted-foreground">-</span>}
                              </TableCell>
                              <TableCell>
                                {item.task.status === "open" ? (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">Open</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-green-100 text-green-800 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.task.status === "open" && (
                                  <div className="flex gap-1">
                                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => completeTaskMutation.mutate(item.task.id)} disabled={completeTaskMutation.isPending} data-testid={`button-complete-task-${item.task.id}`}>
                                      <CheckCircle className="h-3 w-3 mr-1" />Complete
                                    </Button>
                                    <Button size="sm" className="h-7 text-xs" onClick={() => markBookedMutation.mutate(item.campaignContact.id)} disabled={markBookedMutation.isPending} data-testid={`button-mark-booked-${item.campaignContact.id}`}>
                                      Mark Booked
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metrics" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-base" data-testid="text-metrics-title">Metrics</CardTitle>
                    <Select value={metricsWindow} onValueChange={setMetricsWindow}>
                      <SelectTrigger className="w-32" data-testid="select-metrics-window">
                        <SelectValue placeholder="Window" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-7 gap-3">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
                        <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                      </div>
                    ) : metricsData ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold" data-testid="text-metric-attempts">{metricsData.attempts}</div><div className="text-xs text-muted-foreground">Attempts</div></div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-green-600" data-testid="text-metric-delivered">{metricsData.delivered}</div><div className="text-xs text-muted-foreground">Delivered</div></div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-blue-600" data-testid="text-metric-replied">{metricsData.replied}</div><div className="text-xs text-muted-foreground">Replies</div></div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-orange-600" data-testid="text-metric-optout">{metricsData.optOut}</div><div className="text-xs text-muted-foreground">Opt-outs</div></div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-red-400" data-testid="text-metric-failed">{metricsData.failed}</div><div className="text-xs text-muted-foreground">Failed (All)</div></div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-red-600" data-testid="text-metric-failed-final">{metricsData.failedFinal}</div><div className="text-xs text-muted-foreground">Failed (Final)</div></div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-purple-600" data-testid="text-metric-avg-reply">{metricsData.avgTimeToReplySeconds !== null ? `${Math.round(metricsData.avgTimeToReplySeconds / 60)}m` : "-"}</div><div className="text-xs text-muted-foreground">Avg Reply Time</div></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="text-center p-2 border rounded"><div className="text-lg font-semibold" data-testid="text-rate-delivery">{(metricsData.rates.deliveryRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Delivery Rate</div></div>
                          <div className="text-center p-2 border rounded"><div className="text-lg font-semibold" data-testid="text-rate-reply">{(metricsData.rates.replyRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Reply Rate</div></div>
                          <div className="text-center p-2 border rounded"><div className="text-lg font-semibold" data-testid="text-rate-optout">{(metricsData.rates.optOutRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Opt-out Rate</div></div>
                          <div className="text-center p-2 border rounded"><div className="text-lg font-semibold" data-testid="text-rate-failure">{(metricsData.rates.failureRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Failure Rate (All)</div></div>
                          <div className="text-center p-2 border rounded"><div className="text-lg font-semibold text-red-600" data-testid="text-rate-failure-final">{(metricsData.rates.failureRateFinal * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Failure Rate (Final)</div></div>
                        </div>
                        {metricsData.voice && metricsData.voice.callPlaced > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2"><Phone className="h-4 w-4" />Voice Performance</h4>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                              <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold" data-testid="text-voice-placed">{metricsData.voice.callPlaced}</div><div className="text-xs text-muted-foreground">Calls Placed</div></div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-green-600" data-testid="text-voice-answered">{metricsData.voice.callAnswered}</div><div className="text-xs text-muted-foreground">Answered</div></div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-yellow-600" data-testid="text-voice-noanswer">{metricsData.voice.callNoAnswer}</div><div className="text-xs text-muted-foreground">No Answer</div></div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-orange-600" data-testid="text-voice-busy">{metricsData.voice.callBusy}</div><div className="text-xs text-muted-foreground">Busy</div></div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-red-600" data-testid="text-voice-failed">{metricsData.voice.callFailed}</div><div className="text-xs text-muted-foreground">Failed</div></div>
                              <div className="text-center p-3 bg-muted/50 rounded-lg"><div className="text-2xl font-bold text-purple-600" data-testid="text-voice-voicemail">{metricsData.voice.voicemailDropped}</div><div className="text-xs text-muted-foreground">Voicemails</div></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="text-center p-2 border rounded"><div className="text-lg font-semibold text-green-600" data-testid="text-voice-answer-rate">{(metricsData.voice.rates.answerRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Answer Rate</div></div>
                              <div className="text-center p-2 border rounded"><div className="text-lg font-semibold text-yellow-600" data-testid="text-voice-noanswer-rate">{(metricsData.voice.rates.noAnswerRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">No Answer Rate</div></div>
                              <div className="text-center p-2 border rounded"><div className="text-lg font-semibold text-orange-600" data-testid="text-voice-busy-rate">{(metricsData.voice.rates.busyRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Busy Rate</div></div>
                              <div className="text-center p-2 border rounded"><div className="text-lg font-semibold text-red-600" data-testid="text-voice-failure-rate">{(metricsData.voice.rates.callFailureRate * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">Call Failure Rate</div></div>
                            </div>
                          </div>
                        )}
                        {Object.keys(metricsData.breakdownByChannel).length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Breakdown by Channel</h4>
                            <Table>
                              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Delivered</TableHead><TableHead className="text-right">Replied</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="text-right">Final</TableHead><TableHead className="text-right">Opt-out</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {Object.entries(metricsData.breakdownByChannel).map(([channel, stats]) => (
                                  <TableRow key={channel} data-testid={`row-channel-${channel}`}>
                                    <TableCell className="font-medium capitalize">{channel}</TableCell>
                                    <TableCell className="text-right">{stats.attempts}</TableCell>
                                    <TableCell className="text-right">{stats.delivered}</TableCell>
                                    <TableCell className="text-right">{stats.replied}</TableCell>
                                    <TableCell className="text-right">{stats.failed}</TableCell>
                                    <TableCell className="text-right text-red-600">{stats.failedFinal}</TableCell>
                                    <TableCell className="text-right">{stats.optOut}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {metricsData.metricsByVariant && Object.keys(metricsData.metricsByVariant).length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Metrics by Variant (A/B Test)</h4>
                            {(() => {
                              const hasVoiceData = Object.values(metricsData.metricsByVariant).some(v => v.voice && v.voice.callPlaced > 0);
                              return (
                                <Table>
                                  <TableHeader><TableRow><TableHead>Variant</TableHead><TableHead className="text-right">Attempts</TableHead><TableHead className="text-right">Delivered</TableHead><TableHead className="text-right">Replied</TableHead><TableHead className="text-right">Opt-out</TableHead><TableHead className="text-right">Delivery %</TableHead><TableHead className="text-right">Reply %</TableHead>{hasVoiceData && <TableHead className="text-right">Calls</TableHead>}{hasVoiceData && <TableHead className="text-right">Answer %</TableHead>}</TableRow></TableHeader>
                                  <TableBody>
                                    {Object.entries(metricsData.metricsByVariant).map(([variant, stats]) => (
                                      <TableRow key={variant} data-testid={`row-variant-${variant}`}>
                                        <TableCell className="font-medium capitalize">{variant}</TableCell>
                                        <TableCell className="text-right">{stats.attempts}</TableCell>
                                        <TableCell className="text-right">{stats.delivered}</TableCell>
                                        <TableCell className="text-right">{stats.replied}</TableCell>
                                        <TableCell className="text-right">{stats.optOut}</TableCell>
                                        <TableCell className="text-right">{(stats.rates.deliveryRate * 100).toFixed(1)}%</TableCell>
                                        <TableCell className="text-right">{(stats.rates.replyRate * 100).toFixed(1)}%</TableCell>
                                        {hasVoiceData && <TableCell className="text-right">{stats.voice?.callPlaced || 0}</TableCell>}
                                        {hasVoiceData && <TableCell className="text-right text-green-600">{stats.voice ? (stats.voice.answerRate * 100).toFixed(1) + '%' : '-'}</TableCell>}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No metrics available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="auto-tune" className="mt-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2" data-testid="text-auto-tune-title">
                      <Sliders className="h-4 w-4" />
                      Auto-Tune (A/B Optimization)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {autoTuneLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16" />
                        <div className="grid grid-cols-2 gap-4">
                          <Skeleton className="h-24" />
                          <Skeleton className="h-24" />
                        </div>
                      </div>
                    ) : autoTuneData && 'id' in autoTuneData ? (
                      <div className="space-y-4">
                        {autoTuneData.coverageWarnings && autoTuneData.coverageWarnings.length > 0 && (
                          <Alert variant="default">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Coverage Warnings:</strong>
                              <ul className="mt-1 list-disc list-inside">
                                {autoTuneData.coverageWarnings.map((w, i) => (
                                  <li key={i}>{w.variant}: {w.message}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium mb-2">Recommended Allocation</h4>
                            <div className="space-y-1">
                              {Object.entries(autoTuneData.allocationsJson).map(([variant, alloc]) => (
                                <div key={variant} className="flex justify-between text-sm" data-testid={`text-alloc-${variant}`}>
                                  <span className="capitalize">{variant}</span>
                                  <span className="font-mono">{(alloc * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Variant Metrics</h4>
                            <div className="space-y-1">
                              {autoTuneData.metricsSnapshotJson.map(m => (
                                <div key={m.variant} className="flex justify-between text-sm">
                                  <span className="capitalize">{m.variant}</span>
                                  <span className="text-muted-foreground">{m.attempts} attempts, reward: {m.reward.toFixed(1)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Computed: {format(new Date(autoTuneData.computedAt), "MMM d, h:mm a")} ({autoTuneData.window} window)
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => applyMutation.mutate({ snapshotId: autoTuneData.id, mode: "replace" })} disabled={applyMutation.isPending} data-testid="button-apply-replace">
                            {applyMutation.isPending ? "Applying..." : "Apply (Replace)"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => applyMutation.mutate({ snapshotId: autoTuneData.id, mode: "blend", blendFactor: 0.5 })} disabled={applyMutation.isPending} data-testid="button-apply-blend">
                            Apply (50% Blend)
                          </Button>
                          {lastApplyData && 'id' in lastApplyData && (
                            <Button size="sm" variant="ghost" onClick={() => rollbackMutation.mutate(lastApplyData.id)} disabled={rollbackMutation.isPending} data-testid="button-rollback">
                              <RotateCcw className="h-4 w-4 mr-1" />
                              {rollbackMutation.isPending ? "Rolling back..." : "Rollback"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No auto-tune recommendations available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <Sheet open={timelineOpen} onOpenChange={setTimelineOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span data-testid="text-timeline-title">
                  {selectedContact?.firstName} {selectedContact?.lastName} - Timeline
                </span>
                {selectedContact && !["DO_NOT_CONTACT", "STOPPED"].includes(selectedContact.state) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => stopContactMutation.mutate(selectedContact.id)}
                    disabled={stopContactMutation.isPending}
                    data-testid="button-stop-contact"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Stop Contact
                  </Button>
                )}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2">
              {selectedContact && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  {getStateBadge(selectedContact.state)}
                  <span>Attempts: {selectedContact.attemptsTotal || 0}</span>
                  {selectedContact.stoppedReason && (
                    <span>Reason: {selectedContact.stoppedReason}</span>
                  )}
                </div>
              )}
              <Separator />
              <ScrollArea className="h-[calc(100vh-200px)]">
                {timelineLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : !timelineData?.timeline || timelineData.timeline.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No timeline events</p>
                ) : (
                  <div className="space-y-3 pr-4">
                    {timelineData.timeline.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="border rounded-lg p-3 space-y-1 transition-colors hover:bg-muted/30"
                        data-testid={`timeline-item-${item.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.type === "event" ? (
                              <Badge variant="outline" className="text-xs">Event</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Job</Badge>
                            )}
                            {getChannelIcon(item.channel)}
                            <span className="font-medium text-sm">
                              {item.type === "event" ? item.eventType : item.status}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {item.type === "event" && item.payload && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                            {typeof item.payload === "object" 
                              ? JSON.stringify(item.payload).substring(0, 100) 
                              : String(item.payload).substring(0, 100)}
                            {(typeof item.payload === "object" ? JSON.stringify(item.payload) : String(item.payload)).length > 100 && "..."}
                          </div>
                        )}
                        {item.type === "job" && (
                          <div className="text-xs space-y-1">
                            {item.runAt && (
                              <div className="text-muted-foreground">
                                Scheduled: {format(new Date(item.runAt), "MMM d, h:mm a")}
                              </div>
                            )}
                            {item.retryCount !== undefined && (
                              <div className="text-muted-foreground">
                                Retries: {item.retryCount}/{item.maxRetries}
                              </div>
                            )}
                            {item.lastError && (
                              <div className="text-red-500">
                                Error: {item.lastError.substring(0, 100)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
