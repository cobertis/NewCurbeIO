import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function Leads() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Get tab from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl === 'appointments' ? 'appointments' : 'leads');

  const { data: leadsData, isLoading: isLoadingLeads } = useQuery<{ leads: FormLead[] }>({
    queryKey: ["/api/landing/leads"],
  });

  const { data: appointmentsData, isLoading: isLoadingAppointments } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/landing/appointments"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/landing/appointments/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing/appointments"] });
      toast({ title: "Estado actualizado" });
    },
  });

  const leads = leadsData?.leads || [];
  const appointments = appointmentsData?.appointments || [];

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

  const getActionButtons = (appointment: Appointment) => {
    if (appointment.status === "pending") {
      return (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate(appointment.id, "confirmed")}
            disabled={updateMutation.isPending}
            data-testid={`button-confirm-${appointment.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Confirmar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate(appointment.id, "cancelled")}
            disabled={updateMutation.isPending}
            data-testid={`button-cancel-${appointment.id}`}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </>
      );
    } else if (appointment.status === "confirmed") {
      return (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate(appointment.id, "completed")}
            disabled={updateMutation.isPending}
            data-testid={`button-complete-${appointment.id}`}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Completar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate(appointment.id, "cancelled")}
            disabled={updateMutation.isPending}
            data-testid={`button-cancel-${appointment.id}`}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </>
      );
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse date as YYYY-MM-DD without timezone conversion
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, "MMM d, yyyy");
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

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-semibold">Leads</h1>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4" data-testid="tabs-list">
            <TabsTrigger value="leads" data-testid="tab-form-leads">
              Form Leads
            </TabsTrigger>
            <TabsTrigger value="appointments" data-testid="tab-appointments">
              Appointments
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
                      <TableRow key={appointment.id} data-testid={`row-appointment-${appointment.id}`}>
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
                        <TableCell>
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
        </Tabs>
      </div>
    </div>
  );
}
