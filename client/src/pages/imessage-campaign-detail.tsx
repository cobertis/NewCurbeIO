import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CampaignFormDialog } from "@/components/campaigns/campaign-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronLeft,
  Edit,
  Play,
  Pause,
  Square,
  MessageSquare,
  Users,
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { type ImessageCampaign, type ImessageCampaignRun, type ImessageCampaignMessage, type ContactList } from "@shared/schema";
import { format } from "date-fns";

// Status badge color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "secondary";
    case "running":
      return "default";
    case "paused":
      return "outline";
    case "stopped":
      return "destructive";
    case "completed":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
};

const getStatusLabel = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

// Run status badge color
const getRunStatusColor = (status: string) => {
  switch (status) {
    case "running":
      return "default";
    case "paused":
      return "outline";
    case "completed":
      return "default";
    case "stopped":
      return "destructive";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
};

// Message status badge color
const getMessageStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "secondary";
    case "queued":
      return "outline";
    case "sent":
      return "default";
    case "delivered":
      return "default";
    case "failed":
      return "destructive";
    case "skipped":
      return "outline";
    default:
      return "secondary";
  }
};

export default function ImessageCampaignDetail() {
  const [, params] = useRoute("/imessage-campaigns/:id");
  const campaignId = params?.id;
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  // Fetch campaign details
  const { data: campaignData, isLoading: isLoadingCampaign } = useQuery<{
    campaign: ImessageCampaign & { targetListName?: string };
  }>({
    queryKey: [`/api/imessage/campaigns/${campaignId}`],
    enabled: !!campaignId,
  });

  // Fetch campaign runs
  const { data: runsData, isLoading: isLoadingRuns } = useQuery<ImessageCampaignRun[]>({
    queryKey: [`/api/imessage/campaigns/${campaignId}/runs`],
    enabled: !!campaignId,
  });

  // Fetch run details (messages) for selected run
  const { data: runDetailsData } = useQuery<{
    messages: Array<ImessageCampaignMessage & { contactName?: string }>;
    statusStats: { sent: number; delivered: number; failed: number; pending: number; skipped: number };
  }>({
    queryKey: [`/api/imessage/campaigns/runs/${selectedRunId}`],
    enabled: !!selectedRunId,
  });

  // Fetch contact lists
  const { data: listsData } = useQuery<{ lists: ContactList[] }>({
    queryKey: ["/api/contact-lists"],
  });

  const campaign = campaignData?.campaign;
  const runs = runsData || [];
  const runMessages = runDetailsData?.messages || [];
  const runStats = runDetailsData?.statusStats || { sent: 0, delivered: 0, failed: 0, pending: 0, skipped: 0 };
  const lists = listsData?.lists || [];

  // Helper to get list name
  const getListName = (listId: string | null) => {
    if (!listId) return "All Contacts";
    const list = lists.find((l) => l.id === listId);
    return list?.name || "Unknown List";
  };

  // Start campaign mutation
  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/imessage/campaigns/${campaignId}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/campaigns/${campaignId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign started successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Pause campaign mutation
  const pauseMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/imessage/campaigns/${campaignId}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/campaigns/${campaignId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign paused successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pause campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Resume campaign mutation
  const resumeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/imessage/campaigns/${campaignId}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/campaigns/${campaignId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign resumed successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resume campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Stop campaign mutation
  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/imessage/campaigns/${campaignId}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/imessage/campaigns/${campaignId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign stopped successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to stop campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const toggleRunExpanded = (runId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }
    } else {
      newExpanded.add(runId);
      setSelectedRunId(runId);
    }
    setExpandedRuns(newExpanded);
  };

  // Calculate stats from latest run
  const latestRun = runs[0]; // Runs are sorted by most recent first
  const totalContacts = latestRun?.totalContacts || 0;
  const sentCount = latestRun?.sentCount || 0;
  const failedCount = latestRun?.failedCount || 0;
  const pendingCount = totalContacts - sentCount - failedCount - (latestRun?.skippedCount || 0);

  if (isLoadingCampaign) {
    return <LoadingSpinner message="Loading campaign..." fullScreen={true} />;
  }

  if (!campaign) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Campaign not found</h3>
          <p className="text-muted-foreground mt-2">
            The campaign you're looking for doesn't exist or has been deleted.
          </p>
          <Link href="/imessage-campaigns">
            <Button className="mt-4">Back to Campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/imessage-campaigns">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-campaign-name">
                {campaign.name}
              </h1>
              <Badge
                variant={getStatusColor(campaign.status)}
                className={campaign.status === "completed" ? "bg-green-600 text-white hover:bg-green-700" : ""}
                data-testid="badge-campaign-status"
              >
                {getStatusLabel(campaign.status)}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFormOpen(true)}
            data-testid="button-edit-campaign"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>

          {(campaign.status === "draft" || campaign.status === "stopped") && (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="button-start-campaign"
            >
              {startMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}

          {campaign.status === "running" && (
            <>
              <Button
                variant="outline"
                onClick={() => pauseMutation.mutate()}
                disabled={pauseMutation.isPending}
                data-testid="button-pause-campaign"
              >
                {pauseMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button
                variant="destructive"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                data-testid="button-stop-campaign"
              >
                {stopMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}

          {campaign.status === "paused" && (
            <>
              <Button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                data-testid="button-resume-campaign"
              >
                {resumeMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
              <Button
                variant="destructive"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                data-testid="button-stop-campaign-paused"
              >
                {stopMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total-contacts">
              {totalContacts}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-sent">
              {sentCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-pending">
              {pendingCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-failed">
              {failedCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium" data-testid="text-stat-last-run">
              {latestRun?.startedAt
                ? format(new Date(latestRun.startedAt), "MMM d, yyyy")
                : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Runs History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Runs History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingRuns ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner fullScreen={false} className="h-8 w-8" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No runs yet</h3>
              <p className="text-muted-foreground mt-2">
                Start the campaign to begin sending messages
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const completionPercentage = run.totalContacts > 0
                  ? Math.round(((run.sentCount + run.failedCount + run.skippedCount) / run.totalContacts) * 100)
                  : 0;
                const isExpanded = expandedRuns.has(run.id);

                return (
                  <Collapsible key={run.id} open={isExpanded} onOpenChange={() => toggleRunExpanded(run.id)}>
                    <CollapsibleTrigger asChild>
                      <div
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                        data-testid={`row-run-${run.id}`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="font-medium">Run #{run.runNumber}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(run.startedAt), "MMM d, yyyy h:mm a")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <Badge variant={getRunStatusColor(run.status)} data-testid={`badge-run-status-${run.id}`}>
                            {getStatusLabel(run.status)}
                          </Badge>
                          <div className="text-sm text-muted-foreground" data-testid={`text-run-progress-${run.id}`}>
                            {run.sentCount}/{run.totalContacts}
                          </div>
                          <div className="text-sm font-medium w-16 text-right" data-testid={`text-run-completion-${run.id}`}>
                            {completionPercentage}%
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {selectedRunId === run.id && (
                        <div className="mt-2 p-4 border rounded-lg bg-muted/50 space-y-4">
                          {/* Message Status Breakdown */}
                          <div>
                            <h4 className="font-semibold mb-2">Message Status</h4>
                            <div className="grid grid-cols-5 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Sent:</span> {runStats.sent}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Delivered:</span> {runStats.delivered}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Pending:</span> {runStats.pending}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Failed:</span> {runStats.failed}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Skipped:</span> {runStats.skipped}
                              </div>
                            </div>
                          </div>

                          {/* Messages Table */}
                          {runMessages.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-2">Messages</h4>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Contact</TableHead>
                                      <TableHead>Phone</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Attempted At</TableHead>
                                      <TableHead>Failure Reason</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {runMessages.map((message) => (
                                      <TableRow key={message.id}>
                                        <TableCell>{message.contactName || "Unknown"}</TableCell>
                                        <TableCell>{message.phone}</TableCell>
                                        <TableCell>
                                          <Badge variant={getMessageStatusColor(message.sendStatus)}>
                                            {getStatusLabel(message.sendStatus)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {message.attemptedAt
                                            ? format(new Date(message.attemptedAt), "MMM d, h:mm a")
                                            : "-"}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                          {message.failureReason || "-"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Campaign Name</label>
              <p className="text-base mt-1" data-testid="text-settings-name">{campaign.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Message Template</label>
              <p className="text-base mt-1 whitespace-pre-wrap" data-testid="text-settings-message">
                {campaign.messageBody}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Target List</label>
              <p className="text-base mt-1" data-testid="text-settings-target">
                {getListName(campaign.targetListId)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Form Dialog */}
      <CampaignFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        campaign={campaign}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/imessage/campaigns/${campaignId}`] });
          queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
        }}
      />
    </div>
  );
}
