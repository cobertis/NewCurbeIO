import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Bot, 
  Brain, 
  BookOpen, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Database,
  History,
  CheckCheck,
  XCircle,
  ChevronRight,
  Globe,
  Upload,
  TrendingUp,
  Percent,
  Zap,
  ThumbsUp,
  ThumbsDown,
  BarChart3
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import aiDeskHeroImage from "@assets/image_1766776300912.png";

interface AiSettings {
  id: string;
  companyId: string;
  copilotEnabled: boolean;
  autopilotEnabled: boolean;
  confidenceThreshold: string;
  allowedTools: string[];
  escalationRules: Record<string, string>;
}

interface KbSource {
  id: string;
  companyId: string;
  type: string;
  name: string;
  url: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  pagesCount: number;
  chunksCount: number;
  createdAt: string;
}

interface UsageStats {
  totalRuns: number;
  copilotRuns: number;
  autopilotRuns: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  avgLatencyMs: number;
}

interface AiMetrics {
  overview: {
    totalRuns: number;
    copilotRuns: number;
    autopilotRuns: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    approvalRate: number;
    avgConfidence: number;
    avgLatencyMs: number;
    totalTokensIn: number;
    totalTokensOut: number;
  };
  rejectionReasons: { reason: string; count: number }[];
  intentDistribution: { intent: string; count: number }[];
  dailyStats: { date: string; runs: number; approved: number; rejected: number }[];
}

interface AiRun {
  id: string;
  companyId: string;
  conversationId: string | null;
  messageId: string | null;
  mode: string;
  status: string;
  intent: string | null;
  confidence: string | null;
  needsHuman: boolean;
  inputText: string;
  outputText: string | null;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  createdAt: string;
}

interface AiActionLog {
  id: string;
  runId: string;
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
  requiresApproval: boolean;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
}

const sourceFormSchema = z.object({
  type: z.literal("url"),
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  maxPages: z.number().min(1).max(100).optional(),
});

type SourceFormValues = z.infer<typeof sourceFormSchema>;

