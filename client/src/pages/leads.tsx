import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, CheckCircle, XCircle, Trash2, Users, ChevronDown, Mail, Phone, MessageSquare, AlertTriangle, Ban, ShieldOff, Zap, PhoneCall, Star, Info, FileJson, Building, Filter, X, Upload, FileSpreadsheet, Calendar, Loader2 } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ContactPoint {
  id: string;
  type: 'phone' | 'email';
  subtype: string;
  value: string;
  valueRaw: string | null;
  isValid: boolean;
  isVerified: boolean;
  dncStatus: 'yes' | 'no' | 'unknown';
  optedOut: boolean;
  source: string | null;
  confidence: number | null;
}

interface OperationalLead {
  id: string;
  personId: string;
  status: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'converted' | 'lost';
  ownerUserId: string | null;
  lastBatchId: string | null;
  bestPhoneToCall: string | null;
  bestPhoneForSms: string | null;
  bestEmail: string | null;
  timezone: string | null;
  contactabilityScore: number;
  riskFlags: {
    dnc_all?: boolean;
    no_valid_phone?: boolean;
    all_opted_out?: boolean;
    [key: string]: boolean | undefined;
  };
  recommendedNextAction: 'CALL' | 'SMS' | 'EMAIL' | 'UNCONTACTABLE';
  lastContactAttemptAt: string | null;
  lastContactOutcome: string | null;
  totalContactAttempts: number;
  createdAt: string;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  personState: string | null;
  zip: string | null;
  batchFileName: string | null;
  batchImportedAt: string | null;
  bestPhoneValue: string | null;
  bestSmsValue: string | null;
  bestEmailValue: string | null;
  ownerName?: string | null;
}

interface OperationalLeadDetails extends OperationalLead {
  ageRange: string | null;
  gender: string | null;
  hasChildren: boolean | null;
  isHomeowner: boolean | null;
  isMarried: boolean | null;
  netWorth: string | null;
  incomeRange: string | null;
  jobTitle: string | null;
  employerName: string | null;
  contactPoints: ContactPoint[];
}

interface ImportBatch {
  id: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  errorRows: number;
  createdAt: string;
}

