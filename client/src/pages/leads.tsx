import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, CheckCircle, XCircle, Clock, Trash2, Upload, FileSpreadsheet, Users, ChevronDown, ChevronUp, Mail, Phone } from "lucide-react";
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
  
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabFromUrl === 'appointments' ? 'appointments' : 
    tabFromUrl === 'imported' ? 'imported' : 'leads'
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
    queryKey: ["/api/leads/import", { batchId: batchFilter, search: searchTerm, page: importPage, limit: 50 }],
  });

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
    </div>
  );
}
