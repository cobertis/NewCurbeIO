import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Play,
  Pause,
  Square,
  Edit,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
} from "lucide-react";
import { type ImessageCampaign, type ContactList } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";

// Status badge color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case "draft":
      return "secondary"; // gray
    case "running":
      return "default"; // blue
    case "paused":
      return "outline"; // yellow/muted
    case "stopped":
      return "destructive"; // red
    case "completed":
      return "default"; // green (we'll use custom class)
    case "failed":
      return "destructive"; // red
    default:
      return "secondary";
  }
};

const getStatusLabel = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function ImessageCampaigns() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<ImessageCampaign | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);

  // Fetch campaigns
  const { data: campaignsData, isLoading } = useQuery<{
    campaigns: Array<ImessageCampaign & { lastRunAt?: string; runsCount: number; targetListName?: string }>;
    stats: { total: number; active: number; completed: number; draft: number };
  }>({
    queryKey: ["/api/imessage/campaigns"],
  });

  // Fetch contact lists for display
  const { data: listsData } = useQuery<{ lists: ContactList[] }>({
    queryKey: ["/api/contact-lists"],
  });

  const campaigns = campaignsData?.campaigns || [];
  const stats = campaignsData?.stats || { total: 0, active: 0, completed: 0, draft: 0 };
  const lists = listsData?.lists || [];

  // Helper to get list name by ID
  const getListName = (listId: string | null) => {
    if (!listId) return "All Contacts";
    const list = lists.find((l) => l.id === listId);
    return list?.name || "Unknown List";
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/imessage/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      setDeleteCampaignId(null);
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Start campaign mutation
  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/start`),
    onSuccess: () => {
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
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/pause`),
    onSuccess: () => {
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
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/resume`),
    onSuccess: () => {
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
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/stop`),
    onSuccess: () => {
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

  const handleEdit = (campaign: ImessageCampaign) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };

  const handleDelete = (campaign: ImessageCampaign) => {
    // Only allow deletion of draft campaigns
    if (campaign.status !== "draft") {
      toast({
        title: "Cannot Delete",
        description: "Only draft campaigns can be deleted",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    setDeleteCampaignId(campaign.id);
  };

  const handleStart = (campaign: ImessageCampaign) => {
    if (campaign.status !== "draft" && campaign.status !== "stopped") {
      toast({
        title: "Cannot Start",
        description: "Campaign is already running or completed",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    startMutation.mutate(campaign.id);
  };

  const handlePause = (campaign: ImessageCampaign) => {
    if (campaign.status !== "running") {
      toast({
        title: "Cannot Pause",
        description: "Only running campaigns can be paused",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    pauseMutation.mutate(campaign.id);
  };

  const handleResume = (campaign: ImessageCampaign) => {
    if (campaign.status !== "paused") {
      toast({
        title: "Cannot Resume",
        description: "Only paused campaigns can be resumed",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    resumeMutation.mutate(campaign.id);
  };

  const handleStop = (campaign: ImessageCampaign) => {
    if (campaign.status !== "running" && campaign.status !== "paused") {
      toast({
        title: "Cannot Stop",
        description: "Campaign is not active",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    stopMutation.mutate(campaign.id);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading campaigns..." fullScreen={true} />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            iMessage Campaigns
          </h1>
          <p className="text-muted-foreground">
            Manage and monitor your iMessage marketing campaigns
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCampaign(null);
            setIsFormOpen(true);
          }}
          data-testid="button-new-campaign"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-active">
              {stats.active}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-completed">
              {stats.completed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-draft">
              {stats.draft}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No campaigns yet</h3>
              <p className="text-muted-foreground mt-2">
                Create your first iMessage campaign to get started
              </p>
              <Button
                onClick={() => {
                  setEditingCampaign(null);
                  setIsFormOpen(true);
                }}
                className="mt-4"
                data-testid="button-create-first"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message Preview</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/imessage-campaigns/${campaign.id}`}
                        className="hover:underline"
                        data-testid={`link-campaign-${campaign.id}`}
                      >
                        {campaign.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusColor(campaign.status)}
                        className={campaign.status === "completed" ? "bg-green-600 text-white hover:bg-green-700" : ""}
                        data-testid={`badge-status-${campaign.id}`}
                      >
                        {getStatusLabel(campaign.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" data-testid={`text-message-${campaign.id}`}>
                      {campaign.messageBody.length > 60
                        ? `${campaign.messageBody.substring(0, 60)}...`
                        : campaign.messageBody}
                    </TableCell>
                    <TableCell data-testid={`text-target-${campaign.id}`}>
                      {getListName(campaign.targetListId)}
                    </TableCell>
                    <TableCell data-testid={`text-last-run-${campaign.id}`}>
                      {campaign.lastRunAt
                        ? format(new Date(campaign.lastRunAt), "MMM d, yyyy h:mm a")
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-runs-count-${campaign.id}`}>
                      {campaign.runsCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-actions-${campaign.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEdit(campaign)}
                            data-testid={`button-edit-${campaign.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          
                          {(campaign.status === "draft" || campaign.status === "stopped") && (
                            <DropdownMenuItem
                              onClick={() => handleStart(campaign)}
                              data-testid={`button-start-${campaign.id}`}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start
                            </DropdownMenuItem>
                          )}

                          {campaign.status === "running" && (
                            <DropdownMenuItem
                              onClick={() => handlePause(campaign)}
                              data-testid={`button-pause-${campaign.id}`}
                            >
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          )}

                          {campaign.status === "paused" && (
                            <DropdownMenuItem
                              onClick={() => handleResume(campaign)}
                              data-testid={`button-resume-${campaign.id}`}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}

                          {(campaign.status === "running" || campaign.status === "paused") && (
                            <DropdownMenuItem
                              onClick={() => handleStop(campaign)}
                              data-testid={`button-stop-${campaign.id}`}
                            >
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                          )}

                          {campaign.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(campaign)}
                              className="text-destructive"
                              data-testid={`button-delete-${campaign.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Campaign Form Dialog */}
      <CampaignFormDialog
        open={isFormOpen}
        onOpenChange={handleFormClose}
        campaign={editingCampaign}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={() => setDeleteCampaignId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the campaign.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCampaignId) {
                  deleteMutation.mutate(deleteCampaignId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