export default function AiDeskSettingsPage() {
  const { toast } = useToast();
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<KbSource | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery<AiSettings>({
    queryKey: ["/api/ai/settings"],
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery<KbSource[]>({
    queryKey: ["/api/ai/kb/sources"],
  });

  const { data: usage } = useQuery<UsageStats>({
    queryKey: ["/api/ai/usage"],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<AiMetrics>({
    queryKey: ["/api/ai/metrics"],
  });

  const { data: runs, isLoading: runsLoading } = useQuery<AiRun[]>({
    queryKey: ["/api/ai/runs"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AiSettings>) => {
      const res = await apiRequest("PATCH", "/api/ai/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/settings"] });
      toast({ title: "Settings updated" });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: async (data: SourceFormValues) => {
      const res = await apiRequest("POST", "/api/ai/kb/sources", {
        ...data,
        config: { maxPages: data.maxPages || 10, sameDomainOnly: true },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/kb/sources"] });
      toast({ title: "Source added" });
      setIsSourceDialogOpen(false);
      sourceForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to add source", variant: "destructive" });
    },
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const res = await apiRequest("POST", `/api/ai/kb/sources/${sourceId}/sync`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/kb/sources"] });
      toast({ title: "Sync started" });
    },
    onError: () => {
      toast({ title: "Failed to start sync", variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      await apiRequest("DELETE", `/api/ai/kb/sources/${sourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/kb/sources"] });
      toast({ title: "Source deleted" });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast({ title: "Failed to delete source", variant: "destructive" });
    },
  });

  const sourceForm = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      type: "url",
      name: "",
      url: "",
      maxPages: 10,
    },
  });

  if (settingsLoading) {
    return <LoadingSpinner message="Loading AI settings..." />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case "syncing":
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Syncing</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Idle</Badge>;
    }
  };

  const [showSettings, setShowSettings] = useState(false);
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [sourceType, setSourceType] = useState<"url" | "document" | null>(null);

  const handleGetStarted = () => {
    setShowAddSourceDialog(true);
  };

  const handleSelectSourceType = (type: "url" | "document") => {
    setSourceType(type);
    setShowAddSourceDialog(false);
    if (type === "url") {
      setIsSourceDialogOpen(true);
    }
    setShowSettings(true);
  };

  if (!showSettings) {
    return (
      <div className="space-y-8" data-testid="page-ai-desk">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <span>Settings</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">AI Desk</span>
        </div>

        <h1 className="text-2xl font-bold" data-testid="heading-ai-desk">AI Desk</h1>

        <Card className="border-0 shadow-none bg-slate-50 dark:bg-slate-900">
          <CardContent className="p-8">
            <div className="flex flex-col lg:flex-row items-start gap-8">
              <div className="flex-1 space-y-6">
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Respond faster with AI assistant</h2>
                  <p className="text-muted-foreground">
                    Help your team respond quickly using AI-powered replies based on your knowledge base. Upload
                    documents, manage sources, and boost productivity with instant, accurate answers.
                  </p>
                </div>

                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Answer questions instantly using AI</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Get replies from your trusted sources</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Add and update knowledge anytime</span>
                  </li>
                </ul>

                <div className="flex gap-3">
                  <Button onClick={handleGetStarted} data-testid="button-get-started">
                    Get started
                  </Button>
                  <Button variant="outline" data-testid="button-learn-more">
                    Learn more
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex justify-center">
                <img 
                  src={aiDeskHeroImage} 
                  alt="AI Desk Assistant" 
                  className="max-w-md w-full rounded-lg shadow-lg"
                  data-testid="img-ai-desk-hero"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">AI assistant FAQ</h2>
            <p className="text-muted-foreground">
              Haven't found what you were looking for?{" "}
              <a href="#" className="text-primary hover:underline">Contact us</a>
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full max-w-3xl mx-auto">
            <AccordionItem value="what-is">
              <AccordionTrigger className="text-left">What is AI Desk?</AccordionTrigger>
              <AccordionContent>
                AI Desk is a smart assistant that helps you get accurate answers to your questions based on the knowledge you provide. Simply upload documents or share links to create a custom knowledge base.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="who-for">
              <AccordionTrigger className="text-left">Who is AI Desk for?</AccordionTrigger>
              <AccordionContent>
                AI Desk is designed for teams and individuals who need fast access to information, whether it's for customer support, team collaboration, or personal productivity.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="how-works">
              <AccordionTrigger className="text-left">How does AI Desk work?</AccordionTrigger>
              <AccordionContent>
                AI Desk uses the content you upload - such as files, documents, or links - and uses advanced AI to answer your questions based on that information. It learns from your sources to provide relevant, accurate responses.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="copilot">
              <AccordionTrigger className="text-left">What is Copilot mode?</AccordionTrigger>
              <AccordionContent>
                Copilot mode generates draft reply suggestions for your agents to review and edit before sending. It helps speed up responses while keeping humans in control of the final message.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="autopilot">
              <AccordionTrigger className="text-left">What is Autopilot mode?</AccordionTrigger>
              <AccordionContent>
                Autopilot mode allows AI to automatically respond to messages when it's confident enough. Responses that need human review are held for approval before being sent.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Dialog open={showAddSourceDialog} onOpenChange={setShowAddSourceDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add source</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-6">
              <button
                onClick={() => handleSelectSourceType("url")}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-2 border-transparent hover:border-primary"
                data-testid="button-source-website"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Website link</p>
                  <p className="text-sm text-muted-foreground">Add link to a public website</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectSourceType("document")}
                className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-2 border-transparent hover:border-primary"
                data-testid="button-source-document"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold">Document</p>
                  <p className="text-sm text-muted-foreground">Upload a file from your computer</p>
                </div>
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddSourceDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-ai-desk-settings">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <button onClick={() => setShowSettings(false)} className="hover:text-foreground">Settings</button>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">AI Desk</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-ai-desk-settings">AI Desk Settings</h1>
          <p className="text-muted-foreground">Configure AI-powered support for your team</p>
        </div>
        <Button variant="outline" onClick={() => setShowSettings(false)} data-testid="button-back">
          Back
        </Button>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Bot className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="knowledge" data-testid="tab-knowledge">
            <BookOpen className="w-4 h-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="usage" data-testid="tab-usage">
            <Database className="w-4 h-4 mr-2" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <History className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Copilot
              </CardTitle>
              <CardDescription>
                AI drafts reply suggestions for your agents to review and send
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Copilot</p>
                  <p className="text-sm text-muted-foreground">Show AI draft suggestions when composing replies</p>
                </div>
                <Switch
                  checked={settings?.copilotEnabled ?? false}
                  onCheckedChange={(checked) =>
                    updateSettingsMutation.mutate({ copilotEnabled: checked })
                  }
                  data-testid="switch-copilot"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Autopilot
              </CardTitle>
              <CardDescription>
                AI automatically responds to messages when confident enough
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Autopilot</p>
                  <p className="text-sm text-muted-foreground">Allow AI to send replies automatically</p>
                </div>
                <Switch
                  checked={settings?.autopilotEnabled ?? false}
                  onCheckedChange={(checked) =>
                    updateSettingsMutation.mutate({ autopilotEnabled: checked })
                  }
                  data-testid="switch-autopilot"
                />
              </div>

              {settings?.autopilotEnabled && (
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between">
                    <p className="font-medium">Confidence Threshold</p>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(Number(settings.confidenceThreshold || 0.75) * 100)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI will only auto-respond when confidence is above this threshold
                  </p>
                  <Slider
                    value={[Number(settings.confidenceThreshold || 0.75) * 100]}
                    onValueChange={([value]) =>
                      updateSettingsMutation.mutate({ confidenceThreshold: (value / 100) as any })
                    }
                    max={100}
                    min={50}
                    step={5}
                    className="w-full"
                    data-testid="slider-confidence"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Knowledge Sources</h3>
              <p className="text-sm text-muted-foreground">
                Add websites or documents for AI to learn from
              </p>
            </div>
            <Button onClick={() => setIsSourceDialogOpen(true)} data-testid="button-add-source">
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>

          {sourcesLoading ? (
            <LoadingSpinner fullScreen={false} />
          ) : sources?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No knowledge sources added yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsSourceDialogOpen(true)}
                  data-testid="button-add-first-source"
                >
                  Add your first source
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sources?.map((source) => (
                <Card key={source.id} data-testid={`card-source-${source.id}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        <ExternalLink className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {source.url}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(source.status)}
                          <span className="text-xs text-muted-foreground">
                            {source.pagesCount} pages | {source.chunksCount} chunks
                          </span>
                        </div>
                        {source.lastError && (
                          <p className="text-xs text-destructive mt-1">{source.lastError}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncSourceMutation.mutate(source.id)}
                        disabled={source.status === "syncing" || syncSourceMutation.isPending}
                        data-testid={`button-sync-${source.id}`}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${source.status === "syncing" ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(source)}
                        data-testid={`button-delete-${source.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          {metricsLoading ? (
            <LoadingSpinner fullScreen={false} message="Loading metrics..." />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card data-testid="card-total-runs">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Total AI Runs
                    </CardDescription>
                    <CardTitle className="text-3xl">{metrics?.overview.totalRuns ?? 0}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {metrics?.overview.copilotRuns ?? 0} Copilot
                      </span>
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        {metrics?.overview.autopilotRuns ?? 0} Autopilot
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-approval-rate">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Percent className="w-4 h-4" />
                      Approval Rate
                    </CardDescription>
                    <CardTitle className="text-3xl">{metrics?.overview.approvalRate ?? 0}%</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 text-green-600">
                        <ThumbsUp className="w-3 h-3" />
                        {metrics?.overview.approved ?? 0}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <ThumbsDown className="w-3 h-3" />
                        {metrics?.overview.rejected ?? 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-avg-confidence">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <BarChart3 className="w-4 h-4" />
                      Avg Confidence
                    </CardDescription>
                    <CardTitle className="text-3xl">{metrics?.overview.avgConfidence ?? 0}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card data-testid="card-avg-latency">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      Avg Latency
                    </CardDescription>
                    <CardTitle className="text-3xl">
                      {metrics?.overview.avgLatencyMs ? `${metrics.overview.avgLatencyMs}ms` : "-"}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card data-testid="card-pending-approval">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Pending Approval
                    </CardDescription>
                    <CardTitle className="text-3xl">{metrics?.overview.pendingApproval ?? 0}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-intent-distribution">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Intent Distribution
                    </CardTitle>
                    <CardDescription>Top intents from AI runs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metrics?.intentDistribution && metrics.intentDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={metrics.intentDistribution} layout="vertical" margin={{ left: 20, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                          <XAxis type="number" />
                          <YAxis 
                            dataKey="intent" 
                            type="category" 
                            width={100} 
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 15)}...` : value}
                          />
                          <Tooltip 
                            contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            labelStyle={{ fontWeight: 'bold' }}
                          />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>No intent data available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-rejection-reasons">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="w-5 h-5" />
                      Rejection Reasons
                    </CardTitle>
                    <CardDescription>Why responses were rejected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {metrics?.rejectionReasons && metrics.rejectionReasons.length > 0 ? (
                      <div className="space-y-3">
                        {metrics.rejectionReasons.map((item, index) => (
                          <div key={index} className="flex items-center justify-between" data-testid={`rejection-reason-${index}`}>
                            <span className="text-sm truncate max-w-[200px]" title={item.reason}>
                              {item.reason}
                            </span>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                        <div className="text-center">
                          <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-20 text-green-500" />
                          <p>No rejections recorded</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-token-usage">
                <CardHeader>
                  <CardTitle>Token Usage</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Input Tokens</p>
                      <p className="text-2xl font-bold">{(metrics?.overview.totalTokensIn ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Output Tokens</p>
                      <p className="text-2xl font-bold">{(metrics?.overview.totalTokensOut ?? 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tokens</p>
                      <p className="text-2xl font-bold">
                        {((metrics?.overview.totalTokensIn ?? 0) + (metrics?.overview.totalTokensOut ?? 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent AI Activity
              </CardTitle>
              <CardDescription>
                View recent AI runs, responses, and tool executions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <LoadingSpinner fullScreen={false} message="Loading activity..." />
              ) : runs && runs.length > 0 ? (
                <div className="space-y-4">
                  {runs.slice(0, 20).map((run) => (
                    <div
                      key={run.id}
                      className="border rounded-lg p-4 space-y-3"
                      data-testid={`activity-run-${run.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {run.mode === "copilot" ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Copilot
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              <Brain className="w-3 h-3 mr-1" />
                              Autopilot
                            </Badge>
                          )}
                          <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                            {run.status === "completed" && <CheckCheck className="w-3 h-3 mr-1" />}
                            {run.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                            {run.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                            {run.status}
                          </Badge>
                          {run.needsHuman && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              Needs Human
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm">
                        <div>
                          <span className="font-medium">Input:</span>
                          <p className="text-muted-foreground truncate max-w-xl">{run.inputText}</p>
                        </div>
                        {run.outputText && (
                          <div>
                            <span className="font-medium">Output:</span>
                            <p className="text-muted-foreground truncate max-w-xl">{run.outputText}</p>
                          </div>
                        )}
                        {run.intent && (
                          <div>
                            <span className="font-medium">Intent:</span>{" "}
                            <span className="text-muted-foreground">{run.intent}</span>
                            {run.confidence && (
                              <span className="text-muted-foreground ml-2">
                                ({(parseFloat(run.confidence) * 100).toFixed(0)}% confidence)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Model: {run.model}</span>
                        {run.tokensIn !== null && <span>Tokens in: {run.tokensIn}</span>}
                        {run.tokensOut !== null && <span>Tokens out: {run.tokensOut}</span>}
                        {run.latencyMs !== null && <span>Latency: {run.latencyMs}ms</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No AI activity yet</p>
                  <p className="text-sm">AI runs will appear here when Copilot or Autopilot is used</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isSourceDialogOpen} onOpenChange={setIsSourceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Knowledge Source</DialogTitle>
            <DialogDescription>
              Add a website URL for AI to crawl and learn from
            </DialogDescription>
          </DialogHeader>
          <Form {...sourceForm}>
            <form onSubmit={sourceForm.handleSubmit((data) => createSourceMutation.mutate(data))} className="space-y-4">
              <FormField
                control={sourceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Help Center" {...field} data-testid="input-source-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sourceForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://help.example.com" {...field} data-testid="input-source-url" />
                    </FormControl>
                    <FormDescription>The starting URL to crawl</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={sourceForm.control}
                name="maxPages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Pages</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                        data-testid="input-source-maxpages"
                      />
                    </FormControl>
                    <FormDescription>Maximum number of pages to crawl (1-100)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsSourceDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSourceMutation.isPending} data-testid="button-submit-source">
                  {createSourceMutation.isPending ? <LoadingSpinner fullScreen={false} /> : "Add Source"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This will also remove all ingested documents and chunks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteSourceMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
