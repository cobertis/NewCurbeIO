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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Play, Pause, StopCircle, RefreshCw, Users, Clock, ChevronRight, AlertCircle, CheckCircle, XCircle, Mail, MessageSquare, Phone, Sliders, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  breakdownByChannel: Record<string, {
    attempts: number;
    delivered: number;
    read: number;
    replied: number;
    failed: number;
    failedFinal: number;
    optOut: number;
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

export default function OrchestratorCampaigns() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<OrchestratorCampaign | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [selectedContact, setSelectedContact] = useState<CampaignContact | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [metricsWindow, setMetricsWindow] = useState<string>("7d");

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500" data-testid="badge-status-active">Active</Badge>;
      case "paused":
        return <Badge variant="secondary" data-testid="badge-status-paused">Paused</Badge>;
      case "draft":
        return <Badge variant="outline" data-testid="badge-status-draft">Draft</Badge>;
      case "completed":
        return <Badge className="bg-blue-500" data-testid="badge-status-completed">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStateBadge = (state: string) => {
    switch (state) {
      case "NEW":
        return <Badge variant="outline" data-testid="badge-state-new">New</Badge>;
      case "ATTEMPTING":
        return <Badge className="bg-yellow-500" data-testid="badge-state-attempting">Attempting</Badge>;
      case "ENGAGED":
        return <Badge className="bg-green-500" data-testid="badge-state-engaged">Engaged</Badge>;
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

  if (campaignsLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading campaigns..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Campaign Orchestrator</h1>
          <p className="text-muted-foreground">Manage outreach campaigns and contact journeys</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/campaigns"] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!selectedCampaign ? (
        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {!campaigns || campaigns.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No campaigns found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Attempting</TableHead>
                    <TableHead>Engaged</TableHead>
                    <TableHead>DNC</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow 
                      key={campaign.id} 
                      className="cursor-pointer hover:bg-muted/50"
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
                        {getStatusBadge(campaign.status)}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCampaign(campaign)}>
                        {campaign.stats?.total || 0}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCampaign(campaign)}>
                        {campaign.stats?.attempting || 0}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCampaign(campaign)}>
                        {campaign.stats?.engaged || 0}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCampaign(campaign)}>
                        {campaign.stats?.dnc || 0}
                      </TableCell>
                      <TableCell onClick={() => setSelectedCampaign(campaign)}>
                        {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {campaign.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); pauseMutation.mutate(campaign.id); }}
                              disabled={pauseMutation.isPending}
                              data-testid={`button-pause-${campaign.id}`}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {campaign.status === "paused" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); resumeMutation.mutate(campaign.id); }}
                              disabled={resumeMutation.isPending}
                              data-testid={`button-resume-${campaign.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCampaign(campaign)}
                            data-testid={`button-view-${campaign.id}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedCampaign(null)} data-testid="button-back">
              Back to Campaigns
            </Button>
            <h2 className="text-xl font-semibold" data-testid="text-campaign-detail-name">{selectedCampaign.name}</h2>
            {getStatusBadge(selectedCampaign.status)}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle data-testid="text-metrics-title">Metrics</CardTitle>
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
                <LoadingSpinner fullScreen={false} message="Loading metrics..." />
              ) : metricsData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold" data-testid="text-metric-attempts">{metricsData.attempts}</div>
                      <div className="text-sm text-muted-foreground">Attempts</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600" data-testid="text-metric-delivered">{metricsData.delivered}</div>
                      <div className="text-sm text-muted-foreground">Delivered</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600" data-testid="text-metric-replied">{metricsData.replied}</div>
                      <div className="text-sm text-muted-foreground">Replies</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600" data-testid="text-metric-optout">{metricsData.optOut}</div>
                      <div className="text-sm text-muted-foreground">Opt-outs</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-red-400" data-testid="text-metric-failed">{metricsData.failed}</div>
                      <div className="text-sm text-muted-foreground">Failed (All)</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600" data-testid="text-metric-failed-final">{metricsData.failedFinal}</div>
                      <div className="text-sm text-muted-foreground">Failed (Final)</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600" data-testid="text-metric-avg-reply">
                        {metricsData.avgTimeToReplySeconds !== null 
                          ? `${Math.round(metricsData.avgTimeToReplySeconds / 60)}m` 
                          : "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Reply Time</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="text-center p-2 border rounded">
                      <div className="text-lg font-semibold" data-testid="text-rate-delivery">{(metricsData.rates.deliveryRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Delivery Rate</div>
                    </div>
                    <div className="text-center p-2 border rounded">
                      <div className="text-lg font-semibold" data-testid="text-rate-reply">{(metricsData.rates.replyRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Reply Rate</div>
                    </div>
                    <div className="text-center p-2 border rounded">
                      <div className="text-lg font-semibold" data-testid="text-rate-optout">{(metricsData.rates.optOutRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Opt-out Rate</div>
                    </div>
                    <div className="text-center p-2 border rounded">
                      <div className="text-lg font-semibold" data-testid="text-rate-failure">{(metricsData.rates.failureRate * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Failure Rate (All)</div>
                    </div>
                    <div className="text-center p-2 border rounded">
                      <div className="text-lg font-semibold text-red-600" data-testid="text-rate-failure-final">{(metricsData.rates.failureRateFinal * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Failure Rate (Final)</div>
                    </div>
                  </div>

                  {Object.keys(metricsData.breakdownByChannel).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Breakdown by Channel</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Channel</TableHead>
                            <TableHead className="text-right">Attempts</TableHead>
                            <TableHead className="text-right">Delivered</TableHead>
                            <TableHead className="text-right">Replied</TableHead>
                            <TableHead className="text-right">Failed</TableHead>
                            <TableHead className="text-right">Final</TableHead>
                            <TableHead className="text-right">Opt-out</TableHead>
                          </TableRow>
                        </TableHeader>
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variant</TableHead>
                            <TableHead className="text-right">Attempts</TableHead>
                            <TableHead className="text-right">Delivered</TableHead>
                            <TableHead className="text-right">Replied</TableHead>
                            <TableHead className="text-right">Opt-out</TableHead>
                            <TableHead className="text-right">Delivery %</TableHead>
                            <TableHead className="text-right">Reply %</TableHead>
                          </TableRow>
                        </TableHeader>
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
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No metrics available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle data-testid="text-job-health-title">Job Health</CardTitle>
            </CardHeader>
            <CardContent>
              {jobMetricsLoading ? (
                <LoadingSpinner fullScreen={false} message="Loading job health..." />
              ) : jobMetricsData ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600" data-testid="text-jobs-queued">{jobMetricsData.queuedCount}</div>
                    <div className="text-sm text-muted-foreground">Queued</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600" data-testid="text-jobs-processing">{jobMetricsData.processingCount}</div>
                    <div className="text-sm text-muted-foreground">Processing</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600" data-testid="text-jobs-failed">{jobMetricsData.failedCount}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold" data-testid="text-jobs-avgretries">{jobMetricsData.avgRetryCount}</div>
                    <div className="text-sm text-muted-foreground">Avg Retries</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold" data-testid="text-jobs-oldest">
                      {jobMetricsData.oldestQueuedAgeSec !== null 
                        ? `${Math.round(jobMetricsData.oldestQueuedAgeSec / 60)}m` 
                        : "-"}
                    </div>
                    <div className="text-sm text-muted-foreground">Oldest Queued</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No job metrics available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-auto-tune-title">
                <Sliders className="h-5 w-5" />
                Auto-Tune (A/B Optimization)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {autoTuneLoading ? (
                <LoadingSpinner fullScreen={false} message="Loading auto-tune..." />
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
                            <span className="text-muted-foreground">
                              {m.attempts} attempts, reward: {m.reward.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Computed: {format(new Date(autoTuneData.computedAt), "MMM d, h:mm a")} ({autoTuneData.window} window)
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => applyMutation.mutate({ snapshotId: autoTuneData.id, mode: "replace" })}
                      disabled={applyMutation.isPending}
                      data-testid="button-apply-replace"
                    >
                      {applyMutation.isPending ? "Applying..." : "Apply (Replace)"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyMutation.mutate({ snapshotId: autoTuneData.id, mode: "blend", blendFactor: 0.5 })}
                      disabled={applyMutation.isPending}
                      data-testid="button-apply-blend"
                    >
                      Apply (50% Blend)
                    </Button>
                    {lastApplyData && 'id' in lastApplyData && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rollbackMutation.mutate(lastApplyData.id)}
                        disabled={rollbackMutation.isPending}
                        data-testid="button-rollback"
                      >
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contacts ({contactsData?.contacts?.length || 0})
              </CardTitle>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-48" data-testid="select-state-filter">
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
            <CardContent>
              {contactsLoading ? (
                <LoadingSpinner fullScreen={false} message="Loading contacts..." />
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
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setSelectedContact(contact); setTimelineOpen(true); }}
                        data-testid={`row-contact-${contact.id}`}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-contact-name-${contact.id}`}>
                              {contact.firstName} {contact.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {contact.phone || contact.email || "No contact info"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStateBadge(contact.state)}</TableCell>
                        <TableCell>
                          {contact.nextActionAt ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {format(new Date(contact.nextActionAt), "MMM d, h:mm a")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{contact.attemptsTotal || 0}</TableCell>
                        <TableCell>{contact.fatigueScore?.toFixed(2) || "-"}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(contact.updatedAt), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
                <LoadingSpinner fullScreen={false} message="Loading timeline..." />
              ) : !timelineData?.timeline || timelineData.timeline.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No timeline events</p>
              ) : (
                <div className="space-y-3 pr-4">
                  {timelineData.timeline.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="border rounded-lg p-3 space-y-1"
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
  );
}