export default function Leads() {
  const { toast } = useToast();
  
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [zipFilter, setZipFilter] = useState<string>("");
  const [onlyContactable, setOnlyContactable] = useState<boolean>(false);
  const [excludeDnc, setExcludeDnc] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [hasMobileValid, setHasMobileValid] = useState<boolean>(false);
  const [hasVerifiedEmail, setHasVerifiedEmail] = useState<boolean>(false);
  const [selectedRiskFlags, setSelectedRiskFlags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [leadDetails, setLeadDetails] = useState<OperationalLeadDetails | null>(null);
  const [showDemographics, setShowDemographics] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rawImportDialogOpen, setRawImportDialogOpen] = useState(false);
  const [rawImportData, setRawImportData] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<ImportBatch | null>(null);
  const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: batchesData, isLoading: isLoadingBatches } = useQuery<{ batches: ImportBatch[] }>({
    queryKey: ["/api/leads/operational/batches"],
  });

  const { data: operationalLeadsData, isLoading: isLoadingLeads } = useQuery<{ leads: OperationalLead[], total: number }>({
    queryKey: ["/api/leads/operational", {
      batchId: batchFilter !== "all" ? batchFilter : undefined,
      minScore: minScore > 0 ? minScore : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      state: stateFilter !== "all" ? stateFilter : undefined,
      onlyContactable: onlyContactable || undefined,
      excludeDnc: excludeDnc || undefined,
      hasMobileValid: hasMobileValid || undefined,
      hasVerifiedEmail: hasVerifiedEmail || undefined,
      zip: zipFilter || undefined,
      riskFlags: selectedRiskFlags.length > 0 ? selectedRiskFlags.join(",") : undefined,
      search: search || undefined,
      page,
      limit: 50
    }],
  });

  const { data: sessionData } = useQuery<{ user: { id: string; role: string; companyId: string } }>({
    queryKey: ["/api/session"],
  });

  const isAdmin = sessionData?.user?.role === "admin" || sessionData?.user?.role === "superadmin";

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return await apiRequest("DELETE", `/api/leads/operational/batches/${batchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      toast({ title: "Batch deleted", description: "All data from this batch has been removed." });
      setDeleteBatchDialogOpen(false);
      setBatchToDelete(null);
      if (batchFilter === batchToDelete?.id) {
        setBatchFilter("all");
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete batch", variant: "destructive" });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/leads/operational/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      toast({ title: "Status updated" });
    },
  });

  const optOutMutation = useMutation({
    mutationFn: async (contactPointId: string) => {
      return await apiRequest("POST", `/api/contact-points/${contactPointId}/opt-out`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      if (expandedLead) fetchLeadDetails(expandedLead);
      toast({ title: "Contact point marked as opted out" });
    },
  });

  const markInvalidMutation = useMutation({
    mutationFn: async (contactPointId: string) => {
      return await apiRequest("POST", `/api/contact-points/${contactPointId}/mark-invalid`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      if (expandedLead) fetchLeadDetails(expandedLead);
      toast({ title: "Contact point marked as invalid" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async ({ contactPointId, usageType }: { contactPointId: string; usageType: 'call' | 'sms' | 'email' }) => {
      return await apiRequest("POST", `/api/contact-points/${contactPointId}/set-primary`, { usageType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      if (expandedLead) fetchLeadDetails(expandedLead);
      toast({ title: "Primary contact updated" });
    },
  });

  const handleCsvUpload = async (file: File) => {
    if (!file) return;
    setUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/leads/import/csv', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        toast({ 
          title: "CSV Import Started", 
          description: `Processing ${data.totalRows || 'your'} leads. They will appear shortly.`
        });
        queryClient.invalidateQueries({ queryKey: ["/api/leads/operational/batches"] });
        queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
        setCsvUploadDialogOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const error = await response.json();
        toast({ title: "Import Failed", description: error.message || "Failed to import CSV", variant: "destructive" });
      }
    } catch (error) {
      console.error("CSV upload error:", error);
      toast({ title: "Import Failed", description: "An error occurred during CSV upload", variant: "destructive" });
    } finally {
      setUploadingCsv(false);
    }
  };

  const fetchLeadDetails = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/operational/${leadId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setLeadDetails({ ...data.lead, contactPoints: data.contactPoints || [], employerName: data.employers?.[0]?.employerName, jobTitle: data.employers?.[0]?.jobTitle, ...data.person });
      }
    } catch (error) {
      console.error("Failed to fetch lead details", error);
    }
  };

  const fetchRawImport = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/operational/${leadId}/raw`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRawImportData(data);
        setRawImportDialogOpen(true);
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.message || "Failed to fetch raw import data", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to fetch raw import data", error);
      toast({ title: "Error", description: "Failed to fetch raw import data", variant: "destructive" });
    }
  };

  const openLeadDrawer = async (leadId: string) => {
    setExpandedLead(leadId);
    setDrawerOpen(true);
    await fetchLeadDetails(leadId);
  };

  const batches = batchesData?.batches || [];
  const leads = operationalLeadsData?.leads || [];
  const totalLeads = operationalLeadsData?.total || 0;
  const totalPages = Math.ceil(totalLeads / 50);
  const uniqueStates = Array.from(new Set(leads.map(l => l.personState).filter(Boolean))) as string[];

  const selectedBatch = batches.find(b => b.id === batchFilter);
  const activeFiltersCount = [
    minScore > 0,
    statusFilter !== "all",
    stateFilter !== "all",
    zipFilter !== "",
    onlyContactable,
    excludeDnc,
    hasMobileValid,
    hasVerifiedEmail,
    selectedRiskFlags.length > 0
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setMinScore(0);
    setStatusFilter("all");
    setStateFilter("all");
    setZipFilter("");
    setOnlyContactable(false);
    setExcludeDnc(false);
    setHasMobileValid(false);
    setHasVerifiedEmail(false);
    setSelectedRiskFlags([]);
    setPage(1);
  };

  const maskValue = (value: string | null, type: 'phone' | 'email'): string => {
    if (!value) return '-';
    if (type === 'phone') {
      if (value.length <= 4) return value;
      return value.slice(0, -4).replace(/./g, '*') + value.slice(-4);
    }
    const [local, domain] = value.split('@');
    if (!domain) return value;
    return local.slice(0, 2) + '***@' + domain;
  };

  const getScoreDisplay = (score: number) => {
    const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
    const textColor = score >= 70 ? 'text-green-700 dark:text-green-300' : score >= 40 ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-700 dark:text-red-300';
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <Progress value={score} className={`h-2 flex-1 [&>div]:${color}`} />
        <span className={`text-xs font-semibold ${textColor} w-8`}>{score}</span>
      </div>
    );
  };

  const getRiskFlagChips = (riskFlags: OperationalLead['riskFlags']) => {
    const chips = [];
    if (riskFlags?.dnc_all) {
      chips.push(
        <Badge key="dnc" variant="destructive" className="gap-1 text-xs" data-testid="badge-risk-dnc">
          <Ban className="h-3 w-3" /> DNC
        </Badge>
      );
    }
    if (riskFlags?.no_valid_phone) {
      chips.push(
        <Badge key="no-phone" variant="secondary" className="gap-1 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200" data-testid="badge-risk-no-phone">
          <ShieldOff className="h-3 w-3" /> No Phone
        </Badge>
      );
    }
    if (riskFlags?.all_opted_out) {
      chips.push(
        <Badge key="opted-out" variant="secondary" className="gap-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" data-testid="badge-risk-opted-out">
          <X className="h-3 w-3" /> Opted Out
        </Badge>
      );
    }
    return chips.length > 0 ? chips : <span className="text-xs text-muted-foreground">—</span>;
  };

  const getBestContactDisplay = (lead: OperationalLead) => {
    if (lead.bestPhoneToCall && lead.bestPhoneValue) {
      return { icon: <PhoneCall className="h-4 w-4 text-green-600" />, value: maskValue(lead.bestPhoneValue, 'phone'), tooltip: 'Best phone for calling' };
    }
    if (lead.bestPhoneForSms && lead.bestSmsValue) {
      return { icon: <MessageSquare className="h-4 w-4 text-blue-600" />, value: maskValue(lead.bestSmsValue, 'phone'), tooltip: 'Best phone for SMS' };
    }
    if (lead.bestEmail && lead.bestEmailValue) {
      return { icon: <Mail className="h-4 w-4 text-purple-600" />, value: maskValue(lead.bestEmailValue, 'email'), tooltip: 'Best email' };
    }
    return { icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />, value: 'No contact', tooltip: 'No valid contact method' };
  };

  const getContactBlockedReason = (lead: OperationalLead, type: 'call' | 'sms' | 'email'): string | null => {
    if (type === 'call' && !lead.bestPhoneToCall) {
      if (lead.riskFlags?.dnc_all) return "Blocked: DNC";
      if (lead.riskFlags?.no_valid_phone) return "No valid phone";
      return "No phone available";
    }
    if (type === 'sms' && !lead.bestPhoneForSms) {
      if (lead.riskFlags?.all_opted_out) return "Opted out";
      if (lead.riskFlags?.no_valid_phone) return "No valid phone";
      return "No SMS permitted";
    }
    if (type === 'email' && !lead.bestEmail) {
      return "No valid email";
    }
    return null;
  };

  const getPipelineStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      new: { label: "New", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
      contacted: { label: "Contacted", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200" },
      qualified: { label: "Qualified", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
      nurturing: { label: "Nurturing", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" },
      converted: { label: "Converted", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200" },
      lost: { label: "Lost", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-200" },
    };
    const c = config[status] || config.new;
    return <Badge className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="page-title">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalLeads} lead{totalLeads !== 1 ? 's' : ''} {batchFilter !== "all" && selectedBatch ? `from ${selectedBatch.fileName}` : 'total'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setCsvUploadDialogOpen(true)}
            className="gap-2"
            data-testid="button-import-csv"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Select value={batchFilter} onValueChange={(v) => { setBatchFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-batch-filter">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={batch.id}>
                  {batch.fileName} ({batch.totalRows})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Batch Management Panel */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2" data-testid="section-batches">
              <FileSpreadsheet className="h-4 w-4" />
              Import Batches
            </h3>
            <Badge variant="outline" className="text-xs">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</Badge>
          </div>
          {isLoadingBatches ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No batches imported yet</p>
              <p className="text-xs mt-1">Click "Import CSV" to upload your first batch of leads</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {batches.map((batch) => (
                <div 
                  key={batch.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border ${batchFilter === batch.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}
                  data-testid={`batch-item-${batch.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate" title={batch.fileName}>{batch.fileName}</span>
                      <Badge variant={batch.status === 'completed' ? 'default' : batch.status === 'processing' ? 'secondary' : 'destructive'} className="text-xs">
                        {batch.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {batch.totalRows} rows
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(batch.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {batchFilter !== batch.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setBatchFilter(batch.id); setPage(1); }}
                        className="h-7 text-xs"
                        data-testid={`button-filter-batch-${batch.id}`}
                      >
                        Filter
                      </Button>
                    )}
                    {batchFilter === batch.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBatchFilter("all")}
                        className="h-7 text-xs"
                        data-testid={`button-clear-batch-filter-${batch.id}`}
                      >
                        Clear
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setBatchToDelete(batch); setDeleteBatchDialogOpen(true); }}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid={`button-delete-batch-${batch.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email, location..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="gap-2"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters">
                Clear all
              </Button>
            )}
          </div>

          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="nurturing">Nurturing</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setPage(1); }}>
                  <SelectTrigger data-testid="select-state-filter">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input 
                  placeholder="Filter by ZIP..."
                  value={zipFilter}
                  onChange={(e) => { setZipFilter(e.target.value); setPage(1); }}
                  data-testid="input-zip-filter"
                />
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">Min Score: {minScore}</Label>
                  <Slider
                    value={[minScore]}
                    onValueChange={(v) => { setMinScore(v[0]); setPage(1); }}
                    max={100}
                    step={5}
                    className="flex-1"
                    data-testid="slider-min-score"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="only-contactable" checked={onlyContactable} onCheckedChange={(c) => { setOnlyContactable(!!c); setPage(1); }} data-testid="checkbox-only-contactable" />
                  <Label htmlFor="only-contactable" className="text-sm cursor-pointer">Only Contactable</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="exclude-dnc" checked={excludeDnc} onCheckedChange={(c) => { setExcludeDnc(!!c); setPage(1); }} data-testid="checkbox-exclude-dnc" />
                  <Label htmlFor="exclude-dnc" className="text-sm cursor-pointer">Exclude DNC</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="has-mobile-valid" checked={hasMobileValid} onCheckedChange={(c) => { setHasMobileValid(!!c); setPage(1); }} data-testid="checkbox-has-mobile-valid" />
                  <Label htmlFor="has-mobile-valid" className="text-sm cursor-pointer">Has Mobile</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="has-verified-email" checked={hasVerifiedEmail} onCheckedChange={(c) => { setHasVerifiedEmail(!!c); setPage(1); }} data-testid="checkbox-has-verified-email" />
                  <Label htmlFor="has-verified-email" className="text-sm cursor-pointer">Verified Email</Label>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <Label className="text-sm font-medium">Risk Flags:</Label>
                {[
                  { id: 'dnc_all', label: 'DNC All' },
                  { id: 'no_valid_phone', label: 'No Valid Phone' },
                  { id: 'no_valid_email', label: 'No Valid Email' },
                  { id: 'all_opted_out', label: 'All Opted Out' },
                ].map((flag) => (
                  <div key={flag.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`risk-flag-${flag.id}`}
                      checked={selectedRiskFlags.includes(flag.id)}
                      onCheckedChange={(c) => {
                        if (c) {
                          setSelectedRiskFlags([...selectedRiskFlags, flag.id]);
                        } else {
                          setSelectedRiskFlags(selectedRiskFlags.filter(f => f !== flag.id));
                        }
                        setPage(1);
                      }}
                      data-testid={`checkbox-risk-flag-${flag.id}`}
                    />
                    <Label htmlFor={`risk-flag-${flag.id}`} className="text-sm cursor-pointer">{flag.label}</Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <TooltipProvider>
        {isLoadingLeads || isLoadingBatches ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner fullScreen={false} message="Loading leads..." />
          </div>
        ) : leads.length === 0 ? (
          <Card className="py-16">
            <CardContent className="text-center">
              <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2" data-testid="text-no-leads">No leads found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {search || activeFiltersCount > 0 
                  ? "No leads match your current filters. Try adjusting your search criteria." 
                  : "Import leads from a CSV file to get started. Leads will be processed with contactability insights automatically."}
              </p>
              {activeFiltersCount > 0 && (
                <Button variant="outline" onClick={clearAllFilters} className="mt-4" data-testid="button-clear-filters-empty">
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Lead</TableHead>
                      <TableHead className="font-semibold hidden md:table-cell">Best Contact</TableHead>
                      <TableHead className="font-semibold w-[120px]">Score</TableHead>
                      <TableHead className="font-semibold hidden lg:table-cell">Risk</TableHead>
                      <TableHead className="font-semibold hidden xl:table-cell">Batch</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      const bestContact = getBestContactDisplay(lead);
                      return (
                        <TableRow
                          key={lead.id}
                          data-testid={`row-lead-${lead.id}`}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => openLeadDrawer(lead.id)}
                        >
                          <TableCell data-testid={`cell-lead-name-${lead.id}`}>
                            <div className="font-medium">
                              {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[lead.city, lead.personState].filter(Boolean).join(', ') || '-'}
                              {lead.zip && ` ${lead.zip}`}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-best-contact-${lead.id}`} className="hidden md:table-cell">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  {bestContact.icon}
                                  <span className="font-mono text-sm">{bestContact.value}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent><p>{bestContact.tooltip}</p></TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell data-testid={`cell-score-${lead.id}`}>
                            {getScoreDisplay(lead.contactabilityScore)}
                          </TableCell>
                          <TableCell data-testid={`cell-risk-${lead.id}`} className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {getRiskFlagChips(lead.riskFlags)}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-batch-${lead.id}`} className="hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                              {lead.batchFileName || '-'}
                            </span>
                          </TableCell>
                          <TableCell data-testid={`cell-status-${lead.id}`}>
                            <Select
                              value={lead.status}
                              onValueChange={(v) => {
                                updateLeadStatusMutation.mutate({ id: lead.id, status: v });
                              }}
                            >
                              <SelectTrigger className="h-7 w-auto border-0 p-0 focus:ring-0" data-testid={`select-status-${lead.id}`} onClick={(e) => e.stopPropagation()}>
                                {getPipelineStatusBadge(lead.status)}
                              </SelectTrigger>
                              <SelectContent onClick={(e) => e.stopPropagation()}>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="nurturing">Nurturing</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant={lead.bestPhoneToCall ? "default" : "ghost"}
                                    disabled={!lead.bestPhoneToCall}
                                    className={`h-8 w-8 p-0 ${lead.bestPhoneToCall ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                                    data-testid={`button-call-${lead.id}`}
                                  >
                                    <PhoneCall className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {lead.bestPhoneToCall ? 'Call' : getContactBlockedReason(lead, 'call')}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant={lead.bestPhoneForSms ? "default" : "ghost"}
                                    disabled={!lead.bestPhoneForSms}
                                    className={`h-8 w-8 p-0 ${lead.bestPhoneForSms ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                    data-testid={`button-sms-${lead.id}`}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {lead.bestPhoneForSms ? 'SMS' : getContactBlockedReason(lead, 'sms')}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant={lead.bestEmail ? "default" : "ghost"}
                                    disabled={!lead.bestEmail}
                                    className={`h-8 w-8 p-0 ${lead.bestEmail ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                                    data-testid={`button-email-${lead.id}`}
                                  >
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {lead.bestEmail ? 'Email' : getContactBlockedReason(lead, 'email')}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                  Showing {((page - 1) * 50) + 1} - {Math.min(page * 50, totalLeads)} of {totalLeads} leads
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </TooltipProvider>

      {/* Delete Batch Confirmation Dialog */}
      <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-batch">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the batch "{batchToDelete?.fileName}"? This will permanently remove all {batchToDelete?.totalRows} leads, their contact points, and raw import data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-batch">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchToDelete && deleteBatchMutation.mutate(batchToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBatchMutation.isPending}
              data-testid="button-confirm-delete-batch"
            >
              {deleteBatchMutation.isPending ? "Deleting..." : "Delete Batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lead Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-hidden" data-testid="drawer-lead-detail">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-xl" data-testid="drawer-lead-name">
              {leadDetails ? `${leadDetails.firstName || ''} ${leadDetails.lastName || ''}`.trim() || 'Lead Details' : 'Loading...'}
            </SheetTitle>
            <SheetDescription>
              {leadDetails && (
                <span className="flex items-center gap-2">
                  {[leadDetails.city, leadDetails.personState, leadDetails.zip].filter(Boolean).join(', ')}
                  {leadDetails.ownerName && <span className="text-xs">• Owner: {leadDetails.ownerName}</span>}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
          {!leadDetails ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner fullScreen={false} />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-140px)] pr-4">
              <div className="space-y-6 py-4">
                {/* Score Display */}
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Contactability Score</span>
                    <span className={`text-lg font-bold ${leadDetails.contactabilityScore >= 70 ? 'text-green-600' : leadDetails.contactabilityScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {leadDetails.contactabilityScore}/100
                    </span>
                  </div>
                  <Progress 
                    value={leadDetails.contactabilityScore} 
                    className={`h-3 ${leadDetails.contactabilityScore >= 70 ? '[&>div]:bg-green-500' : leadDetails.contactabilityScore >= 40 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                  />
                  <div className="flex flex-wrap gap-1 mt-3">
                    {getRiskFlagChips(leadDetails.riskFlags)}
                  </div>
                </div>

                {/* Action Panel */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      size="lg"
                      variant={leadDetails.bestPhoneToCall ? "default" : "outline"}
                      disabled={!leadDetails.bestPhoneToCall}
                      className={`w-full h-14 ${leadDetails.bestPhoneToCall ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                      data-testid="drawer-action-call"
                    >
                      <PhoneCall className="h-5 w-5 mr-2" />
                      CALL
                    </Button>
                    {!leadDetails.bestPhoneToCall && (
                      <span className="text-xs text-muted-foreground text-center">{getContactBlockedReason(leadDetails, 'call')}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      size="lg"
                      variant={leadDetails.bestPhoneForSms ? "default" : "outline"}
                      disabled={!leadDetails.bestPhoneForSms}
                      className={`w-full h-14 ${leadDetails.bestPhoneForSms ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                      data-testid="drawer-action-sms"
                    >
                      <MessageSquare className="h-5 w-5 mr-2" />
                      SMS
                    </Button>
                    {!leadDetails.bestPhoneForSms && (
                      <span className="text-xs text-muted-foreground text-center">{getContactBlockedReason(leadDetails, 'sms')}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      size="lg"
                      variant={leadDetails.bestEmail ? "default" : "outline"}
                      disabled={!leadDetails.bestEmail}
                      className={`w-full h-14 ${leadDetails.bestEmail ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                      data-testid="drawer-action-email"
                    >
                      <Mail className="h-5 w-5 mr-2" />
                      EMAIL
                    </Button>
                    {!leadDetails.bestEmail && (
                      <span className="text-xs text-muted-foreground text-center">{getContactBlockedReason(leadDetails, 'email')}</span>
                    )}
                  </div>
                </div>

                {/* Contact Points Table */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2" data-testid="section-contact-points">
                    <Phone className="h-4 w-4" />
                    Contact Points
                  </h4>
                  {leadDetails.contactPoints && leadDetails.contactPoints.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-8">Type</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead className="w-16">Valid</TableHead>
                            <TableHead className="w-20">DNC</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leadDetails.contactPoints.map((cp: ContactPoint) => (
                            <TableRow key={cp.id} data-testid={`drawer-contact-point-${cp.id}`}>
                              <TableCell>
                                {cp.type === 'phone' ? (
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm" data-testid={`contact-value-${cp.id}`}>
                                <div>{cp.value}</div>
                                <div className="text-xs text-muted-foreground capitalize">{cp.subtype}</div>
                              </TableCell>
                              <TableCell>
                                {cp.isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                {cp.dncStatus === 'yes' ? (
                                  <Badge variant="destructive" className="text-xs">DNC</Badge>
                                ) : cp.optedOut ? (
                                  <Badge variant="secondary" className="text-xs">Out</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-800 text-xs">OK</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {!cp.optedOut && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => optOutMutation.mutate(cp.id)} data-testid={`button-optout-${cp.id}`}>
                                          <Ban className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Mark as opted out</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {cp.isValid && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => markInvalidMutation.mutate(cp.id)} data-testid={`button-invalid-${cp.id}`}>
                                          <ShieldOff className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Mark as invalid</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setPrimaryMutation.mutate({ contactPointId: cp.id, usageType: cp.type === 'phone' ? 'call' : 'email' })} data-testid={`button-primary-${cp.id}`}>
                                        <Star className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Set as primary</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center bg-muted/30 rounded-lg">No contact points available</p>
                  )}
                </div>

                {/* Insights Panel */}
                <Collapsible open={showDemographics} onOpenChange={setShowDemographics}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between hover:bg-muted/50" data-testid="button-toggle-insights">
                      <span className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Insights & Demographics
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showDemographics ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-2">
                    {leadDetails.employerName && (
                      <div className="p-3 bg-muted/30 rounded-lg" data-testid="section-employment">
                        <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                          <Building className="h-4 w-4" />
                          Employment
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Company:</span>
                            <span className="ml-2">{leadDetails.employerName}</span>
                          </div>
                          {leadDetails.jobTitle && (
                            <div>
                              <span className="text-muted-foreground">Title:</span>
                              <span className="ml-2">{leadDetails.jobTitle}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-muted/30 rounded-lg" data-testid="section-demographics">
                      <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4" />
                        Demographics
                        <Badge variant="outline" className="text-xs ml-auto">Inferred</Badge>
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {leadDetails.gender && (
                          <div>
                            <span className="text-muted-foreground">Gender:</span>
                            <span className="ml-2 capitalize">{leadDetails.gender}</span>
                          </div>
                        )}
                        {leadDetails.ageRange && (
                          <div>
                            <span className="text-muted-foreground">Age:</span>
                            <span className="ml-2">{leadDetails.ageRange}</span>
                          </div>
                        )}
                        {leadDetails.hasChildren !== null && (
                          <div>
                            <span className="text-muted-foreground">Has Children:</span>
                            <span className="ml-2">{leadDetails.hasChildren ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {leadDetails.isHomeowner !== null && (
                          <div>
                            <span className="text-muted-foreground">Homeowner:</span>
                            <span className="ml-2">{leadDetails.isHomeowner ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {leadDetails.isMarried !== null && (
                          <div>
                            <span className="text-muted-foreground">Married:</span>
                            <span className="ml-2">{leadDetails.isMarried ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {leadDetails.netWorth && (
                          <div>
                            <span className="text-muted-foreground">Net Worth:</span>
                            <span className="ml-2">{leadDetails.netWorth}</span>
                          </div>
                        )}
                        {leadDetails.incomeRange && (
                          <div>
                            <span className="text-muted-foreground">Income:</span>
                            <span className="ml-2">{leadDetails.incomeRange}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* View Raw Import (Admin Only) */}
                {isAdmin && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => expandedLead && fetchRawImport(expandedLead)}
                      className="w-full"
                      data-testid="button-view-raw-import"
                    >
                      <FileJson className="h-4 w-4 mr-2" />
                      View Raw Import Row
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Raw Import Data Dialog */}
      <Dialog open={rawImportDialogOpen} onOpenChange={setRawImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-raw-import">
          <DialogHeader>
            <DialogTitle>Raw Import Data</DialogTitle>
            <DialogDescription>
              Original data from CSV import for {rawImportData?.person?.firstName} {rawImportData?.person?.lastName}
            </DialogDescription>
          </DialogHeader>
          {rawImportData?.rawRow ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <span>Row #: {rawImportData.rawRow.rowNumber}</span>
                <span className="ml-4">Imported: {rawImportData.rawRow.importedAt ? format(new Date(rawImportData.rawRow.importedAt), 'PPpp') : '-'}</span>
              </div>
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs" data-testid="raw-import-json">
                {JSON.stringify(rawImportData.rawRow.rawJson, null, 2)}
              </pre>
              {rawImportData.rawRow.parseWarnings && Object.keys(rawImportData.rawRow.parseWarnings).length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h5 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Parse Warnings</h5>
                  <pre className="text-xs text-yellow-700 dark:text-yellow-300">
                    {JSON.stringify(rawImportData.rawRow.parseWarnings, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No raw import data found for this lead.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRawImportDialogOpen(false)} data-testid="button-close-raw-import">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Dialog */}
      <Dialog open={csvUploadDialogOpen} onOpenChange={setCsvUploadDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-csv-upload">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Leads from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file containing your leads. The system will automatically process and enrich the data with contactability insights.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                id="csv-upload-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvUpload(file);
                }}
                disabled={uploadingCsv}
                data-testid="input-csv-file"
              />
              <label 
                htmlFor="csv-upload-input" 
                className={`flex flex-col items-center gap-3 cursor-pointer ${uploadingCsv ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploadingCsv ? (
                  <>
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <span className="text-sm font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium text-primary">Click to upload</span>
                      <span className="text-sm text-muted-foreground"> or drag and drop</span>
                    </div>
                    <span className="text-xs text-muted-foreground">CSV files only (max 50MB)</span>
                  </>
                )}
              </label>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Expected columns:</p>
              <p>first_name, last_name, email, phone, mobile, city, state, zip</p>
              <p className="italic">Additional columns will be preserved in raw import data.</p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setCsvUploadDialogOpen(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={uploadingCsv}
              data-testid="button-cancel-csv-upload"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
