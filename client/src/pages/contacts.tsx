import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { type User, type UnifiedContact } from "@shared/schema";
import { useState, useMemo } from "react";
import { formatForDisplay } from "@shared/phone";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data, isLoading } = useQuery<{ contacts: UnifiedContact[] }>({
    queryKey: ["/api/contacts/unified"],
  });

  const currentUser = sessionData?.user;
  const contacts = data?.contacts || [];

  // Access control: Only admins and superadmins
  if (currentUser && currentUser.role !== "superadmin" && currentUser.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Only admins and superadmins can access unified contacts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    contacts.forEach(contact => contact.status.forEach(s => statuses.add(s)));
    return Array.from(statuses).sort();
  }, [contacts]);

  const uniqueProductTypes = useMemo(() => {
    const types = new Set<string>();
    contacts.forEach(contact => contact.productType.forEach(t => t && types.add(t)));
    return Array.from(types).sort();
  }, [contacts]);

  const uniqueOrigins = useMemo(() => {
    const origins = new Set<string>();
    contacts.forEach(contact => contact.origin.forEach(o => origins.add(o)));
    return Array.from(origins).sort();
  }, [contacts]);

  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    contacts.forEach(contact => contact.companyName && companies.add(contact.companyName));
    return Array.from(companies).sort();
  }, [contacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Excluir contactos sin email ni teléfono
      if (!contact.email && !contact.phone) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const firstName = contact.firstName?.toLowerCase() || "";
        const lastName = contact.lastName?.toLowerCase() || "";
        const email = contact.email?.toLowerCase() || "";
        const phone = contact.phone ? formatForDisplay(contact.phone) : "";
        const fullName = `${firstName} ${lastName}`.trim();

        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !phone.includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "all" && !contact.status.includes(statusFilter)) {
        return false;
      }

      // Product type filter
      if (productTypeFilter !== "all" && !contact.productType.includes(productTypeFilter)) {
        return false;
      }

      // Origin filter
      if (originFilter !== "all" && !contact.origin.includes(originFilter as any)) {
        return false;
      }

      // Company filter
      if (companyFilter !== "all" && contact.companyName !== companyFilter) {
        return false;
      }

      return true;
    });
  }, [contacts, searchQuery, statusFilter, productTypeFilter, originFilter, companyFilter]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Nombre",
      "Email",
      "Teléfono",
      "Estado",
      "Tipo de Seguro",
      "Origen",
      "Compañía",
      "Fecha Nacimiento",
      "SSN"
    ];

    const rows = filteredContacts.map(contact => [
      `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
      contact.email || "",
      contact.phone ? formatForDisplay(contact.phone) : "",
      contact.status.join("; "),
      contact.productType.filter(Boolean).join("; "),
      contact.origin.join("; "),
      contact.companyName || "",
      contact.dateOfBirth || "",
      contact.ssn || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `contacts-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Cargando contactos..." fullScreen={false} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contactos Unificados</h1>
          <p className="text-muted-foreground">
            Vista consolidada de todos los contactos del sistema
          </p>
        </div>
        <Badge variant="secondary" data-testid="badge-contact-count">
          {filteredContacts.length} {filteredContacts.length === 1 ? "Contacto" : "Contactos"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Search bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-product-type">
                  <SelectValue placeholder="Tipo de Seguro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {uniqueProductTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-origin">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los orígenes</SelectItem>
                  {uniqueOrigins.map(origin => (
                    <SelectItem key={origin} value={origin}>
                      {origin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-company">
                  <SelectValue placeholder="Compañía" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las compañías</SelectItem>
                  {uniqueCompanies.map(company => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto">
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  disabled={filteredContacts.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground" data-testid="text-no-contacts">
                {searchQuery || statusFilter !== "all" || productTypeFilter !== "all" || originFilter !== "all" || companyFilter !== "all"
                  ? "No se encontraron contactos que coincidan con los filtros."
                  : "No hay contactos disponibles."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tipo de Seguro</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Compañía</TableHead>
                    <TableHead>Fecha Nacimiento</TableHead>
                    {currentUser?.role === "superadmin" && <TableHead>SSN</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                      <TableCell data-testid={`text-contact-name-${contact.id}`}>
                        {contact.firstName && contact.lastName
                          ? `${contact.firstName} ${contact.lastName}`
                          : contact.firstName || contact.lastName || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-contact-email-${contact.id}`}>
                        {contact.email || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-contact-phone-${contact.id}`}>
                        {contact.phone ? formatForDisplay(contact.phone) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.status.map((status, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-contact-status-${contact.id}-${idx}`}>
                              {status}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-contact-product-type-${contact.id}`}>
                        <div className="flex flex-wrap gap-1">
                          {contact.productType.filter(Boolean).map((type, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {contact.productType.filter(Boolean).length === 0 && "—"}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-contact-origin-${contact.id}`}>
                        <div className="flex flex-wrap gap-1">
                          {contact.origin.map((origin, idx) => (
                            <Badge key={idx} variant="default" className="text-xs">
                              {origin}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-contact-company-${contact.id}`}>
                        {contact.companyName || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-contact-dob-${contact.id}`}>
                        {formatDate(contact.dateOfBirth)}
                      </TableCell>
                      {currentUser?.role === "superadmin" && (
                        <TableCell data-testid={`text-contact-ssn-${contact.id}`}>
                          {contact.ssn || "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
