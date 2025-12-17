import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFeatureSchema, type Feature, type InsertFeature } from "@shared/schema";
import { Plus, Edit, Trash2, Package, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function FeaturesPage() {
  const { toast } = useToast();
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Feature | null>(null);

  const { data: sessionData } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;

  const { data, isLoading } = useQuery<{ features: Feature[] }>({
    queryKey: ["/api/features"],
  });

  const features = data?.features || [];

  const createMutation = useMutation({
    mutationFn: async (values: InsertFeature) => {
      const response = await fetch("/api/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({ title: "Feature created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create feature", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<InsertFeature> }) => {
      const response = await fetch(`/api/features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({ title: "Feature updated successfully" });
      setIsDialogOpen(false);
      setEditingFeature(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to update feature", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/features/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/features"] });
      toast({ title: "Feature deleted successfully" });
      setDeleteConfirm(null);
    },
    onError: () => {
      toast({ title: "Failed to delete feature", variant: "destructive" });
      setDeleteConfirm(null);
    },
  });

  const form = useForm<InsertFeature>({
    resolver: zodResolver(insertFeatureSchema),
    defaultValues: {
      name: "",
      key: "",
      description: "",
      category: "general",
      icon: "",
      isActive: true,
    },
  });

  function openCreateDialog() {
    setEditingFeature(null);
    form.reset({
      name: "",
      key: "",
      description: "",
      category: "general",
      icon: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(feature: Feature) {
    setEditingFeature(feature);
    form.reset({
      name: feature.name,
      key: feature.key,
      description: feature.description ?? "",
      category: feature.category,
      icon: feature.icon ?? "",
      isActive: feature.isActive,
    });
    setIsDialogOpen(true);
  }

  function onSubmit(values: InsertFeature) {
    if (editingFeature) {
      updateMutation.mutate({ id: editingFeature.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  if (user?.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center h-full p-4 sm:p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              Only superadmins can manage features.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Features</CardTitle>
            <Button onClick={openCreateDialog} data-testid="button-create-feature">
              <Plus className="h-4 w-4 mr-2" />
              Create Feature
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : features.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                No Features
              </CardTitle>
              <CardDescription>
                Create your first feature to start organizing company capabilities.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.id} className="hover-elevate" data-testid={`card-feature-${feature.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg" data-testid={`text-feature-name-${feature.id}`}>
                      {feature.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" data-testid={`badge-category-${feature.id}`}>
                        {feature.category}
                      </Badge>
                      {feature.isActive ? (
                        <Badge variant="default" data-testid={`badge-status-${feature.id}`}>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" data-testid={`badge-status-${feature.id}`}>
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(feature)}
                      data-testid={`button-edit-${feature.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(feature)}
                      data-testid={`button-delete-${feature.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground" data-testid={`text-description-${feature.id}`}>
                    {feature.description || "No description provided"}
                  </p>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Key: <span className="font-mono" data-testid={`text-key-${feature.id}`}>{feature.key}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-feature-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingFeature ? "Edit Feature" : "Create Feature"}
            </DialogTitle>
            <DialogDescription>
              {editingFeature
                ? "Update the feature details below"
                : "Create a new feature that can be assigned to companies"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Consents Management" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormDescription>
                      The display name for this feature
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., consents_management" 
                        {...field} 
                        data-testid="input-key"
                        disabled={!!editingFeature}
                      />
                    </FormControl>
                    <FormDescription>
                      Unique identifier (cannot be changed after creation)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this feature does..."
                        {...field}
                        value={field.value || ""}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined} data-testid="select-category">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general" data-testid="option-general">General</SelectItem>
                        <SelectItem value="communication" data-testid="option-communication">Communication</SelectItem>
                        <SelectItem value="compliance" data-testid="option-compliance">Compliance</SelectItem>
                        <SelectItem value="analytics" data-testid="option-analytics">Analytics</SelectItem>
                        <SelectItem value="integration" data-testid="option-integration">Integration</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Group features by category
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., package" {...field} value={field.value || ""} data-testid="input-icon" />
                    </FormControl>
                    <FormDescription>
                      Lucide icon name (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Only active features can be assigned to companies
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingFeature
                    ? "Update Feature"
                    : "Create Feature"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the feature "{deleteConfirm?.name}". 
              Companies with this feature assigned will lose access to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
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
