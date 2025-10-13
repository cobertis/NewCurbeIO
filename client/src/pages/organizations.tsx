import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOrganizationSchema, type Organization } from "@shared/schema";
import { useState } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const orgFormSchema = insertOrganizationSchema;

type OrgForm = z.infer<typeof orgFormSchema>;

export default function Organizations() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ organizations: Organization[] }>({
    queryKey: ["/api/organizations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: OrgForm) => {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setCreateOpen(false);
      createForm.reset();
      toast({
        title: "Organización creada",
        description: "La organización ha sido creada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la organización",
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: Partial<OrgForm> & { id: string }) => {
      const { id, ...rest } = data;
      const response = await fetch(`/api/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(rest),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      setEditOpen(false);
      setSelectedOrg(null);
      editForm.reset();
      toast({
        title: "Organización actualizada",
        description: "La organización ha sido actualizada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la organización",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/organizations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({
        title: "Organización eliminada",
        description: "La organización ha sido eliminada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la organización",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<OrgForm>({
    resolver: zodResolver(orgFormSchema),
    defaultValues: {
      name: "",
      domain: "",
    },
  });

  const editForm = useForm<Partial<OrgForm>>({
    resolver: zodResolver(orgFormSchema.partial()),
    defaultValues: {
      name: "",
      domain: "",
    },
  });

  const onCreateSubmit = (data: OrgForm) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: Partial<OrgForm>) => {
    if (selectedOrg) {
      editMutation.mutate({ ...data, id: selectedOrg.id });
    }
  };

  const handleEdit = (org: Organization) => {
    setSelectedOrg(org);
    editForm.reset({
      name: org.name,
      domain: org.domain ?? "",
    });
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta organización?")) {
      deleteMutation.mutate(id);
    }
  };

  const organizations = data?.organizations || [];
  const filteredOrganizations = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Organizaciones</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Gestiona las organizaciones del sistema</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-organization">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Organización
        </Button>
      </div>

      <Card className="bg-white dark:text-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Lista de Organizaciones</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar organizaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-organizations"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredOrganizations.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay organizaciones</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrganizations.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    data-testid={`org-item-${org.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white" data-testid={`text-org-name-${org.id}`}>
                          {org.name}
                        </h3>
                        {org.domain && (
                          <p className="text-sm text-gray-500 dark:text-gray-400" data-testid={`text-org-domain-${org.id}`}>
                            {org.domain}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(org)}
                        data-testid={`button-edit-org-${org.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(org.id)}
                        data-testid={`button-delete-org-${org.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-create-organization">
          <DialogHeader>
            <DialogTitle>Nueva Organización</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la organización" {...field} data-testid="input-create-org-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dominio (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ejemplo.com" {...field} value={field.value ?? ""} data-testid="input-create-org-domain" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create-org">
                  {createMutation.isPending ? "Creando..." : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="dialog-edit-organization">
          <DialogHeader>
            <DialogTitle>Editar Organización</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la organización" {...field} data-testid="input-edit-org-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dominio (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="ejemplo.com" {...field} value={field.value ?? ""} data-testid="input-edit-org-domain" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={editMutation.isPending} data-testid="button-submit-edit-org">
                  {editMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
