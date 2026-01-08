import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Search, CheckCircle, XCircle, Trash2, Users, ChevronDown, Mail, Phone, 
  MessageSquare, AlertTriangle, Ban, ShieldOff, Zap, PhoneCall, Star, Info, 
  FileJson, Building, Filter, X, Upload, FileSpreadsheet, Calendar, Loader2, 
  AlertCircle, MoreHorizontal, ChevronRight, Plus, SlidersHorizontal, ArrowUpDown,
  UserCheck, PhoneOff, MailCheck, UserX, Download, RefreshCw
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
    no_valid_email?: boolean;
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

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "nurturing", label: "Nurturing" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<ImportBatch | null>(null);
  const [csvUploadDialogOpen, setCsvUploadDialogOpen] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [sortBy, setSortBy] = useState<string>("score_desc");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: batchesData, isLoading: isLoadingBatches } = useQuery<{ batches: ImportBatch[] }>({
    queryKey: ["/api/leads/operational/batches"],
    refetchInterval: (query) => {
      const batches = query.state.data?.batches || [];
      const hasProcessing = batches.some(b => b.status === 'processing');
      return hasProcessing ? 3000 : false;
    },
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

  const batches = batchesData?.batches || [];
  const leads = operationalLeadsData?.leads || [];
  const totalLeads = operationalLeadsData?.total || 0;

  const kpis = useMemo(() => {
    const total = totalLeads;
    const contactable = leads.filter(l => l.recommendedNextAction !== 'UNCONTACTABLE').length;
    const dncBlocked = leads.filter(l => l.riskFlags?.dnc_all).length;
    const noPhone = leads.filter(l => l.riskFlags?.no_valid_phone).length;
    const validEmail = leads.filter(l => l.bestEmail).length;
    return { total, contactable, dncBlocked, noPhone, validEmail };
  }, [leads, totalLeads]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (minScore > 0) count++;
    if (statusFilter !== "all") count++;
    if (stateFilter !== "all") count++;
    if (zipFilter) count++;
    if (onlyContactable) count++;
    if (excludeDnc) count++;
    if (hasMobileValid) count++;
    if (hasVerifiedEmail) count++;
    if (selectedRiskFlags.length > 0) count++;
    return count;
  }, [minScore, statusFilter, stateFilter, zipFilter, onlyContactable, excludeDnc, hasMobileValid, hasVerifiedEmail, selectedRiskFlags]);

  const fetchLeadDetails = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/operational/${leadId}`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setLeadDetails(data.lead);
      }
    } catch (error) {
      console.error("Failed to fetch lead details:", error);
    }
  };

  const openLeadDrawer = async (leadId: string) => {
    setExpandedLead(leadId);
    setDrawerOpen(true);
    await fetchLeadDetails(leadId);
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadingCsv(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (response.ok) {
        toast({ title: "Import started", description: "Your CSV is being processed in the background." });
        queryClient.invalidateQueries({ queryKey: ["/api/leads/operational/batches"] });
        queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
        setCsvUploadDialogOpen(false);
      } else {
        const error = await response.json();
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Import failed", description: "Network error", variant: "destructive" });
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-[10px] px-1.5">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 text-[10px] px-1.5">{score}</Badge>;
    if (score >= 20) return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-[10px] px-1.5">{score}</Badge>;
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] px-1.5">{score}</Badge>;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      case 'contacted': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
      case 'qualified': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
      case 'nurturing': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
      case 'converted': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'lost': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRiskBadges = (flags: OperationalLead['riskFlags']) => {
    const badges = [];
    if (flags?.dnc_all) badges.push(<Tooltip key="dnc"><TooltipTrigger><Ban className="h-3 w-3 text-red-500" /></TooltipTrigger><TooltipContent>DNC</TooltipContent></Tooltip>);
    if (flags?.no_valid_phone) badges.push(<Tooltip key="nophone"><TooltipTrigger><PhoneOff className="h-3 w-3 text-orange-500" /></TooltipTrigger><TooltipContent>No valid phone</TooltipContent></Tooltip>);
    if (flags?.all_opted_out) badges.push(<Tooltip key="optout"><TooltipTrigger><ShieldOff className="h-3 w-3 text-gray-500" /></TooltipTrigger><TooltipContent>Opted out</TooltipContent></Tooltip>);
    return badges;
  };

  const maskValue = (value: string | null, type: 'phone' | 'email') => {
    if (!value) return '-';
    if (type === 'phone') return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    if (type === 'email') {
      const [local, domain] = value.split('@');
      return local.slice(0, 2) + '***@' + domain;
    }
    return value;
  };

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
    setBatchFilter("all");
    setSearch("");
  };

  const SkeletonRow = () => (
    <TableRow className="h-[48px]">
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
      <TableCell><Skeleton className="h-4 w-6" /></TableCell>
    </TableRow>
  );

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-background">
        {/* TOP BAR - sticky h-14 */}
        <div className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex items-center px-6 gap-4" data-testid="leads-topbar">
          <div className="flex items-center gap-2 min-w-[140px]">
            <h1 className="font-semibold text-lg">Leads</h1>
            <Badge variant="secondary" className="text-xs">{totalLeads}</Badge>
          </div>
          
          <div className="flex-1 max-w-[520px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
                data-testid="input-search-leads"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" onClick={() => setCsvUploadDialogOpen(true)} data-testid="button-import-csv">
              <Upload className="h-4 w-4 mr-1.5" />
              Import CSV
            </Button>
            <Button size="sm" variant="outline" data-testid="button-create-lead">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Lead
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" />
                  Batch
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setBatchFilter("all")}>
                  All batches
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {batches.map(b => (
                  <DropdownMenuItem key={b.id} onClick={() => setBatchFilter(b.id)}>
                    <span className="truncate flex-1">{b.fileName}</span>
                    <Badge variant="secondary" className="ml-2 text-[10px]">{b.totalRows}</Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPI CHIPS - compact row */}
        <div className="h-10 border-b bg-muted/30 flex items-center px-6 gap-3" data-testid="leads-kpi-bar">
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{kpis.total}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-xs">
            <UserCheck className="h-3.5 w-3.5 text-green-600" />
            <span className="text-muted-foreground">Contactable:</span>
            <span className="font-medium text-green-600">{kpis.contactable}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-xs">
            <Ban className="h-3.5 w-3.5 text-red-500" />
            <span className="text-muted-foreground">DNC:</span>
            <span className="font-medium text-red-500">{kpis.dncBlocked}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-xs">
            <PhoneOff className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-muted-foreground">No Phone:</span>
            <span className="font-medium text-orange-500">{kpis.noPhone}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5 text-xs">
            <MailCheck className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-muted-foreground">Valid Email:</span>
            <span className="font-medium text-blue-600">{kpis.validEmail}</span>
          </div>
        </div>

        {/* MAIN GRID - 12 columns */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-screen-2xl mx-auto px-6 py-4 h-full">
            <div className="grid grid-cols-12 gap-4 h-full">
              
              {/* SIDEBAR - col-span-3 */}
              <div className="col-span-3 min-w-[280px]">
                <div className="h-[calc(100vh-152px)] bg-muted/20 border rounded-lg flex flex-col">
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-sm">Import Batches</h2>
                      <Badge variant="secondary" className="text-[10px]">{batches.length}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCsvUploadDialogOpen(true)}>
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-2">
                    {isLoadingBatches ? (
                      <div className="space-y-2">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                      </div>
                    ) : batches.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-2">No batches imported yet</p>
                        <Button size="sm" variant="outline" onClick={() => setCsvUploadDialogOpen(true)} className="h-7 text-xs">
                          <Upload className="h-3 w-3 mr-1" />
                          Import CSV
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {batches.map(batch => {
                          const successRate = batch.totalRows > 0 ? Math.round(((batch.processedRows || 0) - (batch.errorRows || 0)) / batch.totalRows * 100) : 0;
                          return (
                            <div
                              key={batch.id}
                              className={`p-2.5 rounded-md cursor-pointer transition-colors ${
                                selectedBatchId === batch.id || batchFilter === batch.id
                                  ? 'bg-primary/10 border border-primary/30'
                                  : 'hover:bg-muted/50 border border-transparent'
                              }`}
                              onClick={() => {
                                setSelectedBatchId(batch.id);
                                setBatchFilter(batch.id);
                              }}
                              data-testid={`batch-item-${batch.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate" title={batch.fileName}>{batch.fileName}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {format(new Date(batch.createdAt), "MMM d, h:mm a")}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {batch.status === 'processing' ? (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 gap-1">
                                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                      {batch.totalRows > 0 ? Math.round((batch.processedRows || 0) / batch.totalRows * 100) : 0}%
                                    </Badge>
                                  ) : batch.status === 'failed' ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5">Failed</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                      {successRate}%
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">{batch.totalRows}</span>
                                </div>
                              </div>
                              {batch.status === 'processing' && (
                                <Progress value={batch.totalRows > 0 ? (batch.processedRows || 0) / batch.totalRows * 100 : 0} className="h-1 mt-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT - col-span-9 */}
              <div className="col-span-9">
                <div className="h-[calc(100vh-152px)] border rounded-lg flex flex-col bg-background">
                  {/* Table header bar */}
                  <div className="p-3 border-b flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setFiltersOpen(true)}>
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filters
                        {activeFiltersCount > 0 && (
                          <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[10px]">{activeFiltersCount}</Badge>
                        )}
                      </Button>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <ArrowUpDown className="h-3 w-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score_desc">Score (High)</SelectItem>
                          <SelectItem value="score_asc">Score (Low)</SelectItem>
                          <SelectItem value="created_desc">Newest</SelectItem>
                          <SelectItem value="created_asc">Oldest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {activeFiltersCount > 0 && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={clearAllFilters}>
                        <X className="h-3 w-3" />
                        Clear filters
                      </Button>
                    )}
                  </div>

                  {/* Table container with scroll */}
                  <div className="flex-1 overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[200px]">Lead</TableHead>
                          <TableHead className="w-[100px]">Contact</TableHead>
                          <TableHead className="w-[50px] text-center">Score</TableHead>
                          <TableHead className="w-[90px]">Status</TableHead>
                          <TableHead className="w-[80px]">Owner</TableHead>
                          <TableHead className="w-[70px]">Created</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Empty state - inline, not centered */}
                        {!isLoadingLeads && leads.length === 0 && (
                          <>
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={7} className="p-4">
                                <div className="flex items-start gap-4">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium mb-1">No leads yet</p>
                                    <p className="text-xs text-muted-foreground mb-3">Import a CSV file to start managing your leads.</p>
                                    <div className="flex items-center gap-2">
                                      <Button size="sm" onClick={() => setCsvUploadDialogOpen(true)}>
                                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                                        Import CSV
                                      </Button>
                                      <Button size="sm" variant="outline" asChild>
                                        <a href="/api/leads/sample-csv" download>
                                          <Download className="h-3.5 w-3.5 mr-1.5" />
                                          Download sample
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" />Validation</div>
                                    <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" />Phone verify</div>
                                    <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" />DNC check</div>
                                    <div className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" />Scoring</div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                            {/* Skeleton rows to fill space */}
                            {[1,2,3,4,5,6,7,8].map(i => <SkeletonRow key={i} />)}
                          </>
                        )}

                        {/* Loading state - skeleton rows */}
                        {isLoadingLeads && (
                          <>
                            {[1,2,3,4,5,6,7,8,9,10].map(i => <SkeletonRow key={i} />)}
                          </>
                        )}

                        {/* Actual data rows */}
                        {!isLoadingLeads && leads.map((lead) => {
                          const riskBadges = getRiskBadges(lead.riskFlags);
                          return (
                            <TableRow 
                              key={lead.id} 
                              className="h-[48px] cursor-pointer hover:bg-muted/50"
                              onClick={() => openLeadDrawer(lead.id)}
                              data-testid={`lead-row-${lead.id}`}
                            >
                              <TableCell className="py-2">
                                <div>
                                  <p className="font-medium text-sm truncate max-w-[180px]" title={`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown'}>
                                    {lead.firstName || lead.lastName ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : 'Unknown'}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                                    {[lead.city, lead.personState].filter(Boolean).join(', ') || '-'}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex items-center gap-1">
                                  {lead.bestPhoneToCall && (
                                    <Tooltip><TooltipTrigger><PhoneCall className="h-3.5 w-3.5 text-green-600" /></TooltipTrigger><TooltipContent>Call available</TooltipContent></Tooltip>
                                  )}
                                  {lead.bestPhoneForSms && (
                                    <Tooltip><TooltipTrigger><MessageSquare className="h-3.5 w-3.5 text-blue-600" /></TooltipTrigger><TooltipContent>SMS available</TooltipContent></Tooltip>
                                  )}
                                  {lead.bestEmail && (
                                    <Tooltip><TooltipTrigger><Mail className="h-3.5 w-3.5 text-purple-600" /></TooltipTrigger><TooltipContent>Email available</TooltipContent></Tooltip>
                                  )}
                                  {riskBadges.length > 0 && <div className="flex gap-0.5 ml-1">{riskBadges}</div>}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {getScoreBadge(lead.contactabilityScore)}
                              </TableCell>
                              <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                <Select 
                                  value={lead.status} 
                                  onValueChange={(value) => updateLeadStatusMutation.mutate({ id: lead.id, status: value })}
                                >
                                  <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent hover:bg-muted p-0 px-1 w-auto" data-testid={`select-status-${lead.id}`}>
                                    <Badge className={`${getStatusBadgeClass(lead.status)} text-[10px] px-1.5`}>
                                      {statusOptions.find(s => s.value === lead.status)?.label || lead.status}
                                    </Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statusOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2">
                                <span className="text-xs text-muted-foreground truncate block max-w-[70px]" title={lead.ownerName || 'Unassigned'}>
                                  {lead.ownerName || '-'}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 text-[11px] text-muted-foreground">
                                {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: false })}
                              </TableCell>
                              <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openLeadDrawer(lead.id)}>View details</DropdownMenuItem>
                                    {lead.bestPhoneToCall && <DropdownMenuItem><PhoneCall className="h-3.5 w-3.5 mr-1.5" />Call</DropdownMenuItem>}
                                    {lead.bestPhoneForSms && <DropdownMenuItem><MessageSquare className="h-3.5 w-3.5 mr-1.5" />SMS</DropdownMenuItem>}
                                    {lead.bestEmail && <DropdownMenuItem><Mail className="h-3.5 w-3.5 mr-1.5" />Email</DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalLeads > 50 && (
                    <div className="p-3 border-t flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Showing {(page - 1) * 50 + 1}-{Math.min(page * 50, totalLeads)} of {totalLeads}
                      </p>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                        <Button size="sm" variant="outline" disabled={page * 50 >= totalLeads} onClick={() => setPage(p => p + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Sheet */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="right" className="w-[320px]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs">Min Score: {minScore}</Label>
                <Slider value={[minScore]} onValueChange={([v]) => setMinScore(v)} max={100} step={10} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="contactable" checked={onlyContactable} onCheckedChange={(c) => setOnlyContactable(!!c)} />
                  <Label htmlFor="contactable" className="text-xs">Only contactable</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="excludeDnc" checked={excludeDnc} onCheckedChange={(c) => setExcludeDnc(!!c)} />
                  <Label htmlFor="excludeDnc" className="text-xs">Exclude DNC</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="hasMobile" checked={hasMobileValid} onCheckedChange={(c) => setHasMobileValid(!!c)} />
                  <Label htmlFor="hasMobile" className="text-xs">Has valid mobile</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="hasEmail" checked={hasVerifiedEmail} onCheckedChange={(c) => setHasVerifiedEmail(!!c)} />
                  <Label htmlFor="hasEmail" className="text-xs">Has verified email</Label>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={clearAllFilters}>Clear all</Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Lead Details Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-[400px] sm:w-[500px]">
            <SheetHeader>
              <SheetTitle>Lead Details</SheetTitle>
            </SheetHeader>
            {leadDetails ? (
              <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                <div className="space-y-4 pr-4">
                  <div>
                    <h3 className="font-medium">{leadDetails.firstName} {leadDetails.lastName}</h3>
                    <p className="text-sm text-muted-foreground">{[leadDetails.city, leadDetails.personState, leadDetails.zip].filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getStatusBadgeClass(leadDetails.status)}>{leadDetails.status}</Badge>
                    {getScoreBadge(leadDetails.contactabilityScore)}
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Contact Points</h4>
                    <div className="space-y-2">
                      {leadDetails.contactPoints.map(cp => (
                        <div key={cp.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                          <div className="flex items-center gap-2">
                            {cp.type === 'phone' ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                            <span className="truncate max-w-[200px]">{cp.value}</span>
                            {cp.isValid && <CheckCircle className="h-3 w-3 text-green-600" />}
                            {cp.dncStatus === 'yes' && <Ban className="h-3 w-3 text-red-500" />}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-3 w-3" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {!cp.optedOut && <DropdownMenuItem onClick={() => optOutMutation.mutate(cp.id)}>Mark opted out</DropdownMenuItem>}
                              {cp.isValid && <DropdownMenuItem onClick={() => markInvalidMutation.mutate(cp.id)}>Mark invalid</DropdownMenuItem>}
                              {cp.type === 'phone' && <DropdownMenuItem onClick={() => setPrimaryMutation.mutate({ contactPointId: cp.id, usageType: 'call' })}>Set as primary (call)</DropdownMenuItem>}
                              {cp.type === 'email' && <DropdownMenuItem onClick={() => setPrimaryMutation.mutate({ contactPointId: cp.id, usageType: 'email' })}>Set as primary</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* CSV Upload Dialog */}
        <Dialog open={csvUploadDialogOpen} onOpenChange={setCsvUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Leads from CSV</DialogTitle>
              <DialogDescription>Upload a CSV file with your leads data.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCsv}
              >
                {uploadingCsv ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm">Click to upload CSV</span>
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Batch Dialog */}
        <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete batch?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all leads from "{batchToDelete?.fileName}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="bg-red-600 hover:bg-red-700"
                onClick={() => batchToDelete && deleteBatchMutation.mutate(batchToDelete.id)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
