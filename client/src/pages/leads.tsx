import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Search, CheckCircle, XCircle, Trash2, Users, ChevronDown, Mail, Phone, 
  MessageSquare, AlertTriangle, Ban, ShieldOff, Zap, PhoneCall, Star, Info, 
  FileJson, Building, Filter, X, Upload, FileSpreadsheet, Calendar, Loader2, 
  AlertCircle, MoreHorizontal, ChevronRight, Plus, SlidersHorizontal, ArrowUpDown,
  UserCheck, PhoneOff, MailCheck, UserX
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
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
  const [batchSearchQuery, setBatchSearchQuery] = useState<string>("");
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

  // Compute KPI stats
  const kpiStats = useMemo(() => {
    const contactable = leads.filter(l => l.bestPhoneToCall || l.bestPhoneForSms || l.bestEmail).length;
    const dncBlocked = leads.filter(l => l.riskFlags?.dnc_all).length;
    const noValidPhone = leads.filter(l => l.riskFlags?.no_valid_phone).length;
    const verifiedEmail = leads.filter(l => l.bestEmail).length;
    return { contactable, dncBlocked, noValidPhone, verifiedEmail };
  }, [leads]);

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

  const activeFiltersList = useMemo(() => {
    const filters: { label: string; onRemove: () => void }[] = [];
    if (minScore > 0) filters.push({ label: `Score ≥ ${minScore}`, onRemove: () => setMinScore(0) });
    if (statusFilter !== "all") filters.push({ label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("all") });
    if (stateFilter !== "all") filters.push({ label: `State: ${stateFilter}`, onRemove: () => setStateFilter("all") });
    if (zipFilter) filters.push({ label: `ZIP: ${zipFilter}`, onRemove: () => setZipFilter("") });
    if (onlyContactable) filters.push({ label: "Contactable only", onRemove: () => setOnlyContactable(false) });
    if (excludeDnc) filters.push({ label: "Exclude DNC", onRemove: () => setExcludeDnc(false) });
    if (hasMobileValid) filters.push({ label: "Has mobile", onRemove: () => setHasMobileValid(false) });
    if (hasVerifiedEmail) filters.push({ label: "Verified email", onRemove: () => setHasVerifiedEmail(false) });
    selectedRiskFlags.forEach(flag => {
      filters.push({ label: `Risk: ${flag}`, onRemove: () => setSelectedRiskFlags(prev => prev.filter(f => f !== flag)) });
    });
    return filters;
  }, [minScore, statusFilter, stateFilter, zipFilter, onlyContactable, excludeDnc, hasMobileValid, hasVerifiedEmail, selectedRiskFlags]);

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

  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 font-mono text-xs">{score}</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 font-mono text-xs">{score}</Badge>;
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-mono text-xs">{score}</Badge>;
  };

  const getRiskBadges = (riskFlags: OperationalLead['riskFlags']) => {
    const badges = [];
    if (riskFlags?.dnc_all) badges.push(<Badge key="dnc" variant="destructive" className="text-[10px] px-1 py-0">DNC</Badge>);
    if (riskFlags?.no_valid_phone) badges.push(<Badge key="phone" variant="secondary" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">No Phone</Badge>);
    if (riskFlags?.all_opted_out) badges.push(<Badge key="out" variant="secondary" className="text-[10px] px-1 py-0">Opted Out</Badge>);
    return badges;
  };

  const getContactBlockedReason = (lead: OperationalLead, type: 'call' | 'sms' | 'email'): string | null => {
    if (type === 'call' && !lead.bestPhoneToCall) {
      if (lead.riskFlags?.dnc_all) return "DNC blocked";
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

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
    { value: "nurturing", label: "Nurturing" },
    { value: "converted", label: "Converted" },
    { value: "lost", label: "Lost" },
  ];

  const getStatusBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      new: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
      contacted: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
      qualified: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
      nurturing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
      converted: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
      lost: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    };
    return map[status] || map.new;
  };

  if (isLoadingBatches && isLoadingLeads) {
    return <LoadingSpinner />;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* TOP BAR - Sticky */}
        <div className="sticky top-0 z-20 bg-background border-b">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-3">
            {/* Header Row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight" data-testid="page-title">Leads</h1>
                <Badge variant="secondary" className="font-mono text-sm">{totalLeads.toLocaleString()}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setCsvUploadDialogOpen(true)} size="sm" data-testid="button-import-csv">
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import CSV
                </Button>
                <Button variant="outline" size="sm" data-testid="button-create-lead">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Lead
                </Button>
                <DropdownMenu onOpenChange={(open) => { if (!open) setBatchSearchQuery(""); }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[140px] justify-between" data-testid="dropdown-batch">
                      <span className="truncate">{batchFilter === "all" ? "All Batches" : batches.find(b => b.id === batchFilter)?.fileName || "Batch"}</span>
                      <ChevronDown className="h-4 w-4 ml-1.5 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[260px]">
                    <div className="px-2 pb-2">
                      <Input
                        placeholder="Search batches..."
                        value={batchSearchQuery}
                        onChange={(e) => setBatchSearchQuery(e.target.value)}
                        className="h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                        data-testid="input-batch-search"
                      />
                    </div>
                    <DropdownMenuSeparator />
                    <div className="max-h-[200px] overflow-y-auto">
                      <DropdownMenuItem onClick={() => { setBatchFilter("all"); setPage(1); }}>
                        All Batches
                      </DropdownMenuItem>
                      {batches
                        .filter(b => b.fileName.toLowerCase().includes(batchSearchQuery.toLowerCase()))
                        .map((batch) => (
                          <DropdownMenuItem key={batch.id} onClick={() => { setBatchFilter(batch.id); setPage(1); }}>
                            <span className="truncate flex-1">{batch.fileName}</span>
                            <Badge variant="outline" className="ml-2 text-[10px]">{batch.totalRows}</Badge>
                          </DropdownMenuItem>
                        ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* KPI Chips Row */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
              <button
                onClick={() => { setOnlyContactable(false); setExcludeDnc(false); setHasMobileValid(false); setHasVerifiedEmail(false); clearAllFilters(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!onlyContactable && !excludeDnc && activeFiltersCount === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                data-testid="kpi-total"
              >
                <Users className="h-3.5 w-3.5" />
                Total
                <span className="font-mono">{totalLeads.toLocaleString()}</span>
              </button>
              <button
                onClick={() => { setOnlyContactable(true); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${onlyContactable ? 'bg-green-600 text-white' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                data-testid="kpi-contactable"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Contactable
                <span className="font-mono">{kpiStats.contactable}</span>
              </button>
              <button
                onClick={() => { setSelectedRiskFlags(['dnc_all']); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedRiskFlags.includes('dnc_all') ? 'bg-red-600 text-white' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                data-testid="kpi-dnc"
              >
                <Ban className="h-3.5 w-3.5" />
                DNC Blocked
                <span className="font-mono">{kpiStats.dncBlocked}</span>
              </button>
              <button
                onClick={() => { setSelectedRiskFlags(['no_valid_phone']); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedRiskFlags.includes('no_valid_phone') ? 'bg-orange-600 text-white' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                data-testid="kpi-no-phone"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                No Valid Phone
                <span className="font-mono">{kpiStats.noValidPhone}</span>
              </button>
              <button
                onClick={() => { setHasVerifiedEmail(true); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${hasVerifiedEmail ? 'bg-purple-600 text-white' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                data-testid="kpi-verified-email"
              >
                <MailCheck className="h-3.5 w-3.5" />
                Valid Email
                <span className="font-mono">{kpiStats.verifiedEmail}</span>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT - 2 Columns */}
        <div className="flex-1 overflow-hidden">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-4 h-full">
            <div className="flex gap-4 h-full">
              {/* LEFT SIDEBAR - Batches */}
              <div className="w-72 shrink-0 hidden lg:block">
                <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 px-4 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Import Batches
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px]">{batches.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    {isLoadingBatches ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : batches.length === 0 ? (
                      <div className="p-4 text-center">
                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground mb-2">No batches yet</p>
                        <Button size="sm" variant="outline" onClick={() => setCsvUploadDialogOpen(true)}>
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          Import CSV
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="h-full">
                        <div className="p-2 space-y-1">
                          {batches.map((batch) => (
                            <div
                              key={batch.id}
                              className={`p-2.5 rounded-md cursor-pointer transition-colors ${batchFilter === batch.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50 border border-transparent'}`}
                              onClick={() => { setBatchFilter(batch.id); setPage(1); }}
                              data-testid={`batch-item-${batch.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate" title={batch.fileName}>{batch.fileName}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {format(new Date(batch.createdAt), 'MMM d, yyyy h:mm a')}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                                    <span>{batch.processedRows || batch.totalRows} leads</span>
                                    {batch.status === 'completed' && batch.totalRows > 0 && (batch.processedRows || 0) > 0 && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                        {Math.round((((batch.processedRows || 0) - (batch.errorRows || 0)) / batch.totalRows) * 100)}% OK
                                      </Badge>
                                    )}
                                    {batch.status === 'processing' && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0 gap-1">
                                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                        {batch.totalRows > 0 ? Math.round(((batch.processedRows || 0) / batch.totalRows) * 100) : 0}%
                                      </Badge>
                                    )}
                                    {batch.errorRows > 0 && (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0 gap-0.5">
                                            <AlertCircle className="h-2.5 w-2.5" />
                                            {batch.errorRows}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>{batch.errorRows} rows had errors</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => { setBatchFilter(batch.id); setPage(1); }}
                                    data-testid={`button-view-batch-${batch.id}`}
                                  >
                                    View
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setBatchFilter(batch.id); setPage(1); }}>
                                        View leads
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast({ title: "Reprocess", description: "Reprocessing batch..." }); }}>
                                        Reprocess batch
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={(e) => { e.stopPropagation(); setBatchToDelete(batch); setDeleteBatchDialogOpen(true); }}
                                      >
                                        Delete batch
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                              {batch.status === 'processing' && (
                                <Progress value={batch.totalRows > 0 ? ((batch.processedRows || 0) / batch.totalRows) * 100 : 0} className="h-1 mt-2" />
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT - Leads Table */}
              <div className="flex-1 min-w-0">
                <Card className="h-full flex flex-col">
                  {/* Table Header */}
                  <CardHeader className="py-3 px-4 border-b space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, email, phone..."
                          value={search}
                          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                          className="pl-9 h-9"
                          data-testid="input-search"
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)} className="gap-1.5" data-testid="button-filters">
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                        {activeFiltersCount > 0 && (
                          <Badge className="h-5 w-5 p-0 justify-center text-[10px]">{activeFiltersCount}</Badge>
                        )}
                      </Button>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[140px] h-9" data-testid="select-sort">
                          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score_desc">Score (High)</SelectItem>
                          <SelectItem value="score_asc">Score (Low)</SelectItem>
                          <SelectItem value="newest">Newest</SelectItem>
                          <SelectItem value="oldest">Oldest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Active Filters Chips */}
                    {activeFiltersList.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {activeFiltersList.map((filter, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1 text-xs pr-1">
                            {filter.label}
                            <button onClick={filter.onRemove} className="ml-0.5 hover:bg-muted rounded">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                        <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground ml-1">
                          Clear all
                        </button>
                      </div>
                    )}
                  </CardHeader>

                  {/* Table Content */}
                  <CardContent className="flex-1 overflow-hidden p-0">
                    {isLoadingLeads ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : leads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <UserX className="h-10 w-10 text-muted-foreground/50 mb-3" />
                        <h3 className="font-medium mb-1">No leads yet</h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                          Import a CSV file to get started. Leads will be automatically enriched with contactability data.
                        </p>
                        <div className="flex gap-2 mb-4">
                          <Button size="sm" onClick={() => setCsvUploadDialogOpen(true)}>
                            <Upload className="h-4 w-4 mr-1.5" />
                            Import CSV
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href="/api/leads/sample-csv" download="sample_leads.csv">
                              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                              Download Sample
                            </a>
                          </Button>
                        </div>
                        <div className="text-left text-xs text-muted-foreground bg-muted/50 rounded-md p-3 max-w-xs">
                          <p className="font-medium mb-1.5">What happens when you import:</p>
                          <ul className="space-y-1">
                            <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" /> Leads parsed and validated</li>
                            <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" /> Phone/email verification</li>
                            <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" /> DNC status checked</li>
                            <li className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-green-600" /> Contactability score assigned</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <ScrollArea className="h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[180px]">Lead</TableHead>
                              <TableHead className="w-[120px]">Best Contact</TableHead>
                              <TableHead className="w-[50px] text-center">Score</TableHead>
                              <TableHead className="w-[100px]">Status</TableHead>
                              <TableHead className="w-[90px]">Owner</TableHead>
                              <TableHead className="w-[90px]">Batch</TableHead>
                              <TableHead className="w-[70px]">Created</TableHead>
                              <TableHead className="w-[40px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leads.map((lead) => {
                              const riskBadges = getRiskBadges(lead.riskFlags);
                              return (
                                <TableRow 
                                  key={lead.id} 
                                  className={`cursor-pointer ${expandedLead === lead.id ? 'bg-muted/50' : ''}`}
                                  onClick={() => openLeadDrawer(lead.id)}
                                  data-testid={`lead-row-${lead.id}`}
                                >
                                  <TableCell className="py-2">
                                    <div>
                                      <p className="font-medium text-sm truncate">
                                        {lead.firstName || lead.lastName ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim() : 'Unknown'}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {[lead.city, lead.personState].filter(Boolean).join(', ') || '-'}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-1.5">
                                      {lead.bestPhoneToCall && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <PhoneCall className="h-4 w-4 text-green-600" />
                                          </TooltipTrigger>
                                          <TooltipContent>Call: {maskValue(lead.bestPhoneValue, 'phone')}</TooltipContent>
                                        </Tooltip>
                                      )}
                                      {lead.bestPhoneForSms && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <MessageSquare className="h-4 w-4 text-blue-600" />
                                          </TooltipTrigger>
                                          <TooltipContent>SMS: {maskValue(lead.bestSmsValue, 'phone')}</TooltipContent>
                                        </Tooltip>
                                      )}
                                      {lead.bestEmail && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Mail className="h-4 w-4 text-purple-600" />
                                          </TooltipTrigger>
                                          <TooltipContent>Email: {maskValue(lead.bestEmailValue, 'email')}</TooltipContent>
                                        </Tooltip>
                                      )}
                                      {!lead.bestPhoneToCall && !lead.bestPhoneForSms && !lead.bestEmail && (
                                        <span className="text-xs text-muted-foreground">None</span>
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
                                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent hover:bg-muted p-0 pl-1" data-testid={`select-status-${lead.id}`}>
                                        <Badge className={`${getStatusBadgeClass(lead.status)} text-[10px]`}>
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
                                    <span className="text-xs text-muted-foreground truncate block max-w-[80px]" title={lead.ownerName || 'Unassigned'}>
                                      {lead.ownerName || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <span className="text-xs text-muted-foreground truncate block max-w-[80px]" title={lead.batchFileName || '-'}>
                                      {lead.batchFileName || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-muted-foreground">
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
                                        <DropdownMenuItem onClick={() => openLeadDrawer(lead.id)}>
                                          View details
                                        </DropdownMenuItem>
                                        {lead.bestPhoneToCall && (
                                          <DropdownMenuItem>
                                            <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                                            Call
                                          </DropdownMenuItem>
                                        )}
                                        {lead.bestPhoneForSms && (
                                          <DropdownMenuItem>
                                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                                            Send SMS
                                          </DropdownMenuItem>
                                        )}
                                        {lead.bestEmail && (
                                          <DropdownMenuItem>
                                            <Mail className="h-3.5 w-3.5 mr-1.5" />
                                            Send Email
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="border-t px-4 py-2 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Page {page} of {totalPages} ({totalLeads} leads)
                      </p>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTERS SHEET */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent className="w-[340px] sm:w-[400px]" data-testid="sheet-filters">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Refine your lead list</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
            <div className="space-y-6">
              {/* Status */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                  <SelectTrigger className="mt-2" data-testid="filter-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Location */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</Label>
                <div className="space-y-2 mt-2">
                  <Select value={stateFilter} onValueChange={(v) => { setStateFilter(v); setPage(1); }}>
                    <SelectTrigger data-testid="filter-state">
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All states</SelectItem>
                      {uniqueStates.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="ZIP code"
                    value={zipFilter}
                    onChange={(e) => { setZipFilter(e.target.value); setPage(1); }}
                    data-testid="filter-zip"
                  />
                </div>
              </div>

              <Separator />

              {/* Contactability */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contactability</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="only-contactable" checked={onlyContactable} onCheckedChange={(c) => { setOnlyContactable(!!c); setPage(1); }} />
                    <Label htmlFor="only-contactable" className="text-sm font-normal cursor-pointer">Only contactable</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="exclude-dnc" checked={excludeDnc} onCheckedChange={(c) => { setExcludeDnc(!!c); setPage(1); }} />
                    <Label htmlFor="exclude-dnc" className="text-sm font-normal cursor-pointer">Exclude DNC</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="has-mobile" checked={hasMobileValid} onCheckedChange={(c) => { setHasMobileValid(!!c); setPage(1); }} />
                    <Label htmlFor="has-mobile" className="text-sm font-normal cursor-pointer">Has mobile phone</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="verified-email" checked={hasVerifiedEmail} onCheckedChange={(c) => { setHasVerifiedEmail(!!c); setPage(1); }} />
                    <Label htmlFor="verified-email" className="text-sm font-normal cursor-pointer">Has valid email</Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Score */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Minimum Score</Label>
                <div className="mt-3 space-y-2">
                  <Slider
                    value={[minScore]}
                    onValueChange={(v) => { setMinScore(v[0]); setPage(1); }}
                    max={100}
                    step={5}
                    data-testid="filter-score"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span className="font-medium text-foreground">{minScore}</span>
                    <span>100</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Risk Flags */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Risk Flags</Label>
                <div className="space-y-3 mt-2">
                  {[
                    { value: 'dnc_all', label: 'DNC All Channels' },
                    { value: 'no_valid_phone', label: 'No Valid Phone' },
                    { value: 'no_valid_email', label: 'No Valid Email' },
                    { value: 'all_opted_out', label: 'All Opted Out' },
                  ].map((flag) => (
                    <div key={flag.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`risk-${flag.value}`}
                        checked={selectedRiskFlags.includes(flag.value)}
                        onCheckedChange={(c) => {
                          if (c) setSelectedRiskFlags(prev => [...prev, flag.value]);
                          else setSelectedRiskFlags(prev => prev.filter(f => f !== flag.value));
                          setPage(1);
                        }}
                      />
                      <Label htmlFor={`risk-${flag.value}`} className="text-sm font-normal cursor-pointer">{flag.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* LEAD DETAIL DRAWER */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[480px] p-0" data-testid="drawer-lead-detail">
          {leadDetails ? (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {leadDetails.firstName || leadDetails.lastName ? `${leadDetails.firstName || ''} ${leadDetails.lastName || ''}`.trim() : 'Unknown Lead'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {[leadDetails.city, leadDetails.personState, leadDetails.zip].filter(Boolean).join(', ') || 'No location'}
                      </p>
                    </div>
                    {getScoreBadge(leadDetails.contactabilityScore)}
                  </div>
                  {getRiskBadges(leadDetails.riskFlags).length > 0 && (
                    <div className="flex gap-1.5 mt-2">{getRiskBadges(leadDetails.riskFlags)}</div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center">
                    <Button
                      size="lg"
                      variant={leadDetails.bestPhoneToCall ? "default" : "outline"}
                      disabled={!leadDetails.bestPhoneToCall}
                      className={`w-full h-12 ${leadDetails.bestPhoneToCall ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                      data-testid="drawer-action-call"
                    >
                      <PhoneCall className="h-5 w-5" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground mt-1 text-center">
                      {leadDetails.bestPhoneToCall ? 'CALL' : getContactBlockedReason(leadDetails, 'call')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Button
                      size="lg"
                      variant={leadDetails.bestPhoneForSms ? "default" : "outline"}
                      disabled={!leadDetails.bestPhoneForSms}
                      className={`w-full h-12 ${leadDetails.bestPhoneForSms ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                      data-testid="drawer-action-sms"
                    >
                      <MessageSquare className="h-5 w-5" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground mt-1 text-center">
                      {leadDetails.bestPhoneForSms ? 'SMS' : getContactBlockedReason(leadDetails, 'sms')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Button
                      size="lg"
                      variant={leadDetails.bestEmail ? "default" : "outline"}
                      disabled={!leadDetails.bestEmail}
                      className={`w-full h-12 ${leadDetails.bestEmail ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                      data-testid="drawer-action-email"
                    >
                      <Mail className="h-5 w-5" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground mt-1 text-center">
                      {leadDetails.bestEmail ? 'EMAIL' : getContactBlockedReason(leadDetails, 'email')}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Contact Points */}
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Contact Points
                  </h4>
                  {leadDetails.contactPoints && leadDetails.contactPoints.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs py-2">Type</TableHead>
                            <TableHead className="text-xs py-2">Value</TableHead>
                            <TableHead className="text-xs py-2 w-12">OK</TableHead>
                            <TableHead className="text-xs py-2 w-16">DNC</TableHead>
                            <TableHead className="text-xs py-2 w-16"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leadDetails.contactPoints.map((cp: ContactPoint) => (
                            <TableRow key={cp.id} data-testid={`drawer-contact-point-${cp.id}`}>
                              <TableCell className="py-1.5">
                                <div className="flex items-center gap-1">
                                  {cp.type === 'phone' ? <Phone className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                                  <span className="text-xs capitalize">{cp.subtype}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-1.5 font-mono text-xs">{cp.value}</TableCell>
                              <TableCell className="py-1.5">
                                {cp.isValid ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                              </TableCell>
                              <TableCell className="py-1.5">
                                {cp.dncStatus === 'yes' ? (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0">DNC</Badge>
                                ) : cp.optedOut ? (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0">Out</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700 text-[9px] px-1 py-0">OK</Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5">
                                <div className="flex gap-0.5">
                                  {!cp.optedOut && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => optOutMutation.mutate(cp.id)}>
                                          <Ban className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Opt out</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setPrimaryMutation.mutate({ contactPointId: cp.id, usageType: cp.type === 'phone' ? 'call' : 'email' })}>
                                        <Star className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Set primary</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">No contact points</p>
                  )}
                </div>

                {/* Insights - Collapsible */}
                <Collapsible open={showDemographics} onOpenChange={setShowDemographics}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-9 px-2">
                      <span className="flex items-center gap-2 text-sm">
                        <Info className="h-4 w-4" />
                        Insights
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showDemographics ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {leadDetails.employerName && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          Employment
                        </h5>
                        <div className="text-sm">
                          <p>{leadDetails.employerName}</p>
                          {leadDetails.jobTitle && <p className="text-muted-foreground">{leadDetails.jobTitle}</p>}
                        </div>
                      </div>
                    )}
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <h5 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Demographics
                      </h5>
                      <div className="grid grid-cols-2 gap-1.5 text-sm">
                        {leadDetails.gender && <p><span className="text-muted-foreground">Gender:</span> {leadDetails.gender}</p>}
                        {leadDetails.ageRange && <p><span className="text-muted-foreground">Age:</span> {leadDetails.ageRange}</p>}
                        {leadDetails.isHomeowner !== null && <p><span className="text-muted-foreground">Homeowner:</span> {leadDetails.isHomeowner ? 'Yes' : 'No'}</p>}
                        {leadDetails.isMarried !== null && <p><span className="text-muted-foreground">Married:</span> {leadDetails.isMarried ? 'Yes' : 'No'}</p>}
                        {leadDetails.incomeRange && <p><span className="text-muted-foreground">Income:</span> {leadDetails.incomeRange}</p>}
                        {leadDetails.netWorth && <p><span className="text-muted-foreground">Net Worth:</span> {leadDetails.netWorth}</p>}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Admin: View Raw */}
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => expandedLead && fetchRawImport(expandedLead)} className="w-full" data-testid="button-view-raw-import">
                    <FileJson className="h-4 w-4 mr-1.5" />
                    View Raw Import
                  </Button>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Batch Dialog */}
      <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-batch">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {batchToDelete?.totalRows || 0} leads from "{batchToDelete?.fileName}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchToDelete && deleteBatchMutation.mutate(batchToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBatchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Raw Import Dialog */}
      <Dialog open={rawImportDialogOpen} onOpenChange={setRawImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-raw-import">
          <DialogHeader>
            <DialogTitle>Raw Import Data</DialogTitle>
            <DialogDescription>
              Original CSV row for {rawImportData?.person?.firstName} {rawImportData?.person?.lastName}
            </DialogDescription>
          </DialogHeader>
          {rawImportData?.rawRow ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Row #{rawImportData.rawRow.rowNumber} - Imported {rawImportData.rawRow.importedAt ? format(new Date(rawImportData.rawRow.importedAt), 'PPpp') : '-'}
              </div>
              <pre className="p-3 bg-muted rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(rawImportData.rawRow.rawJson, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No raw data found.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRawImportDialogOpen(false)}>Close</Button>
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
              Upload a CSV file to import leads. Data will be automatically enriched.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
              <label htmlFor="csv-upload-input" className={`flex flex-col items-center gap-2 cursor-pointer ${uploadingCsv ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingCsv ? (
                  <>
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <span className="text-sm font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm"><span className="text-primary font-medium">Click to upload</span> or drag and drop</span>
                    <span className="text-xs text-muted-foreground">CSV files only</span>
                  </>
                )}
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Expected columns: first_name, last_name, email, phone, city, state, zip
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvUploadDialogOpen(false); if (fileInputRef.current) fileInputRef.current.value = ''; }} disabled={uploadingCsv}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
