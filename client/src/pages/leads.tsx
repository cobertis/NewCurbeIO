import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, CheckCircle, XCircle, Clock, Trash2, Upload, FileSpreadsheet, Users, ChevronDown, ChevronUp, Mail, Phone, MessageSquare, AlertTriangle, Ban, ShieldOff, Zap, PhoneCall, Eye, EyeOff, Star, Info, FileJson, Briefcase, Building } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface FormLead {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  message: string;
  landingPageId: string;
  createdAt: string;
  landingPage?: {
    title: string;
  };
}

interface Appointment {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  appointmentDate: string;
  appointmentTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string;
  createdAt: string;
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

interface ImportedLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ageRange: string | null;
  gender: string | null;
  hasChildren: boolean | null;
  isHomeowner: boolean | null;
  isMarried: boolean | null;
  netWorth: string | null;
  incomeRange: string | null;
  phones: string[] | null;
  emails: string[] | null;
  jobTitle: string | null;
  companyName: string | null;
  createdAt: string;
}

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

export default function Leads() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [importPage, setImportPage] = useState(1);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  
  // Operational leads state
  const [opBatchFilter, setOpBatchFilter] = useState<string>("all");
  const [opMinScore, setOpMinScore] = useState<number>(0);
  const [opStatusFilter, setOpStatusFilter] = useState<string>("all");
  const [opStateFilter, setOpStateFilter] = useState<string>("all");
  const [opZipFilter, setOpZipFilter] = useState<string>("");
  const [opOnlyContactable, setOpOnlyContactable] = useState<boolean>(false);
  const [opExcludeDnc, setOpExcludeDnc] = useState<boolean>(false);
  const [opSearch, setOpSearch] = useState<string>("");
  const [opHasMobileValid, setOpHasMobileValid] = useState<boolean>(false);
  const [opHasVerifiedEmail, setOpHasVerifiedEmail] = useState<boolean>(false);
  const [opSelectedRiskFlags, setOpSelectedRiskFlags] = useState<string[]>([]);
  const [opPage, setOpPage] = useState(1);
  const [expandedOpLead, setExpandedOpLead] = useState<string | null>(null);
  const [opLeadDetails, setOpLeadDetails] = useState<OperationalLeadDetails | null>(null);
  const [showDemographics, setShowDemographics] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rawImportDialogOpen, setRawImportDialogOpen] = useState(false);
  const [rawImportData, setRawImportData] = useState<any>(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabFromUrl === 'appointments' ? 'appointments' : 
    tabFromUrl === 'imported' ? 'imported' : 
    tabFromUrl === 'operational' ? 'operational' : 'leads'
  );

  const { data: leadsData, isLoading: isLoadingLeads } = useQuery<{ leads: FormLead[] }>({
    queryKey: ["/api/landing/leads"],
  });

  const { data: appointmentsData, isLoading: isLoadingAppointments } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/landing/appointments"],
  });

  const { data: batchesData, isLoading: isLoadingBatches } = useQuery<{ batches: ImportBatch[] }>({
    queryKey: ["/api/leads/import/batches"],
  });

  const { data: importedLeadsData, isLoading: isLoadingImportedLeads } = useQuery<{ leads: ImportedLead[], total: number }>({
    queryKey: ["/api/leads/import", { 
      batchId: batchFilter !== "all" ? batchFilter : undefined, 
      search: searchTerm || undefined, 
      page: importPage, 
      limit: 50 
    }],
  });

  const { data: operationalLeadsData, isLoading: isLoadingOperationalLeads } = useQuery<{ leads: OperationalLead[], total: number }>({
    queryKey: ["/api/leads/operational", {
      batchId: opBatchFilter !== "all" ? opBatchFilter : undefined,
      minScore: opMinScore > 0 ? opMinScore : undefined,
      status: opStatusFilter !== "all" ? opStatusFilter : undefined,
      state: opStateFilter !== "all" ? opStateFilter : undefined,
      onlyContactable: opOnlyContactable || undefined,
      excludeDnc: opExcludeDnc || undefined,
      hasMobileValid: opHasMobileValid || undefined,
      hasVerifiedEmail: opHasVerifiedEmail || undefined,
      zip: opZipFilter || undefined,
      riskFlags: opSelectedRiskFlags.length > 0 ? opSelectedRiskFlags.join(",") : undefined,
      search: opSearch || undefined,
      page: opPage,
      limit: 50
    }],
  });

  const { data: sessionData } = useQuery<{ user: { id: string; role: string; companyId: string } }>({
    queryKey: ["/api/session"],
  });

  const isAdmin = sessionData?.user?.role === "admin" || sessionData?.user?.role === "superadmin";

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/landing/appointments/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing/appointments"] });
      toast({ title: "Status updated" });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return await apiRequest("PATCH", `/api/landing/appointments/${id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing/appointments"] });
      toast({ title: "Notes updated successfully" });
      setAppointmentDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/landing/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing/appointments"] });
      toast({ 
        title: "Cita eliminada",
        description: "La cita ha sido eliminada correctamente"
      });
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
    },
    onError: () => {
      toast({ 
        title: "Error",
        description: "No se pudo eliminar la cita",
        variant: "destructive"
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/import/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/import"] });
      toast({ title: "CSV uploaded successfully" });
    },
    onError: () => {
      toast({ title: "Error uploading CSV", variant: "destructive" });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return await apiRequest("DELETE", `/api/leads/import/batches/${batchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/import/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/import"] });
      toast({ title: "Batch deleted successfully" });
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
      if (expandedOpLead) fetchLeadDetails(expandedOpLead);
      toast({ title: "Contact point marked as opted out" });
    },
  });

  const markInvalidMutation = useMutation({
    mutationFn: async (contactPointId: string) => {
      return await apiRequest("POST", `/api/contact-points/${contactPointId}/mark-invalid`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      if (expandedOpLead) fetchLeadDetails(expandedOpLead);
      toast({ title: "Contact point marked as invalid" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async ({ contactPointId, usageType }: { contactPointId: string; usageType: 'call' | 'sms' | 'email' }) => {
      return await apiRequest("POST", `/api/contact-points/${contactPointId}/set-primary`, { usageType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads/operational"] });
      if (expandedOpLead) fetchLeadDetails(expandedOpLead);
      toast({ title: "Primary contact updated" });
    },
  });

  const fetchLeadDetails = async (leadId: string) => {
    try {
      const response = await fetch(`/api/leads/operational/${leadId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setOpLeadDetails({ ...data.lead, contactPoints: data.contactPoints || [], employerName: data.employers?.[0]?.employerName, jobTitle: data.employers?.[0]?.jobTitle, ...data.person });
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

  const openOpLeadDrawer = async (leadId: string) => {
    setExpandedOpLead(leadId);
    setDrawerOpen(true);
    await fetchLeadDetails(leadId);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = '';
    }
  };

  const leads = leadsData?.leads || [];
  const appointments = appointmentsData?.appointments || [];
  const batches = batchesData?.batches || [];
  const importedLeads = importedLeadsData?.leads || [];
  const totalImportedLeads = importedLeadsData?.total || 0;
  const operationalLeads = operationalLeadsData?.leads || [];
  const totalOperationalLeads = operationalLeadsData?.total || 0;
  const opTotalPages = Math.ceil(totalOperationalLeads / 50);

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
    if (score >= 70) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">High ({score})</Badge>;
    } else if (score >= 40) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">Med ({score})</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">Low ({score})</Badge>;
  };

  const getRiskFlagChips = (riskFlags: OperationalLead['riskFlags']) => {
    const chips = [];
    if (riskFlags?.dnc_all) {
      chips.push(
        <Badge key="dnc" variant="destructive" className="gap-1 text-xs" data-testid="badge-risk-dnc">
          <Ban className="h-3 w-3" /> DNC_ALL
        </Badge>
      );
    }
    if (riskFlags?.no_valid_phone) {
      chips.push(
        <Badge key="no-phone" variant="secondary" className="gap-1 text-xs" data-testid="badge-risk-no-phone">
          <ShieldOff className="h-3 w-3" /> NO_VALID_PHONE
        </Badge>
      );
    }
    if (riskFlags?.all_opted_out) {
      chips.push(
        <Badge key="opted-out" variant="secondary" className="gap-1 text-xs" data-testid="badge-risk-opted-out">
          <ShieldOff className="h-3 w-3" /> ALL_OPTED_OUT
        </Badge>
      );
    }
    return chips;
  };

  const getBestContactDisplay = (lead: OperationalLead) => {
    if (lead.bestPhoneToCall && lead.bestPhoneValue) {
      return { icon: <PhoneCall className="h-4 w-4 text-green-600" />, value: maskValue(lead.bestPhoneValue, 'phone'), tooltip: 'Best phone for calling - valid and permitted' };
    }
    if (lead.bestPhoneForSms && lead.bestSmsValue) {
      return { icon: <MessageSquare className="h-4 w-4 text-blue-600" />, value: maskValue(lead.bestSmsValue, 'phone'), tooltip: 'Best phone for SMS - valid and opted-in' };
    }
    if (lead.bestEmail && lead.bestEmailValue) {
      return { icon: <Mail className="h-4 w-4 text-purple-600" />, value: maskValue(lead.bestEmailValue, 'email'), tooltip: 'Best email - valid and verified' };
    }
    return { icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />, value: 'No contact', tooltip: 'No valid contact method available' };
  };

  const getContactBlockedReason = (lead: OperationalLead, type: 'call' | 'sms' | 'email'): string | null => {
    if (type === 'call' && !lead.bestPhoneToCall) {
      if (lead.riskFlags?.dnc_all) return "Blocked: DNC on file";
      if (lead.riskFlags?.no_valid_phone) return "Blocked: No valid phone";
      return "Blocked: No phone available";
    }
    if (type === 'sms' && !lead.bestPhoneForSms) {
      if (lead.riskFlags?.all_opted_out) return "Blocked: Opted out";
      if (lead.riskFlags?.no_valid_phone) return "Blocked: No valid phone";
      return "Blocked: No SMS permitted";
    }
    if (type === 'email' && !lead.bestEmail) {
      return "Blocked: No valid email";
    }
    return null;
  };

  const toggleOpExpand = async (leadId: string) => {
    if (expandedOpLead === leadId) {
      setExpandedOpLead(null);
      setOpLeadDetails(null);
      setShowDemographics(false);
    } else {
      setExpandedOpLead(leadId);
      await fetchLeadDetails(leadId);
    }
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

  const uniqueStates = [...new Set(operationalLeads.map(l => l.personState).filter(Boolean))] as string[];

  const filteredLeads = leads
    .filter((lead) => {
      const search = searchTerm.toLowerCase();
      return (
        lead.fullName.toLowerCase().includes(search) ||
        lead.email.toLowerCase().includes(search) ||
        (lead.phone ?? "").toLowerCase().includes(search)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredAppointments = appointments
    .filter((appointment) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        appointment.fullName.toLowerCase().includes(search) ||
        appointment.email.toLowerCase().includes(search) ||
        (appointment.phone ?? "").toLowerCase().includes(search);
      const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleStatusUpdate = (id: string, newStatus: string) => {
    updateMutation.mutate({ id, status: newStatus });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" },
      confirmed: { label: "Confirmado", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
      cancelled: { label: "Cancelado", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
      completed: { label: "Completado", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-200" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge className={config.className} data-testid={`badge-status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  const getBatchStatusBadge = (status: string) => {
    const statusConfig = {
      processing: { label: "Processing", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
      completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
      failed: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.processing;
    return (
      <Badge className={config.className} data-testid={`badge-batch-status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  const getActionButtons = (appointment: Appointment) => {
    const buttons = [];
    
    if (appointment.status === "pending") {
      buttons.push(
        <Button
          key="confirm"
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate(appointment.id, "confirmed")}
          disabled={updateMutation.isPending}
          data-testid={`button-confirm-${appointment.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Confirmar
        </Button>,
        <Button
          key="cancel"
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate(appointment.id, "cancelled")}
          disabled={updateMutation.isPending}
          data-testid={`button-cancel-${appointment.id}`}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
      );
    } else if (appointment.status === "confirmed") {
      buttons.push(
        <Button
          key="complete"
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate(appointment.id, "completed")}
          disabled={updateMutation.isPending}
          data-testid={`button-complete-${appointment.id}`}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Completar
        </Button>,
        <Button
          key="cancel"
          size="sm"
          variant="outline"
          onClick={() => handleStatusUpdate(appointment.id, "cancelled")}
          disabled={updateMutation.isPending}
          data-testid={`button-cancel-${appointment.id}`}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
      );
    }
    
    buttons.push(
      <Button
        key="delete"
        size="sm"
        variant="outline"
        onClick={() => handleDeleteClick(appointment)}
        disabled={deleteMutation.isPending}
        data-testid={`button-delete-${appointment.id}`}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        Eliminar
      </Button>
    );
    
    return <>{buttons}</>;
  };

  const formatDate = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, "MMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM d, yyyy h:mm a");
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(":");
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, "h:mm a");
    } catch {
      return timeString;
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const handleRowClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditedNotes(appointment.notes || "");
    setAppointmentDialogOpen(true);
  };

  const handleSaveNotes = () => {
    if (selectedAppointment) {
      updateNotesMutation.mutate({
        id: selectedAppointment.id,
        notes: editedNotes,
      });
    }
  };

  const handleDeleteClick = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (appointmentToDelete) {
      deleteMutation.mutate(appointmentToDelete.id);
    }
  };

  const toggleExpandLead = (leadId: string) => {
    setExpandedLead(expandedLead === leadId ? null : leadId);
  };

  const totalPages = Math.ceil(totalImportedLeads / 50);

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex items-center justify-between px-4 py-4 border-b">
        <h1 className="text-2xl font-semibold">Leads</h1>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4" data-testid="tabs-list">
            <TabsTrigger value="leads" data-testid="tab-form-leads">
              Form Leads
            </TabsTrigger>
            <TabsTrigger value="appointments" data-testid="tab-appointments">
              Appointments
            </TabsTrigger>
            <TabsTrigger value="imported" data-testid="tab-imported-leads">
              Imported Leads
            </TabsTrigger>
            <TabsTrigger value="operational" data-testid="tab-operational-leads">
              Operational Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-leads"
                />
              </div>
            </div>

            {isLoadingLeads ? (
              <LoadingSpinner message="Cargando leads..." />
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg" data-testid="text-no-leads">
                  {searchTerm ? "No se encontraron leads con ese criterio" : "No hay form leads todavía"}
                </p>
                {!searchTerm && (
                  <p className="text-sm mt-2">
                    Los leads de tus landing pages aparecerán aquí
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Mensaje</TableHead>
                      <TableHead>Landing Page</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                        <TableCell className="font-medium" data-testid={`cell-name-${lead.id}`}>
                          {lead.fullName}
                        </TableCell>
                        <TableCell data-testid={`cell-email-${lead.id}`}>{lead.email}</TableCell>
                        <TableCell data-testid={`cell-phone-${lead.id}`}>{formatPhone(lead.phone)}</TableCell>
                        <TableCell 
                          className="max-w-xs truncate" 
                          title={lead.message}
                          data-testid={`cell-message-${lead.id}`}
                        >
                          {lead.message || "-"}
                        </TableCell>
                        <TableCell data-testid={`cell-landing-${lead.id}`}>
                          {lead.landingPage?.title || "-"}
                        </TableCell>
                        <TableCell data-testid={`cell-date-${lead.id}`}>
                          {formatDate(lead.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-appointments"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoadingAppointments ? (
              <LoadingSpinner message="Cargando citas..." />
            ) : filteredAppointments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg" data-testid="text-no-appointments">
                  {searchTerm || statusFilter !== "all" 
                    ? "No se encontraron citas con ese criterio" 
                    : "No hay citas todavía"}
                </p>
                {!searchTerm && statusFilter === "all" && (
                  <p className="text-sm mt-2">
                    Las citas reservadas aparecerán aquí
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((appointment) => (
                      <TableRow 
                        key={appointment.id} 
                        data-testid={`row-appointment-${appointment.id}`}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleRowClick(appointment)}
                      >
                        <TableCell className="font-medium" data-testid={`cell-name-${appointment.id}`}>
                          {appointment.fullName}
                        </TableCell>
                        <TableCell data-testid={`cell-email-${appointment.id}`}>
                          {appointment.email}
                        </TableCell>
                        <TableCell data-testid={`cell-phone-${appointment.id}`}>
                          {formatPhone(appointment.phone)}
                        </TableCell>
                        <TableCell data-testid={`cell-date-${appointment.id}`}>
                          {formatDate(appointment.appointmentDate)}
                        </TableCell>
                        <TableCell data-testid={`cell-time-${appointment.id}`}>
                          {formatTime(appointment.appointmentTime)}
                        </TableCell>
                        <TableCell data-testid={`cell-status-${appointment.id}`}>
                          {getStatusBadge(appointment.status)}
                        </TableCell>
                        <TableCell 
                          className="max-w-xs truncate" 
                          title={appointment.notes}
                          data-testid={`cell-notes-${appointment.id}`}
                        >
                          {appointment.notes || "-"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            {getActionButtons(appointment)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="imported" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or address..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setImportPage(1);
                  }}
                  className="pl-10"
                  data-testid="input-search-imported"
                />
              </div>
              <Select value={batchFilter} onValueChange={(value) => {
                setBatchFilter(value);
                setImportPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-64" data-testid="select-batch-filter">
                  <SelectValue placeholder="Filter by batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.fileName} ({batch.totalRows} rows)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  data-testid="input-csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button
                    variant="default"
                    disabled={uploadMutation.isPending}
                    asChild
                    data-testid="button-upload-csv"
                  >
                    <span className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadMutation.isPending ? "Uploading..." : "Upload CSV"}
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {batches.length > 0 && (
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileSpreadsheet className="h-4 w-4" />
                  Upload History
                </div>
                <div className="space-y-2">
                  {batches.map((batch) => (
                    <div 
                      key={batch.id} 
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      data-testid={`batch-item-${batch.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-medium text-sm">{batch.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(batch.createdAt)}
                          </p>
                        </div>
                        {getBatchStatusBadge(batch.status)}
                        {batch.status === 'processing' && (
                          <div className="w-32">
                            <Progress 
                              value={(batch.processedRows / batch.totalRows) * 100} 
                              className="h-2"
                              data-testid={`progress-batch-${batch.id}`}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {batch.processedRows} / {batch.totalRows}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">
                            <Users className="h-3 w-3 inline mr-1" />
                            {batch.totalRows} leads
                          </p>
                          {batch.errorRows > 0 && (
                            <p className="text-red-500 text-xs">
                              {batch.errorRows} errors
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteBatchMutation.mutate(batch.id)}
                          disabled={deleteBatchMutation.isPending}
                          data-testid={`button-delete-batch-${batch.id}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLoadingImportedLeads || isLoadingBatches ? (
              <LoadingSpinner message="Loading imported leads..." />
            ) : importedLeads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg" data-testid="text-no-imported-leads">
                  {searchTerm || batchFilter !== "all" 
                    ? "No imported leads match your criteria" 
                    : "No imported leads yet"}
                </p>
                <p className="text-sm mt-2">
                  Upload a CSV file to import leads
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Demographics</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedLeads.map((lead) => (
                        <>
                          <TableRow 
                            key={lead.id} 
                            data-testid={`row-imported-${lead.id}`}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleExpandLead(lead.id)}
                          >
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                data-testid={`button-expand-${lead.id}`}
                              >
                                {expandedLead === lead.id ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`cell-name-imported-${lead.id}`}>
                              {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '-'}
                            </TableCell>
                            <TableCell data-testid={`cell-location-${lead.id}`}>
                              <div className="text-sm">
                                {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.city || lead.state || '-'}
                                {lead.zip && <span className="text-muted-foreground ml-1">{lead.zip}</span>}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`cell-contact-${lead.id}`}>
                              <div className="flex flex-col gap-1">
                                {lead.phones && lead.phones.length > 0 && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {formatPhone(lead.phones[0])}
                                    {lead.phones.length > 1 && (
                                      <span className="text-xs text-muted-foreground">+{lead.phones.length - 1}</span>
                                    )}
                                  </div>
                                )}
                                {lead.emails && lead.emails.length > 0 && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate max-w-32">{lead.emails[0]}</span>
                                    {lead.emails.length > 1 && (
                                      <span className="text-xs text-muted-foreground">+{lead.emails.length - 1}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`cell-demographics-${lead.id}`}>
                              <div className="flex flex-wrap gap-1">
                                {lead.gender && (
                                  <Badge variant="secondary" className="text-xs">
                                    {lead.gender}
                                  </Badge>
                                )}
                                {lead.ageRange && (
                                  <Badge variant="secondary" className="text-xs">
                                    {lead.ageRange}
                                  </Badge>
                                )}
                                {lead.isHomeowner && (
                                  <Badge variant="outline" className="text-xs">
                                    Homeowner
                                  </Badge>
                                )}
                                {lead.isMarried && (
                                  <Badge variant="outline" className="text-xs">
                                    Married
                                  </Badge>
                                )}
                                {lead.hasChildren && (
                                  <Badge variant="outline" className="text-xs">
                                    Has Children
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell data-testid={`cell-created-${lead.id}`}>
                              {formatDateTime(lead.createdAt)}
                            </TableCell>
                          </TableRow>
                          {expandedLead === lead.id && (
                            <TableRow data-testid={`row-expanded-${lead.id}`}>
                              <TableCell colSpan={6} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Full Address</p>
                                    <p>{lead.address || '-'}</p>
                                    <p>{[lead.city, lead.state, lead.zip].filter(Boolean).join(', ') || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">All Phone Numbers</p>
                                    {lead.phones && lead.phones.length > 0 ? (
                                      lead.phones.map((phone, idx) => (
                                        <p key={idx}>{formatPhone(phone)}</p>
                                      ))
                                    ) : (
                                      <p>-</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">All Emails</p>
                                    {lead.emails && lead.emails.length > 0 ? (
                                      lead.emails.map((email, idx) => (
                                        <p key={idx}>{email}</p>
                                      ))
                                    ) : (
                                      <p>-</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Employment</p>
                                    <p>{lead.jobTitle || '-'}</p>
                                    <p className="text-muted-foreground">{lead.companyName || ''}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Financial</p>
                                    <p>Net Worth: {lead.netWorth || '-'}</p>
                                    <p>Income: {lead.incomeRange || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-muted-foreground mb-1">Personal</p>
                                    <p>Age: {lead.ageRange || '-'}</p>
                                    <p>Gender: {lead.gender || '-'}</p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                      Showing {((importPage - 1) * 50) + 1} - {Math.min(importPage * 50, totalImportedLeads)} of {totalImportedLeads} leads
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportPage(p => Math.max(1, p - 1))}
                        disabled={importPage === 1}
                        data-testid="button-prev-page"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportPage(p => Math.min(totalPages, p + 1))}
                        disabled={importPage === totalPages}
                        data-testid="button-next-page"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="operational" className="space-y-4">
            <TooltipProvider>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, phone, email, location..."
                      value={opSearch}
                      onChange={(e) => { setOpSearch(e.target.value); setOpPage(1); }}
                      className="pl-10"
                      data-testid="input-search-operational"
                    />
                  </div>
                  <Select value={opBatchFilter} onValueChange={(v) => { setOpBatchFilter(v); setOpPage(1); }}>
                    <SelectTrigger data-testid="select-op-batch-filter">
                      <SelectValue placeholder="Filter by batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Batches</SelectItem>
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.fileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={opStatusFilter} onValueChange={(v) => { setOpStatusFilter(v); setOpPage(1); }}>
                    <SelectTrigger data-testid="select-op-status-filter">
                      <SelectValue placeholder="Filter by status" />
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
                  <Select value={opStateFilter} onValueChange={(v) => { setOpStateFilter(v); setOpPage(1); }}>
                    <SelectTrigger data-testid="select-op-state-filter">
                      <SelectValue placeholder="Filter by state" />
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
                    value={opZipFilter}
                    onChange={(e) => { setOpZipFilter(e.target.value); setOpPage(1); }}
                    className="w-32"
                    data-testid="input-op-zip-filter"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3 flex-1 min-w-48">
                    <Label className="text-sm whitespace-nowrap">Min Score: {opMinScore}</Label>
                    <Slider
                      value={[opMinScore]}
                      onValueChange={(v) => { setOpMinScore(v[0]); setOpPage(1); }}
                      max={100}
                      step={5}
                      className="flex-1"
                      data-testid="slider-min-score"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="only-contactable"
                      checked={opOnlyContactable}
                      onCheckedChange={(c) => { setOpOnlyContactable(!!c); setOpPage(1); }}
                      data-testid="checkbox-only-contactable"
                    />
                    <Label htmlFor="only-contactable" className="text-sm">Only Contactable</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="exclude-dnc"
                      checked={opExcludeDnc}
                      onCheckedChange={(c) => { setOpExcludeDnc(!!c); setOpPage(1); }}
                      data-testid="checkbox-exclude-dnc"
                    />
                    <Label htmlFor="exclude-dnc" className="text-sm">Exclude DNC</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has-mobile-valid"
                      checked={opHasMobileValid}
                      onCheckedChange={(c) => { setOpHasMobileValid(!!c); setOpPage(1); }}
                      data-testid="checkbox-has-mobile-valid"
                    />
                    <Label htmlFor="has-mobile-valid" className="text-sm">Has Mobile Valid</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has-verified-email"
                      checked={opHasVerifiedEmail}
                      onCheckedChange={(c) => { setOpHasVerifiedEmail(!!c); setOpPage(1); }}
                      data-testid="checkbox-has-verified-email"
                    />
                    <Label htmlFor="has-verified-email" className="text-sm">Has Verified Email</Label>
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
                        checked={opSelectedRiskFlags.includes(flag.id)}
                        onCheckedChange={(c) => {
                          if (c) {
                            setOpSelectedRiskFlags([...opSelectedRiskFlags, flag.id]);
                          } else {
                            setOpSelectedRiskFlags(opSelectedRiskFlags.filter(f => f !== flag.id));
                          }
                          setOpPage(1);
                        }}
                        data-testid={`checkbox-risk-flag-${flag.id}`}
                      />
                      <Label htmlFor={`risk-flag-${flag.id}`} className="text-sm">{flag.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {isLoadingOperationalLeads ? (
                <LoadingSpinner fullScreen={false} message="Loading operational leads..." />
              ) : operationalLeads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg" data-testid="text-no-operational-leads">
                    No operational leads found
                  </p>
                  <p className="text-sm mt-2">
                    Import leads and they will be processed here with contactability insights
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Best Contact</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Risk Flags</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operationalLeads.map((lead) => {
                          const bestContact = getBestContactDisplay(lead);
                          return (
                            <>
                              <TableRow
                                key={lead.id}
                                data-testid={`row-operational-${lead.id}`}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => openOpLeadDrawer(lead.id)}
                              >
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    data-testid={`button-expand-op-${lead.id}`}
                                  >
                                    {expandedOpLead === lead.id ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell data-testid={`cell-lead-name-${lead.id}`}>
                                  <div className="font-medium">
                                    {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {[lead.city, lead.personState].filter(Boolean).join(', ') || '-'}
                                  </div>
                                </TableCell>
                                <TableCell data-testid={`cell-best-contact-${lead.id}`}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-2 cursor-help">
                                        {bestContact.icon}
                                        <span className="font-mono text-sm">{bestContact.value}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{bestContact.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                                <TableCell data-testid={`cell-score-${lead.id}`}>
                                  {getScoreBadge(lead.contactabilityScore)}
                                </TableCell>
                                <TableCell data-testid={`cell-risk-flags-${lead.id}`}>
                                  <div className="flex flex-wrap gap-1">
                                    {getRiskFlagChips(lead.riskFlags)}
                                    {getRiskFlagChips(lead.riskFlags).length === 0 && (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{lead.ownerName || 'Unassigned'}</TableCell>
                                <TableCell data-testid={`cell-batch-${lead.id}`}>
                                  <div className="text-sm">{lead.batchFileName || '-'}</div>
                                  {lead.batchImportedAt && (
                                    <div className="text-xs text-muted-foreground">
                                      {formatDateTime(lead.batchImportedAt)}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell data-testid={`cell-status-op-${lead.id}`} onClick={(e) => e.stopPropagation()}>
                                  <Select
                                    value={lead.status}
                                    onValueChange={(v) => updateLeadStatusMutation.mutate({ id: lead.id, status: v })}
                                    data-testid={`select-status-${lead.id}`}
                                  >
                                    <SelectTrigger className="w-32 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new">New</SelectItem>
                                      <SelectItem value="contacted">Contacted</SelectItem>
                                      <SelectItem value="qualified">Qualified</SelectItem>
                                      <SelectItem value="nurturing">Nurturing</SelectItem>
                                      <SelectItem value="converted">Converted</SelectItem>
                                      <SelectItem value="lost">Lost</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant={lead.bestPhoneToCall ? "default" : "outline"}
                                          disabled={!lead.bestPhoneToCall}
                                          className={lead.bestPhoneToCall ? "bg-green-600 hover:bg-green-700" : ""}
                                          data-testid={`button-call-${lead.id}`}
                                        >
                                          <PhoneCall className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {getContactBlockedReason(lead, 'call') || 'Call this lead'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant={lead.bestPhoneForSms ? "default" : "outline"}
                                          disabled={!lead.bestPhoneForSms}
                                          className={lead.bestPhoneForSms ? "bg-blue-600 hover:bg-blue-700" : ""}
                                          data-testid={`button-sms-${lead.id}`}
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {getContactBlockedReason(lead, 'sms') || 'Send SMS to this lead'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant={lead.bestEmail ? "default" : "outline"}
                                          disabled={!lead.bestEmail}
                                          className={lead.bestEmail ? "bg-purple-600 hover:bg-purple-700" : ""}
                                          data-testid={`button-email-${lead.id}`}
                                        >
                                          <Mail className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {getContactBlockedReason(lead, 'email') || 'Email this lead'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                              </TableRow>
                              
                              {expandedOpLead === lead.id && (
                                <TableRow data-testid={`row-expanded-op-${lead.id}`}>
                                  <TableCell colSpan={8} className="bg-muted/30 p-4">
                                    {!opLeadDetails ? (
                                      <LoadingSpinner fullScreen={false} message="Loading details..." />
                                    ) : (
                                      <div className="space-y-4">
                                        <div className="flex flex-wrap gap-2 p-3 bg-background rounded-lg border" data-testid="action-panel">
                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant={opLeadDetails.bestPhoneToCall ? "default" : "outline"}
                                              disabled={!opLeadDetails.bestPhoneToCall}
                                              className={opLeadDetails.bestPhoneToCall ? "bg-green-600 hover:bg-green-700" : ""}
                                              data-testid={`action-call-${lead.id}`}
                                            >
                                              <PhoneCall className="h-4 w-4 mr-2" />
                                              CALL
                                            </Button>
                                            {!opLeadDetails.bestPhoneToCall && (
                                              <span className="text-xs text-red-500">{getContactBlockedReason(opLeadDetails, 'call')}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant={opLeadDetails.bestPhoneForSms ? "default" : "outline"}
                                              disabled={!opLeadDetails.bestPhoneForSms}
                                              className={opLeadDetails.bestPhoneForSms ? "bg-blue-600 hover:bg-blue-700" : ""}
                                              data-testid={`action-sms-${lead.id}`}
                                            >
                                              <MessageSquare className="h-4 w-4 mr-2" />
                                              SMS
                                            </Button>
                                            {!opLeadDetails.bestPhoneForSms && (
                                              <span className="text-xs text-red-500">{getContactBlockedReason(opLeadDetails, 'sms')}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant={opLeadDetails.bestEmail ? "default" : "outline"}
                                              disabled={!opLeadDetails.bestEmail}
                                              className={opLeadDetails.bestEmail ? "bg-purple-600 hover:bg-purple-700" : ""}
                                              data-testid={`action-email-${lead.id}`}
                                            >
                                              <Mail className="h-4 w-4 mr-2" />
                                              EMAIL
                                            </Button>
                                            {!opLeadDetails.bestEmail && (
                                              <span className="text-xs text-red-500">{getContactBlockedReason(opLeadDetails, 'email')}</span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          <h4 className="font-medium text-sm">Contact Points</h4>
                                          <div className="rounded-md border">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead>Type</TableHead>
                                                  <TableHead>Subtype</TableHead>
                                                  <TableHead>Value</TableHead>
                                                  <TableHead>Valid</TableHead>
                                                  <TableHead>Verified</TableHead>
                                                  <TableHead>DNC</TableHead>
                                                  <TableHead>Opted Out</TableHead>
                                                  <TableHead>Actions</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {opLeadDetails.contactPoints?.length > 0 ? (
                                                  opLeadDetails.contactPoints.map((cp) => (
                                                    <TableRow key={cp.id} data-testid={`row-contact-point-${cp.id}`}>
                                                      <TableCell>
                                                        {cp.type === 'phone' ? (
                                                          <Phone className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                          <Mail className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                      </TableCell>
                                                      <TableCell className="text-xs capitalize">{cp.subtype}</TableCell>
                                                      <TableCell className="font-mono text-sm">
                                                        {maskValue(cp.value, cp.type)}
                                                      </TableCell>
                                                      <TableCell>
                                                        {cp.isValid ? (
                                                          <Badge className="bg-green-100 text-green-800 text-xs">Valid</Badge>
                                                        ) : (
                                                          <Badge variant="secondary" className="text-xs">Invalid</Badge>
                                                        )}
                                                      </TableCell>
                                                      <TableCell>
                                                        {cp.isVerified ? (
                                                          <Badge className="bg-blue-100 text-blue-800 text-xs">Verified</Badge>
                                                        ) : (
                                                          <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell>
                                                        {cp.dncStatus === 'yes' ? (
                                                          <Badge variant="destructive" className="text-xs">DNC</Badge>
                                                        ) : cp.dncStatus === 'no' ? (
                                                          <Badge className="bg-green-100 text-green-800 text-xs">Clear</Badge>
                                                        ) : (
                                                          <span className="text-xs text-muted-foreground">Unknown</span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell>
                                                        {cp.optedOut ? (
                                                          <Badge variant="destructive" className="text-xs">Opted Out</Badge>
                                                        ) : (
                                                          <span className="text-xs text-muted-foreground">-</span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell>
                                                        <div className="flex gap-1">
                                                          {!cp.optedOut && (
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              onClick={() => optOutMutation.mutate(cp.id)}
                                                              disabled={optOutMutation.isPending}
                                                              data-testid={`button-opt-out-${cp.id}`}
                                                            >
                                                              <EyeOff className="h-3 w-3" />
                                                            </Button>
                                                          )}
                                                          {cp.isValid && (
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              onClick={() => markInvalidMutation.mutate(cp.id)}
                                                              disabled={markInvalidMutation.isPending}
                                                              data-testid={`button-mark-invalid-${cp.id}`}
                                                            >
                                                              <XCircle className="h-3 w-3" />
                                                            </Button>
                                                          )}
                                                          {cp.type === 'phone' && (
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              onClick={() => setPrimaryMutation.mutate({ contactPointId: cp.id, usageType: 'call' })}
                                                              disabled={setPrimaryMutation.isPending}
                                                              data-testid={`button-set-primary-call-${cp.id}`}
                                                            >
                                                              <Star className="h-3 w-3" />
                                                            </Button>
                                                          )}
                                                        </div>
                                                      </TableCell>
                                                    </TableRow>
                                                  ))
                                                ) : (
                                                  <TableRow>
                                                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                                                      No contact points found
                                                    </TableCell>
                                                  </TableRow>
                                                )}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>

                                        <Collapsible open={showDemographics} onOpenChange={setShowDemographics}>
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-toggle-demographics">
                                              {showDemographics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                              Demographics & Employment
                                            </Button>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="mt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-background rounded-lg border">
                                              <div>
                                                <p className="font-medium text-muted-foreground mb-1 text-sm">Employment</p>
                                                <p className="text-sm">{opLeadDetails.jobTitle || '-'}</p>
                                                <p className="text-sm text-muted-foreground">{opLeadDetails.employerName || ''}</p>
                                              </div>
                                              <div>
                                                <p className="font-medium text-muted-foreground mb-1 text-sm">Demographics</p>
                                                <p className="text-sm">Age: {opLeadDetails.ageRange || '-'}</p>
                                                <p className="text-sm">Gender: {opLeadDetails.gender || '-'}</p>
                                              </div>
                                              <div>
                                                <p className="font-medium text-muted-foreground mb-1 text-sm">Personal</p>
                                                <div className="flex flex-wrap gap-1">
                                                  {opLeadDetails.isHomeowner && <Badge variant="outline" className="text-xs">Homeowner</Badge>}
                                                  {opLeadDetails.isMarried && <Badge variant="outline" className="text-xs">Married</Badge>}
                                                  {opLeadDetails.hasChildren && <Badge variant="outline" className="text-xs">Has Children</Badge>}
                                                </div>
                                              </div>
                                              <div>
                                                <p className="font-medium text-muted-foreground mb-1 text-sm">Financial</p>
                                                <p className="text-sm">Net Worth: {opLeadDetails.netWorth || '-'}</p>
                                                <p className="text-sm">Income: {opLeadDetails.incomeRange || '-'}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                              <Info className="h-3 w-3" />
                                              <span>Inferred data, may be inaccurate</span>
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {opTotalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground" data-testid="text-op-pagination-info">
                        Showing {((opPage - 1) * 50) + 1} - {Math.min(opPage * 50, totalOperationalLeads)} of {totalOperationalLeads} leads
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOpPage(p => Math.max(1, p - 1))}
                          disabled={opPage === 1}
                          data-testid="button-op-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOpPage(p => Math.min(opTotalPages, p + 1))}
                          disabled={opPage === opTotalPages}
                          data-testid="button-op-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TooltipProvider>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={appointmentDialogOpen} onOpenChange={setAppointmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Client Name</label>
                <p className="text-sm font-medium">{selectedAppointment.fullName}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{selectedAppointment.email}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="text-sm">{formatPhone(selectedAppointment.phone)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date</label>
                  <p className="text-sm">{formatDate(selectedAppointment.appointmentDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Time</label>
                  <p className="text-sm">{formatTime(selectedAppointment.appointmentTime)}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="mt-1">
                  {getStatusBadge(selectedAppointment.status)}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <Textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Add notes about this appointment..."
                  rows={4}
                  className="mt-1"
                  data-testid="textarea-appointment-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setAppointmentDialogOpen(false)}
                  data-testid="button-cancel-dialog"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNotes}
                  disabled={updateNotesMutation.isPending}
                  data-testid="button-save-notes"
                >
                  {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cita?</AlertDialogTitle>
            <AlertDialogDescription>
              {appointmentToDelete && (
                <>
                  Esta acción no se puede deshacer. Se eliminará permanentemente la cita de{" "}
                  <strong>{appointmentToDelete.fullName}</strong> programada para el{" "}
                  <strong>{formatDate(appointmentToDelete.appointmentDate)}</strong> a las{" "}
                  <strong>{formatTime(appointmentToDelete.appointmentTime)}</strong>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Operational Lead Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(open) => {
        setDrawerOpen(open);
        if (!open) {
          setExpandedOpLead(null);
          setOpLeadDetails(null);
          setShowDemographics(false);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" data-testid="drawer-operational-lead">
          <SheetHeader>
            <SheetTitle data-testid="drawer-lead-name">
              {opLeadDetails ? [opLeadDetails.firstName, opLeadDetails.lastName].filter(Boolean).join(' ') || 'Unknown' : 'Loading...'}
            </SheetTitle>
            <SheetDescription data-testid="drawer-lead-location">
              {opLeadDetails ? [opLeadDetails.city, opLeadDetails.personState, opLeadDetails.zip].filter(Boolean).join(', ') || 'No location' : ''}
            </SheetDescription>
          </SheetHeader>
          
          {!opLeadDetails ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner fullScreen={false} message="Loading lead details..." />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-120px)] pr-4">
              <div className="space-y-6 py-4">
                {/* Status and Score Badges */}
                <div className="flex items-center gap-3 flex-wrap" data-testid="drawer-badges">
                  {getPipelineStatusBadge(opLeadDetails.status)}
                  <Badge variant="outline" className="text-sm" data-testid="badge-contactability-score">
                    Score: {opLeadDetails.contactabilityScore || 0}
                  </Badge>
                  {opLeadDetails.riskFlags && Object.entries(opLeadDetails.riskFlags).filter(([_, v]) => v).length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="destructive" className="flex items-center gap-1" data-testid="badge-risk-flags">
                            <AlertTriangle className="h-3 w-3" />
                            {Object.entries(opLeadDetails.riskFlags).filter(([_, v]) => v).length} Risk Flags
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {Object.entries(opLeadDetails.riskFlags).filter(([_, v]) => v).map(([k]) => (
                            <div key={k}>{k.replace(/_/g, ' ')}</div>
                          ))}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Action Panel */}
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border" data-testid="drawer-action-panel">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={opLeadDetails.bestPhoneToCall ? "default" : "outline"}
                      disabled={!opLeadDetails.bestPhoneToCall}
                      className={opLeadDetails.bestPhoneToCall ? "bg-green-600 hover:bg-green-700" : ""}
                      data-testid="drawer-action-call"
                    >
                      <PhoneCall className="h-4 w-4 mr-2" />
                      CALL
                    </Button>
                    {!opLeadDetails.bestPhoneToCall && (
                      <span className="text-xs text-red-500">{getContactBlockedReason(opLeadDetails, 'call')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={opLeadDetails.bestPhoneForSms ? "default" : "outline"}
                      disabled={!opLeadDetails.bestPhoneForSms}
                      className={opLeadDetails.bestPhoneForSms ? "bg-blue-600 hover:bg-blue-700" : ""}
                      data-testid="drawer-action-sms"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SMS
                    </Button>
                    {!opLeadDetails.bestPhoneForSms && (
                      <span className="text-xs text-red-500">{getContactBlockedReason(opLeadDetails, 'sms')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={opLeadDetails.bestEmail ? "default" : "outline"}
                      disabled={!opLeadDetails.bestEmail}
                      className={opLeadDetails.bestEmail ? "bg-purple-600 hover:bg-purple-700" : ""}
                      data-testid="drawer-action-email"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      EMAIL
                    </Button>
                    {!opLeadDetails.bestEmail && (
                      <span className="text-xs text-red-500">{getContactBlockedReason(opLeadDetails, 'email')}</span>
                    )}
                  </div>
                </div>

                {/* Contact Points Table */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2" data-testid="section-contact-points">
                    <Phone className="h-4 w-4" />
                    Contact Points
                  </h4>
                  {opLeadDetails.contactPoints && opLeadDetails.contactPoints.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">Type</TableHead>
                            <TableHead>Subtype</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead className="w-16">Valid</TableHead>
                            <TableHead className="w-16">Verified</TableHead>
                            <TableHead className="w-20">DNC</TableHead>
                            <TableHead className="w-20">Opted Out</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {opLeadDetails.contactPoints.map((cp: ContactPoint) => (
                            <TableRow key={cp.id} data-testid={`drawer-contact-point-${cp.id}`}>
                              <TableCell>
                                {cp.type === 'phone' ? (
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="text-xs capitalize">{cp.subtype}</TableCell>
                              <TableCell className="font-mono text-sm" data-testid={`contact-value-${cp.id}`}>
                                {cp.value}
                              </TableCell>
                              <TableCell>
                                {cp.isValid ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                {cp.isVerified ? (
                                  <CheckCircle className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {cp.dncStatus === 'yes' ? (
                                  <Badge variant="destructive" className="text-xs">DNC</Badge>
                                ) : cp.dncStatus === 'no' ? (
                                  <Badge className="bg-green-100 text-green-800 text-xs">Clear</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Unknown</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {cp.optedOut ? (
                                  <Badge variant="destructive" className="text-xs">Opted Out</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {!cp.optedOut && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => optOutMutation.mutate(cp.id)}
                                            data-testid={`button-optout-${cp.id}`}
                                          >
                                            <Ban className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mark as opted out</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {cp.isValid && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                            onClick={() => markInvalidMutation.mutate(cp.id)}
                                            data-testid={`button-invalid-${cp.id}`}
                                          >
                                            <ShieldOff className="h-3 w-3" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mark as invalid</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0"
                                          onClick={() => setPrimaryMutation.mutate({ 
                                            contactPointId: cp.id, 
                                            usageType: cp.type === 'phone' ? 'call' : 'email' 
                                          })}
                                          data-testid={`button-primary-${cp.id}`}
                                        >
                                          <Star className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Set as primary</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No contact points available</p>
                  )}
                </div>

                {/* Insights Panel (Collapsible) */}
                <Collapsible open={showDemographics} onOpenChange={setShowDemographics}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-insights">
                      <span className="flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Insights & Demographics
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${showDemographics ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-2">
                    {/* Employment Info */}
                    {opLeadDetails.employerName && (
                      <div className="p-3 bg-muted/30 rounded-lg" data-testid="section-employment">
                        <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                          <Building className="h-4 w-4" />
                          Employment
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Company:</span>
                            <span className="ml-2">{opLeadDetails.employerName}</span>
                          </div>
                          {opLeadDetails.jobTitle && (
                            <div>
                              <span className="text-muted-foreground">Title:</span>
                              <span className="ml-2">{opLeadDetails.jobTitle}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Demographics */}
                    <div className="p-3 bg-muted/30 rounded-lg" data-testid="section-demographics">
                      <h5 className="text-sm font-medium flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4" />
                        Demographics
                        <Badge variant="outline" className="text-xs ml-auto">Inferred data, may be inaccurate</Badge>
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {opLeadDetails.gender && (
                          <div>
                            <span className="text-muted-foreground">Gender:</span>
                            <span className="ml-2 capitalize">{opLeadDetails.gender}</span>
                          </div>
                        )}
                        {opLeadDetails.ageRange && (
                          <div>
                            <span className="text-muted-foreground">Age Range:</span>
                            <span className="ml-2">{opLeadDetails.ageRange}</span>
                          </div>
                        )}
                        {opLeadDetails.hasChildren !== null && (
                          <div>
                            <span className="text-muted-foreground">Has Children:</span>
                            <span className="ml-2">{opLeadDetails.hasChildren ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {opLeadDetails.isHomeowner !== null && (
                          <div>
                            <span className="text-muted-foreground">Homeowner:</span>
                            <span className="ml-2">{opLeadDetails.isHomeowner ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {opLeadDetails.isMarried !== null && (
                          <div>
                            <span className="text-muted-foreground">Married:</span>
                            <span className="ml-2">{opLeadDetails.isMarried ? 'Yes' : 'No'}</span>
                          </div>
                        )}
                        {opLeadDetails.netWorth && (
                          <div>
                            <span className="text-muted-foreground">Net Worth:</span>
                            <span className="ml-2">{opLeadDetails.netWorth}</span>
                          </div>
                        )}
                        {opLeadDetails.incomeRange && (
                          <div>
                            <span className="text-muted-foreground">Income:</span>
                            <span className="ml-2">{opLeadDetails.incomeRange}</span>
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
                      onClick={() => expandedOpLead && fetchRawImport(expandedOpLead)}
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
    </div>
  );
}
