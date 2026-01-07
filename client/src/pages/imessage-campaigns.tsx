import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CampaignBuilderWizard } from "@/components/campaigns/campaign-builder-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Play,
  Pause,
  Square,
  Edit,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  TrendingUp,
  Users,
  BarChart3,
  Search,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown,
  Eye,
  Copy,
  Calendar,
} from "lucide-react";
import { type ImessageCampaign, type ContactList } from "@shared/schema";
import { format } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// Status configuration with colors and icons
const statusConfig = {
  draft: {
    label: "Draft",
    color: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20",
    icon: Clock,
    dotColor: "bg-gray-500",
  },
  running: {
    label: "Running",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    icon: Play,
    dotColor: "bg-blue-500 animate-pulse",
  },
  paused: {
    label: "Paused",
    color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20",
    icon: Pause,
    dotColor: "bg-yellow-500",
  },
  stopped: {
    label: "Stopped",
    color: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    icon: Square,
    dotColor: "bg-red-500",
  },
  completed: {
    label: "Completed",
    color: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
    icon: CheckCircle2,
    dotColor: "bg-green-500",
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    icon: Square,
    dotColor: "bg-red-500",
  },
};

export default function ImessageCampaigns() {
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<ImessageCampaign | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [listFilter, setListFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "date" | "status">("date");

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

  // Filtered and sorted campaigns
  const filteredCampaigns = useMemo(() => {
    // Create a copy to avoid mutating the original array
    let filtered = [...campaigns];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messageBody.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    // List filter
    if (listFilter !== "all") {
      filtered = filtered.filter((c) =>
        listFilter === "none" ? !c.targetListId : c.targetListId === listFilter
      );
    }

    // Sort (on the copied array)
    filtered.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.status.localeCompare(b.status);
      }
    });

    return filtered;
  }, [campaigns, searchQuery, statusFilter, listFilter, sortBy]);

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

  // Control mutations
  const startMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({ title: "Success", description: "Campaign started successfully", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start campaign", variant: "destructive", duration: 3000 });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({ title: "Success", description: "Campaign paused successfully", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to pause campaign", variant: "destructive", duration: 3000 });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({ title: "Success", description: "Campaign resumed successfully", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to resume campaign", variant: "destructive", duration: 3000 });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/imessage/campaigns/${id}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({ title: "Success", description: "Campaign stopped successfully", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to stop campaign", variant: "destructive", duration: 3000 });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (campaign: ImessageCampaign) =>
      apiRequest("POST", "/api/imessage/campaigns", {
        name: `${campaign.name} (Copy)`,
        description: campaign.description,
        messageBody: campaign.messageBody,
        targetListId: campaign.targetListId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({ title: "Success", description: "Campaign duplicated successfully", duration: 3000 });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to duplicate campaign", variant: "destructive", duration: 3000 });
    },
  });

  const handleEdit = (campaign: ImessageCampaign) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };

  const handleDelete = (campaign: ImessageCampaign) => {
    setDeleteCampaignId(campaign.id);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCampaign(null);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading campaigns..." fullScreen={true} />;
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn("border font-medium", config.color)}>
        <div className={cn("w-2 h-2 rounded-full mr-2", config.dotColor)} />
        {config.label}
      </Badge>
    );
  };

  const CampaignCard = ({ campaign }: { campaign: ImessageCampaign & { lastRunAt?: string; runsCount: number } }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <Link href={`/imessage-campaigns/${campaign.id}`}>
              <CardTitle className="text-lg hover:underline cursor-pointer" data-testid={`card-title-${campaign.id}`}>
                {campaign.name}
              </CardTitle>
            </Link>
            {campaign.description && (
              <CardDescription className="text-sm">{campaign.description}</CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid={`button-actions-${campaign.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(campaign)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateMutation.mutate(campaign)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(campaign.status === "draft" || campaign.status === "stopped") && (
                <DropdownMenuItem onClick={() => startMutation.mutate(campaign.id)}>
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </DropdownMenuItem>
              )}
              {campaign.status === "running" && (
                <DropdownMenuItem onClick={() => pauseMutation.mutate(campaign.id)}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </DropdownMenuItem>
              )}
              {campaign.status === "paused" && (
                <DropdownMenuItem onClick={() => resumeMutation.mutate(campaign.id)}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </DropdownMenuItem>
              )}
              {(campaign.status === "running" || campaign.status === "paused") && (
                <DropdownMenuItem onClick={() => stopMutation.mutate(campaign.id)}>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </DropdownMenuItem>
              )}
              {campaign.status === "draft" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDelete(campaign)} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusBadge status={campaign.status} />
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {getListName(campaign.targetListId)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {campaign.messageBody}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" />
              {campaign.runsCount || 0} runs
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {campaign.lastRunAt
                ? format(new Date(campaign.lastRunAt), "MMM d, yyyy")
                : "Never"}
            </span>
          </div>
          <Link href={`/imessage-campaigns/${campaign.id}`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            iMessage Campaigns
          </h1>
          <p className="text-muted-foreground">
            Create and manage automated iMessage marketing campaigns
          </p>
        </div>
        <Button onClick={() => { setEditingCampaign(null); setIsFormOpen(true); }} data-testid="button-new-campaign">
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-stat-total">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-stat-active">
              {stats.active}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-stat-completed">
              {stats.completed}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Successfully sent</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-gray-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600 dark:text-gray-400" data-testid="text-stat-draft">
              {stats.draft}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Not yet started</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={listFilter} onValueChange={setListFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-list-filter">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Targets</SelectItem>
                  <SelectItem value="none">All Contacts</SelectItem>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[140px]" data-testid="select-sort">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  data-testid="button-view-list"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grid"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Campaigns Display */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
            <div className="rounded-full bg-muted p-6 mb-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || statusFilter !== "all" || listFilter !== "all"
                ? "No campaigns found"
                : "No campaigns yet"}
            </h3>
            <p className="text-muted-foreground max-w-md mb-6">
              {searchQuery || statusFilter !== "all" || listFilter !== "all"
                ? "Try adjusting your filters or search query"
                : "Create your first iMessage campaign to start reaching your contacts"}
            </p>
            {!searchQuery && statusFilter === "all" && listFilter === "all" && (
              <Button
                onClick={() => { setEditingCampaign(null); setIsFormOpen(true); }}
                size="lg"
                data-testid="button-create-first"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="text-center">Runs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
                  <TableRow key={campaign.id} data-testid={`row-campaign-${campaign.id}`}>
                    <TableCell>
                      <Link href={`/imessage-campaigns/${campaign.id}`}>
                        <div className="font-medium hover:underline cursor-pointer" data-testid={`link-campaign-${campaign.id}`}>
                          {campaign.name}
                        </div>
                        {campaign.description && (
                          <div className="text-xs text-muted-foreground mt-1">{campaign.description}</div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {getListName(campaign.targetListId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(campaign as any).stats ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium" data-testid={`text-progress-${campaign.id}`}>
                            {(campaign as any).stats.sentCount}/{(campaign as any).stats.totalContacts}
                          </div>
                          <div className="w-32 bg-muted rounded-full h-2">
                            <div
                              className={cn(
                                "h-2 rounded-full transition-all",
                                campaign.status === "running" ? "bg-blue-500" : "bg-green-500"
                              )}
                              style={{
                                width: `${Math.min(
                                  ((campaign as any).stats.sentCount / (campaign as any).stats.totalContacts) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate" data-testid={`text-message-${campaign.id}`}>
                        {campaign.messageBody}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`text-last-run-${campaign.id}`}>
                      {campaign.lastRunAt
                        ? format(new Date(campaign.lastRunAt), "MMM d, h:mm a")
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-runs-count-${campaign.id}`}>
                      <Badge variant="outline">{campaign.runsCount || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${campaign.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEdit(campaign)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(campaign)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(campaign.status === "draft" || campaign.status === "stopped") && (
                            <DropdownMenuItem onClick={() => startMutation.mutate(campaign.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Start Campaign
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "running" && (
                            <DropdownMenuItem onClick={() => pauseMutation.mutate(campaign.id)}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "paused" && (
                            <DropdownMenuItem onClick={() => resumeMutation.mutate(campaign.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === "running" || campaign.status === "paused") && (
                            <DropdownMenuItem onClick={() => stopMutation.mutate(campaign.id)}>
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === "draft" || campaign.status === "completed" || campaign.status === "stopped") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(campaign)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Campaign Builder Wizard */}
      <CampaignBuilderWizard
        open={isFormOpen}
        onOpenChange={handleFormClose}
        editingCampaign={editingCampaign}
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
              This action cannot be undone. This will permanently delete the campaign and all its run history.
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
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
