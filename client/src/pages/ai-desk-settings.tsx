import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsLayout } from "@/components/settings-layout";
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
  CheckCircle2,
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
  BarChart3,
  PlayCircle,
  Eye,
  Layers,
  Hash,
  Copy,
  Check
} from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface KbChunk {
  id: string;
  documentId: string;
  documentTitle: string | null;
  documentUrl: string | null;
  chunkIndex: number;
  content: string;
  createdAt: string | null;
}

const sourceFormSchema = z.object({
  type: z.literal("url"),
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  maxPages: z.number().min(1).max(200).optional(),
  sameDomainOnly: z.boolean().optional(),
});

type SourceFormValues = z.infer<typeof sourceFormSchema>;

const multiUrlFormSchema = z.object({
  urls: z.array(z.string().url("Must be a valid URL")).min(1, "At least one URL is required"),
  maxPages: z.number().min(1).max(200).optional(),
  sameDomainOnly: z.boolean().optional(),
});

type MultiUrlFormValues = z.infer<typeof multiUrlFormSchema>;

interface AiDeskSettingsProps {
  embedded?: boolean;
}

export default function AiDeskSettingsPage({ embedded = false }: AiDeskSettingsProps) {
  const { toast } = useToast();
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<KbSource | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewChunksSource, setViewChunksSource] = useState<KbSource | null>(null);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [multiUrlSettings, setMultiUrlSettings] = useState({ maxPages: 25, sameDomainOnly: true });

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

  const { data: chunks, isLoading: chunksLoading } = useQuery<KbChunk[]>({
    queryKey: ["/api/ai/kb/sources", viewChunksSource?.id, "chunks"],
    queryFn: async () => {
      if (!viewChunksSource) return [];
      const res = await fetch(`/api/ai/kb/sources/${viewChunksSource.id}/chunks`);
      return res.json();
    },
    enabled: !!viewChunksSource,
  });

  const copyToClipboard = async (text: string, chunkId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedChunkId(chunkId);
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

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
        config: { 
          maxPages: data.maxPages || 25, 
          sameDomainOnly: data.sameDomainOnly ?? true 
        },
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

  const createMultipleSourcesMutation = useMutation({
    mutationFn: async (data: { urls: string[]; maxPages: number; sameDomainOnly: boolean }) => {
      const results = [];
      for (const url of data.urls) {
        try {
          const hostname = new URL(url).hostname.replace('www.', '');
          const res = await apiRequest("POST", "/api/ai/kb/sources", {
            type: "url",
            name: hostname,
            url,
            config: { 
              maxPages: data.maxPages || 25, 
              sameDomainOnly: data.sameDomainOnly ?? true 
            },
          });
          const source = await res.json();
          results.push(source);
          // Auto-sync the source immediately after creation
          try {
            await apiRequest("POST", `/api/ai/kb/sources/${source.id}/sync`);
          } catch {
            // Silently continue if sync fails
          }
        } catch {
          // Silently continue - we'll show success for whatever worked
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/kb/sources"] });
      if (results.length > 0) {
        toast({ title: `${results.length} source(s) added and syncing` });
      }
      setIsSourceDialogOpen(false);
      setUrlInputs(['']);
      setMultiUrlSettings({ maxPages: 25, sameDomainOnly: true });
    },
    onError: () => {
      // Just close and refresh - no error toast
      queryClient.invalidateQueries({ queryKey: ["/api/ai/kb/sources"] });
      setIsSourceDialogOpen(false);
      setUrlInputs(['']);
      setMultiUrlSettings({ maxPages: 25, sameDomainOnly: true });
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

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", selectedFile.name.replace(/\.[^/.]+$/, ""));
      
      const res = await fetch("/api/ai/kb/sources/file", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/ai/kb/sources"] });
      toast({ title: "Document uploaded successfully" });
      setIsDocumentDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      toast({ 
        title: "Failed to upload document", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const sourceForm = useForm<SourceFormValues>({
    resolver: zodResolver(sourceFormSchema),
    defaultValues: {
      type: "url",
      name: "",
      url: "",
      maxPages: 25,
      sameDomainOnly: true,
    },
  });

  // Show settings directly if embedded or if there are existing sources
  const hasExistingSources = (sources?.length ?? 0) > 0;
  const [showSettings, setShowSettings] = useState(hasExistingSources);
  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [sourceType, setSourceType] = useState<"url" | "document" | null>(null);

  if (settingsLoading) {
    if (embedded) {
      return <LoadingSpinner message="Loading AI settings..." />;
    }
    return (
      <SettingsLayout activeSection="ai-desk">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ok":
      case "ready":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
      case "queued":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Queued</Badge>;
      case "syncing":
        return <Badge variant="secondary"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Syncing</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Idle</Badge>;
    }
  };

  const handleGetStarted = () => {
    setShowAddSourceDialog(true);
  };

  const handleSelectSourceType = (type: "url" | "document") => {
    setSourceType(type);
    setShowAddSourceDialog(false);
    if (type === "url") {
      setIsSourceDialogOpen(true);
    } else if (type === "document") {
      setIsDocumentDialogOpen(true);
    }
    setShowSettings(true);
  };

  const landingPageContent = (
    <>
      <div className="space-y-8" data-testid="page-ai-desk">
        {!embedded && (
          <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-ai-desk">
            <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">AI Desk</span>
          </div>
        )}
        
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6 md:py-8 md:px-[10%]">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Respond faster with AI assistant
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Help your team respond quickly using AI-powered replies based on your knowledge base. Upload documents, manage sources, and boost productivity with instant, accurate answers.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Answer questions instantly using AI</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Get replies from your trusted sources</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Add and update knowledge anytime</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button 
                    onClick={handleGetStarted}
                    data-testid="button-get-started"
                  >
                    Get started
                  </Button>
                  <Button 
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open("https://support.curbe.io/ai-desk", "_blank")}
                    data-testid="button-watch-tutorial"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Watch tutorial
                  </Button>
                </div>
              </div>
              
              <div className="w-full md:w-96 shrink-0">
                <img 
                  src={aiDeskHeroImage} 
                  alt="AI Desk Assistant interface preview"
                  className="w-full h-auto rounded-lg"
                  data-testid="img-ai-desk-hero"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">AI Desk FAQ</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Haven't found what you were looking for?{" "}
              <a 
                href="https://support.curbe.io/contact" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                data-testid="link-contact-us"
              >
                Contact us
              </a>
            </p>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="what-is" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
              <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-what-is">
                What is AI Desk?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                AI Desk is a smart assistant that helps you get accurate answers to your questions based on the knowledge you provide. Simply upload documents or share links to create a custom knowledge base.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="who-for" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
              <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-who-for">
                Who is AI Desk for?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                AI Desk is designed for teams and individuals who need fast access to information, whether it's for customer support, team collaboration, or personal productivity.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="how-works" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
              <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-how-works">
                How does AI Desk work?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                AI Desk uses the content you upload - such as files, documents, or links - and uses advanced AI to answer your questions based on that information. It learns from your sources to provide relevant, accurate responses.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="copilot" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
              <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-copilot">
                What is Copilot mode?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                Copilot mode generates draft reply suggestions for your agents to review and edit before sending. It helps speed up responses while keeping humans in control of the final message.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="autopilot" className="border border-slate-200 dark:border-slate-800 rounded-lg px-4">
              <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-autopilot">
                What is Autopilot mode?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                Autopilot mode allows AI to automatically respond to messages when it's confident enough. Responses that need human review are held for approval before being sent.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
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
    </>
  );

  if (!showSettings && !hasExistingSources) {
    if (embedded) {
      return landingPageContent;
    }
    return (
      <SettingsLayout activeSection="ai-desk">
        {landingPageContent}
      </SettingsLayout>
    );
  }

  const settingsContent = (
    <div className="space-y-6" data-testid="page-ai-desk-settings">
      {!embedded && (
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-ai-desk-settings">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">AI Desk</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-ai-desk-settings">AI Desk Settings</h1>
          <p className="text-muted-foreground">Configure AI-powered support for your team</p>
        </div>
        {!embedded && !hasExistingSources && (
          <Button variant="outline" onClick={() => setShowSettings(false)} data-testid="button-back">
            Back
          </Button>
        )}
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
            <Button onClick={() => setShowAddSourceDialog(true)} data-testid="button-add-source">
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
                  onClick={() => setShowAddSourceDialog(true)}
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
                        {source.type === "file" ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <Globe className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {source.type === "file" ? "Uploaded document" : source.url}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(source.status)}
                          <span className="text-xs text-muted-foreground">
                            {source.type === "url" ? `${source.pagesCount} pages` : ""} {source.chunksCount} chunks
                          </span>
                          {source.lastSyncedAt && (
                            <span className="text-xs text-muted-foreground">
                              Last synced: {new Date(source.lastSyncedAt).toLocaleDateString()}
                            </span>
                          )}
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
                        onClick={() => setViewChunksSource(source)}
                        disabled={source.chunksCount === 0}
                        data-testid={`button-view-${source.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncSourceMutation.mutate(source.id)}
                        disabled={source.status === "syncing" || source.status === "queued" || syncSourceMutation.isPending}
                        data-testid={`button-sync-${source.id}`}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${source.status === "syncing" ? "animate-spin" : ""}`} />
                        {source.status === "queued" ? "Queued" : "Sync"}
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

      <Dialog open={isSourceDialogOpen} onOpenChange={(open) => {
        setIsSourceDialogOpen(open);
        if (!open) {
          setUrlInputs(['']);
          setMultiUrlSettings({ maxPages: 25, sameDomainOnly: true });
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add website link</DialogTitle>
            <DialogDescription>
              Add one or more website URLs for AI to crawl and learn from
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">URL</span>
                <span className="text-destructive">*</span>
              </div>
              {urlInputs.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="https://www.example.com"
                    value={url}
                    onChange={(e) => {
                      const newUrls = [...urlInputs];
                      newUrls[index] = e.target.value;
                      setUrlInputs(newUrls);
                    }}
                    data-testid={`input-url-${index}`}
                  />
                  {urlInputs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newUrls = urlInputs.filter((_, i) => i !== index);
                        setUrlInputs(newUrls);
                      }}
                      data-testid={`button-remove-url-${index}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="link"
                className="text-primary p-0 h-auto"
                onClick={() => setUrlInputs([...urlInputs, ''])}
                data-testid="button-add-another-url"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add another
              </Button>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="settings" className="border rounded-lg px-3">
                <AccordionTrigger className="text-sm py-3">Advanced settings</AccordionTrigger>
                <AccordionContent className="space-y-4 pb-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max pages per URL</label>
                    <Input
                      type="number"
                      min={1}
                      max={200}
                      value={multiUrlSettings.maxPages}
                      onChange={(e) => setMultiUrlSettings(prev => ({ 
                        ...prev, 
                        maxPages: parseInt(e.target.value) || 25 
                      }))}
                      data-testid="input-multi-maxpages"
                    />
                    <p className="text-xs text-muted-foreground">Maximum pages to crawl per URL (1-200)</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium">Same domain only</label>
                      <p className="text-xs text-muted-foreground">Only crawl pages from the same domain</p>
                    </div>
                    <Switch
                      checked={multiUrlSettings.sameDomainOnly}
                      onCheckedChange={(checked) => setMultiUrlSettings(prev => ({ 
                        ...prev, 
                        sameDomainOnly: checked 
                      }))}
                      data-testid="switch-multi-same-domain"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsSourceDialogOpen(false);
                setUrlInputs(['']);
                setMultiUrlSettings({ maxPages: 25, sameDomainOnly: true });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const validUrls = urlInputs.filter(url => {
                  try {
                    new URL(url);
                    return true;
                  } catch {
                    return false;
                  }
                });
                if (validUrls.length === 0) {
                  toast({ title: "Please enter at least one valid URL", variant: "destructive" });
                  return;
                }
                createMultipleSourcesMutation.mutate({
                  urls: validUrls,
                  maxPages: multiUrlSettings.maxPages,
                  sameDomainOnly: multiUrlSettings.sameDomainOnly,
                });
              }}
              disabled={createMultipleSourcesMutation.isPending || urlInputs.every(u => !u.trim())}
              data-testid="button-submit-sources"
            >
              {createMultipleSourcesMutation.isPending ? <LoadingSpinner fullScreen={false} /> : "Save"}
            </Button>
          </DialogFooter>
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

      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document (PDF, DOCX, TXT, or MD) for AI to learn from
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById("file-upload")?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) setSelectedFile(file);
              }}
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
                data-testid="input-file-upload"
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-primary" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop your file here, or click to browse</p>
                  <p className="text-sm text-muted-foreground">Supports PDF, DOCX, TXT, and MD files (max 50MB)</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setIsDocumentDialogOpen(false); setSelectedFile(null); }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleFileUpload} 
              disabled={!selectedFile || isUploading}
              data-testid="button-upload-document"
            >
              {isUploading ? <LoadingSpinner fullScreen={false} /> : "Upload & Index"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Viewer Sheet */}
      <Sheet open={!!viewChunksSource} onOpenChange={(open) => !open && setViewChunksSource(null)}>
        <SheetContent className="sm:max-w-2xl overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Extracted Content
            </SheetTitle>
            <SheetDescription>
              {viewChunksSource?.name} - {chunks?.length || 0} chunks
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
            {chunksLoading ? (
              <div className="py-8">
                <LoadingSpinner fullScreen={false} message="Loading chunks..." />
              </div>
            ) : chunks && chunks.length > 0 ? (
              <div className="space-y-4 pb-4">
                {chunks.map((chunk, index) => (
                  <Card key={chunk.id} className="relative group" data-testid={`chunk-${chunk.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Hash className="w-4 h-4" />
                          <span>Chunk {index + 1}</span>
                          {chunk.documentTitle && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span className="truncate max-w-[200px]">{chunk.documentTitle}</span>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(chunk.content, chunk.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-copy-chunk-${chunk.id}`}
                        >
                          {copiedChunkId === chunk.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {chunk.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No content chunks found</p>
                <p className="text-sm">Try syncing the source to extract content</p>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );

  if (embedded) {
    return settingsContent;
  }

  return (
    <SettingsLayout activeSection="ai-desk">
      {settingsContent}
    </SettingsLayout>
  );
}
