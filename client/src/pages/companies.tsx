import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Trash2, Search, Package, Power, Settings2, Eye, EyeOff, Copy, CheckCircle, AlertCircle, AlertTriangle, Zap, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCompanyWithAdminSchema, type Company, type Feature, type User } from "@shared/schema";
import { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatForDisplay, formatPhoneInput } from "@shared/phone";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { BusinessAutocomplete } from "@/components/business-autocomplete";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Function to generate slug from company name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

type CreateCompanyForm = z.infer<typeof createCompanyWithAdminSchema>;

export default function Companies() {
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [imessageConfigOpen, setImessageConfigOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const { toast } = useToast();

  // Get session data to check if user is superadmin
  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const isSuperadmin = userData?.user?.role === "superadmin";

  const { data, isLoading } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompanyForm) => {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create company");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setCreateOpen(false);
      createForm.reset();
      setSlugManuallyEdited(false);
      toast({
        title: "Company Created",
        description: "The company and admin user have been created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/companies/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Company Deleted",
        description: "The company has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/companies/${id}/toggle-status`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to toggle company status");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      const status = data.company.isActive ? "enabled" : "disabled";
      toast({
        title: `Company ${status}`,
        description: `The company has been ${status} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle company status",
        variant: "destructive",
      });
    },
  });

  const { data: allFeaturesData } = useQuery<{ features: Feature[] }>({
    queryKey: ["/api/features"],
    enabled: featuresOpen,
  });

  const { data: companyFeaturesData, isLoading: isLoadingCompanyFeatures } = useQuery<{ features: Feature[] }>({
    queryKey: ["/api/companies", selectedCompany?.id, "features"],
    queryFn: async () => {
      if (!selectedCompany?.id) throw new Error("No company selected");
      const response = await fetch(`/api/companies/${selectedCompany.id}/features`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company features");
      return response.json();
    },
    enabled: featuresOpen && !!selectedCompany?.id,
  });

  const addFeatureMutation = useMutation({
    mutationFn: async ({ companyId, featureId }: { companyId: string; featureId: string }) => {
      console.log(`[FEATURE-TOGGLE] Starting POST to /api/companies/${companyId}/features with featureId:`, featureId);
      try {
        const response = await fetch(`/api/companies/${companyId}/features`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ featureId }),
        });
        console.log(`[FEATURE-TOGGLE] Response status:`, response.status, response.statusText);
        if (!response.ok) {
          const error = await response.json();
          console.error(`[FEATURE-TOGGLE] Server error:`, error);
          throw new Error(error.message || "Failed to add feature");
        }
        const data = await response.json();
        console.log(`[FEATURE-TOGGLE] Success:`, data);
        return data;
      } catch (err) {
        console.error(`[FEATURE-TOGGLE] Fetch error:`, err);
        throw err;
      }
    },
    onMutate: async ({ companyId, featureId }) => {
      console.log(`[FEATURE-TOGGLE] onMutate called for company ${companyId}, feature ${featureId}`);
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/companies", companyId, "features"] });
      
      // Get current features
      const previousFeatures = queryClient.getQueryData<{ features: Feature[] }>(["/api/companies", companyId, "features"]);
      
      // Get the feature details
      const allFeatures = queryClient.getQueryData<{ features: Feature[] }>(["/api/features"]);
      const featureToAdd = allFeatures?.features.find(f => f.id === featureId);
      
      // Optimistically update cache
      if (previousFeatures && previousFeatures.features && Array.isArray(previousFeatures.features) && featureToAdd) {
        queryClient.setQueryData(["/api/companies", companyId, "features"], {
          features: [...previousFeatures.features, featureToAdd]
        });
      }
      
      return { previousFeatures };
    },
    onSuccess: async (_, { companyId }) => {
      console.log(`[FEATURE-TOGGLE] onSuccess called, invalidating cache`);
      // Invalidate will automatically trigger a refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "features"] });
      toast({
        title: "Feature Added",
        description: "The feature has been added to the company",
        duration: 3000,
      });
    },
    onError: (error, { companyId }, context) => {
      console.error(`[FEATURE-TOGGLE] onError called:`, error);
      console.error(`[FEATURE-TOGGLE] Error details:`, { message: (error as Error).message, stack: (error as Error).stack });
      // Rollback on error
      if (context?.previousFeatures) {
        queryClient.setQueryData(["/api/companies", companyId, "features"], context.previousFeatures);
      }
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to add feature",
        variant: "destructive",
      });
    },
  });

  const removeFeatureMutation = useMutation({
    mutationFn: async ({ companyId, featureId }: { companyId: string; featureId: string }) => {
      const response = await fetch(`/api/companies/${companyId}/features/${featureId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove feature");
      }
      return response.json();
    },
    onMutate: async ({ companyId, featureId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/companies", companyId, "features"] });
      
      // Get current features
      const previousFeatures = queryClient.getQueryData<{ features: Feature[] }>(["/api/companies", companyId, "features"]);
      
      // Optimistically update cache
      if (previousFeatures) {
        queryClient.setQueryData(["/api/companies", companyId, "features"], {
          features: previousFeatures.features.filter(f => f.id !== featureId)
        });
      }
      
      return { previousFeatures };
    },
    onSuccess: async (_, { companyId }) => {
      // Invalidate will automatically trigger a refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "features"] });
      toast({
        title: "Feature Removed",
        description: "The feature has been removed from the company",
        duration: 3000,
      });
    },
    onError: (_, { companyId }, context) => {
      // Rollback on error
      if (context?.previousFeatures) {
        queryClient.setQueryData(["/api/companies", companyId, "features"], context.previousFeatures);
      }
      toast({
        title: "Error",
        description: "Failed to remove feature",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanyWithAdminSchema),
    defaultValues: {
      company: {
        name: "",
        slug: "",
        phone: "",
        address: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "United States",
      },
      admin: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
    },
  });


  const onCreateSubmit = (data: CreateCompanyForm) => {
    console.log("=== FORM SUBMITTED ===");
    console.log("Creating company with data:", data);
    console.log("Form errors:", createForm.formState.errors);
    createMutation.mutate(data);
  };


  const handleDelete = (id: string) => {
    setDeleteCompanyId(id);
  };

  const confirmDelete = () => {
    if (deleteCompanyId) {
      deleteMutation.mutate(deleteCompanyId);
      setDeleteCompanyId(null);
    }
  };

  const handleManageFeatures = (company: Company) => {
    setSelectedCompany(company);
    setFeaturesOpen(true);
  };

  const allFeatures = allFeaturesData?.features || [];
  const companyFeatures = companyFeaturesData?.features || [];
  const companyFeatureIds = new Set(companyFeatures.map(f => f.id));

  const handleToggleFeature = (featureId: string) => {
    if (!selectedCompany) return;
    
    if (companyFeatureIds.has(featureId)) {
      removeFeatureMutation.mutate({ companyId: selectedCompany.id, featureId });
    } else {
      addFeatureMutation.mutate({ companyId: selectedCompany.id, featureId });
    }
  };

  // iMessage configuration logic
  const { data: imessageSettingsData, isLoading: loadingImessageSettings } = useQuery<{ settings: any }>({
    queryKey: ["/api/imessage/settings", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const response = await fetch(`/api/imessage/settings?companyId=${selectedCompany.id}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch iMessage settings");
      }
      return response.json();
    },
    enabled: imessageConfigOpen && isSuperadmin && !!selectedCompany?.id,
  });

  const currentImessageSettings = imessageSettingsData?.settings || imessageSettingsData || {};

  // Form schema for iMessage settings
  const imessageFormSchema = z.object({
    serverUrl: z.string().url("Must be a valid URL").min(1, "Server URL is required"),
    password: z.string().min(1, "Password is required"),
    isEnabled: z.boolean(),
  });

  // Form for iMessage settings
  const imessageForm = useForm({
    resolver: zodResolver(imessageFormSchema),
    defaultValues: {
      serverUrl: currentImessageSettings.serverUrl || "",
      password: currentImessageSettings.password || "",
      isEnabled: currentImessageSettings.isEnabled || false,
    },
  });

  // Update form when settings load
  useEffect(() => {
    // Only reset when we actually have settings data loaded
    if (imessageSettingsData && currentImessageSettings) {
      imessageForm.reset({
        serverUrl: currentImessageSettings.serverUrl || "",
        password: currentImessageSettings.password || "",
        isEnabled: currentImessageSettings.isEnabled || false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imessageSettingsData]);

  // Set webhook URL when selected company changes
  useEffect(() => {
    if (typeof window !== "undefined" && selectedCompany?.slug) {
      const domain = window.location.origin;
      setWebhookUrl(`${domain}/api/imessage/webhook/${selectedCompany.slug}`);
    }
  }, [selectedCompany]);

  // Save iMessage settings mutation
  const saveImessageSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedCompany?.id) {
        throw new Error("No company selected");
      }
      const response = await fetch(`/api/imessage/settings?companyId=${selectedCompany.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/settings", selectedCompany?.id] });
      toast({
        title: "Settings saved",
        description: "iMessage settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveImessageSettings = imessageForm.handleSubmit((data) => {
    // Reset password visibility when saving
    setShowPassword(false);
    saveImessageSettingsMutation.mutate(data);
  });

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied to clipboard",
      description: "Webhook URL has been copied to your clipboard.",
    });
  };

  // Regenerate webhook secret mutation
  const regenerateSecretMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) {
        throw new Error("No company selected");
      }
      const response = await fetch(`/api/imessage/settings/regenerate-webhook-secret?companyId=${selectedCompany.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to regenerate secret");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setNewWebhookSecret(data.webhookSecret);
      setShowRegenerateDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/settings", selectedCompany?.id] });
      toast({
        title: "Webhook secret regenerated",
        description: "Your new webhook secret has been generated. Please copy it now.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to regenerate secret",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopyWebhookSecret = () => {
    if (newWebhookSecret) {
      navigator.clipboard.writeText(newWebhookSecret);
      toast({
        title: "Copied to clipboard",
        description: "Webhook secret has been copied to your clipboard.",
      });
    }
  };

  const handleCloseRegenerateDialog = () => {
    setShowRegenerateDialog(false);
    // Clear the secret from memory when dialog closes
    setTimeout(() => setNewWebhookSecret(null), 300);
  };

  const handleConfigureImessage = (feature: Feature) => {
    if (isSuperadmin && feature.key === "imessage") {
      setImessageConfigOpen(true);
    }
  };

  const companies = data?.companies || [];
  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.domain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading companies..." />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Company List</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-companies"
                />
              </div>
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-company">
                <Plus className="h-4 w-4 mr-2" />
                New Company
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No companies found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={(e) => {
                      // Don't navigate if clicking on action buttons
                      if ((e.target as HTMLElement).closest('button')) return;
                      setLocation(`/companies/${company.id}`);
                    }}
                    data-testid={`company-item-${company.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white" data-testid={`text-company-name-${company.id}`}>
                            {company.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid={`text-company-slug-${company.id}`}>
                            {company.slug}
                          </p>
                        </div>
                        <div className="text-sm">
                          <p className="text-gray-600 dark:text-gray-300" data-testid={`text-company-email-${company.id}`}>
                            {company.email}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400" data-testid={`text-company-phone-${company.id}`}>
                            {company.phone ? formatForDisplay(company.phone) : '-'}
                          </p>
                        </div>
                        <div className="text-sm" data-testid={`text-company-address-${company.id}`}>
                          <p className="text-gray-600 dark:text-gray-300">{company.address}</p>
                          {company.addressLine2 && (
                            <p className="text-gray-500 dark:text-gray-400 text-xs">{company.addressLine2}</p>
                          )}
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            {[company.city, company.state, company.postalCode].filter(Boolean).join(', ')}
                          </p>
                        </div>
                        <div className="text-sm" data-testid={`text-company-created-${company.id}`}>
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                            <Calendar className="h-3 w-3" />
                            <span>Created</span>
                          </div>
                          <p className="text-gray-500 dark:text-gray-400">
                            {company.createdAt ? format(new Date(company.createdAt), 'MMM dd, yyyy') : '-'}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <Badge 
                            variant={company.isActive ? "default" : "destructive"}
                            className="text-xs"
                            data-testid={`badge-company-status-${company.id}`}
                          >
                            {company.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatusMutation.mutate(company.id)}
                        disabled={toggleStatusMutation.isPending}
                        data-testid={`button-toggle-status-${company.id}`}
                        title={company.isActive ? "Disable Company" : "Enable Company"}
                      >
                        <Power className={`h-4 w-4 ${company.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleManageFeatures(company)}
                        data-testid={`button-manage-features-${company.id}`}
                        title="Manage Features"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(company.id)}
                        data-testid={`button-delete-company-${company.id}`}
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
      <Dialog 
        open={createOpen} 
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setSlugManuallyEdited(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl" data-testid="dialog-create-company">
          <DialogHeader>
            <DialogTitle>New Company</DialogTitle>
            <DialogDescription>
              Create a new company. An admin user will be created and sent an activation email.
            </DialogDescription>
          </DialogHeader>
          {Object.keys(createForm.formState.errors).length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
              <p className="font-semibold mb-1">Please fix the following errors:</p>
              <ul className="list-disc list-inside space-y-1">
                {(() => {
                  const getErrorMessages = (errors: any, prefix = ''): string[] => {
                    const messages: string[] = [];
                    Object.entries(errors).forEach(([key, value]: [string, any]) => {
                      const fullKey = prefix ? `${prefix}.${key}` : key;
                      if (value?.message) {
                        messages.push(`${fullKey}: ${value.message}`);
                      } else if (typeof value === 'object' && value !== null) {
                        messages.push(...getErrorMessages(value, fullKey));
                      }
                    });
                    return messages;
                  };
                  
                  return getErrorMessages(createForm.formState.errors).map((message, index) => (
                    <li key={index}>{message}</li>
                  ));
                })()}
              </ul>
            </div>
          )}
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Company Information</h3>
                
                {/* Business Search Section */}
                <div className="col-span-2">
                  <BusinessAutocomplete
                    value={createForm.watch("company.name")}
                    onChange={(value) => {
                      createForm.setValue("company.name", value);
                      if (!slugManuallyEdited) {
                        const generatedSlug = generateSlug(value);
                        createForm.setValue("company.slug", generatedSlug);
                      }
                    }}
                    onBusinessSelect={(business) => {
                      // Populate all company fields with the selected business data
                      createForm.setValue("company.name", business.name);
                      createForm.setValue("company.phone", business.phone);
                      createForm.setValue("company.website", business.website || "");
                      createForm.setValue("company.address", business.address);
                      createForm.setValue("company.addressLine2", business.addressLine2 || "");
                      createForm.setValue("company.city", business.city);
                      createForm.setValue("company.state", business.state);
                      createForm.setValue("company.postalCode", business.postalCode);
                      createForm.setValue("company.country", business.country);
                      
                      // Auto-generate slug from business name
                      if (!slugManuallyEdited) {
                        const generatedSlug = generateSlug(business.name);
                        createForm.setValue("company.slug", generatedSlug);
                      }
                    }}
                    testId="input-business-search-dialog"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Can't find the business? Enter the details manually below.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="company.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Acme Inc." 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              // Auto-generate slug if not manually edited
                              if (!slugManuallyEdited) {
                                const generatedSlug = generateSlug(e.target.value);
                                createForm.setValue('company.slug', generatedSlug);
                              }
                            }}
                            data-testid="input-create-company-name" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="company.slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug (auto-generated, editable)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="acme-inc" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setSlugManuallyEdited(true);
                            }}
                            data-testid="input-create-company-slug" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="company.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(415) 555-2671" 
                            {...field}
                            onChange={(e) => {
                              const formatted = formatPhoneInput(e.target.value);
                              field.onChange(formatted);
                            }}
                            data-testid="input-create-company-phone" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="company.website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com" 
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-create-company-website" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="company.address"
                  render={({ field }) => (
                    <AddressAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      onAddressSelect={(address) => {
                        createForm.setValue("company.address", address.street);
                        createForm.setValue("company.city", address.city);
                        createForm.setValue("company.state", address.state);
                        createForm.setValue("company.postalCode", address.postalCode);
                        createForm.setValue("company.country", address.country);
                      }}
                      label="Street Address"
                      placeholder="Start typing an address..."
                      testId="input-create-company-address"
                      error={createForm.formState.errors.company?.address?.message}
                    />
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="company.addressLine2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suite, Apartment, Unit (optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Suite 100" 
                          {...field} 
                          value={field.value ?? ""} 
                          data-testid="input-create-company-address2" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="company.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Miami" {...field} value={field.value ?? ""} data-testid="input-create-company-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="company.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="FL" {...field} value={field.value ?? ""} data-testid="input-create-company-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="company.postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="33185" {...field} value={field.value ?? ""} data-testid="input-create-company-postal" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="company.country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="United States" {...field} value={field.value ?? ""} data-testid="input-create-company-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Admin User</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="admin.firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-create-admin-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="admin.lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} data-testid="input-create-admin-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="admin.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Email (required for OTP)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@acme.com" {...field} data-testid="input-create-admin-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="admin.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Phone (required for OTP)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(415) 555-2671" 
                            {...field} 
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const formatted = formatPhoneInput(e.target.value);
                              field.onChange(formatted);
                            }}
                            data-testid="input-create-admin-phone" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending} 
                  data-testid="button-submit-create-company"
                >
                  {createMutation.isPending ? "Creating..." : "Create Company & Admin"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Features Dialog */}
      <Dialog open={featuresOpen} onOpenChange={setFeaturesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-manage-features">
          <DialogHeader>
            <DialogTitle>Manage Features - {selectedCompany?.name}</DialogTitle>
            <DialogDescription>
              Select which features this company should have access to
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[60vh] px-1">
            {isLoadingCompanyFeatures ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 p-4 border rounded-lg">
                    <div className="w-4 h-4 bg-muted rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allFeatures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No features available. Create features first to assign them to companies.
              </div>
            ) : (
              <div className="space-y-2">
                {allFeatures.map((feature) => {
                  const isAssigned = companyFeatureIds.has(feature.id);
                  const isActive = feature.isActive;
                  
                  return (
                    <div
                      key={feature.id}
                      className={`flex items-start gap-3 p-4 border rounded-lg hover-elevate ${
                        !isActive ? 'opacity-50' : ''
                      }`}
                      data-testid={`feature-item-${feature.id}`}
                    >
                      <Checkbox
                        checked={isAssigned}
                        disabled={!isActive || addFeatureMutation.isPending || removeFeatureMutation.isPending}
                        onCheckedChange={() => handleToggleFeature(feature.id)}
                        data-testid={`checkbox-feature-${feature.id}`}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-medium" data-testid={`text-feature-name-${feature.id}`}>
                            {feature.name}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            {feature.category}
                          </Badge>
                          {!isActive && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                          {isSuperadmin && feature.key === "imessage" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-auto"
                              onClick={() => handleConfigureImessage(feature)}
                              data-testid="button-configure-imessage"
                              title="Configure iMessage"
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-feature-desc-${feature.id}`}>
                          {feature.description || 'No description'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Key: <span className="font-mono">{feature.key}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFeaturesOpen(false);
                setSelectedCompany(null);
              }}
              data-testid="button-close-features"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* iMessage Configuration Dialog */}
      <Dialog open={imessageConfigOpen} onOpenChange={setImessageConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="dialog-configure-imessage">
          <DialogHeader>
            <DialogTitle>Configure iMessage</DialogTitle>
            <DialogDescription>
              Configure BlueBubbles server connection and webhook settings for iMessage integration
            </DialogDescription>
          </DialogHeader>

          {loadingImessageSettings ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner data-testid="loading-imessage-settings" />
            </div>
          ) : (
            <Form {...imessageForm}>
              <form onSubmit={handleSaveImessageSettings} className="space-y-4 overflow-y-auto max-h-[60vh] px-1">
                {/* BlueBubbles Server Configuration */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">BlueBubbles Server</h3>
                  
                  <FormField
                    control={imessageForm.control}
                    name="serverUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Server URL</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://your-server.ngrok.io"
                            data-testid="input-imessage-server-url"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={imessageForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Server Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter server password"
                              className="pr-10"
                              data-testid="input-imessage-password"
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                              onClick={() => setShowPassword(!showPassword)}
                              data-testid="button-toggle-imessage-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={imessageForm.control}
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable iMessage Integration</FormLabel>
                          <CardDescription>
                            Allow iMessage messaging through BlueBubbles server
                          </CardDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-enable-imessage"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Webhook Configuration */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold">Webhook Configuration</h3>
                  
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhookUrl}
                        readOnly
                        className="flex-1 font-mono text-sm"
                        data-testid="input-imessage-webhook-url"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleCopyWebhookUrl}
                        data-testid="button-copy-imessage-webhook"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure this URL in your BlueBubbles server webhook settings
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook Secret Status</Label>
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      {currentImessageSettings.hasWebhookSecret ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-500" />
                          <span className="text-sm text-green-600 dark:text-green-500 font-medium">
                            Webhook secret configured
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                          <span className="text-sm text-amber-600 dark:text-amber-500 font-medium">
                            No webhook secret configured
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => regenerateSecretMutation.mutate()}
                      disabled={regenerateSecretMutation.isPending}
                      className="w-full"
                      data-testid="button-regenerate-imessage-webhook-secret"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {regenerateSecretMutation.isPending ? "Regenerating..." : "Regenerate Webhook Secret"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Regenerating will invalidate the previous secret
                    </p>
                  </div>
                </div>
              </form>
            </Form>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImessageConfigOpen(false)}
              data-testid="button-cancel-imessage-config"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveImessageSettings}
              disabled={saveImessageSettingsMutation.isPending}
              data-testid="button-save-imessage-settings"
            >
              {saveImessageSettingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Secret Dialog - ONE TIME SHOW */}
      <Dialog open={showRegenerateDialog} onOpenChange={handleCloseRegenerateDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-webhook-secret">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
              Webhook Secret Generated
            </DialogTitle>
            <DialogDescription>
              Copy this secret now and configure it in your BlueBubbles server. This secret will not be shown again for security reasons.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Warning Alert */}
            <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-semibold">Important: Previous secret invalidated</p>
                  <p className="mt-1">Update your BlueBubbles server configuration immediately.</p>
                </div>
              </div>
            </div>

            {/* Secret Display */}
            <div className="space-y-2">
              <Label>Your New Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  value={newWebhookSecret || ""}
                  readOnly
                  className="flex-1 font-mono text-sm"
                  data-testid="input-new-imessage-webhook-secret"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyWebhookSecret}
                  data-testid="button-copy-imessage-webhook-secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label>Configuration Instructions</Label>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Copy the webhook secret above</li>
                <li>Open your BlueBubbles server settings</li>
                <li>Navigate to the webhook configuration section</li>
                <li>Paste this secret in the webhook secret field</li>
                <li>Save your BlueBubbles server configuration</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleCloseRegenerateDialog}
              data-testid="button-close-imessage-regenerate-dialog"
            >
              I've Copied the Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCompanyId} onOpenChange={(open) => !open && setDeleteCompanyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone. 
              All users, subscriptions, and data associated with this company will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
