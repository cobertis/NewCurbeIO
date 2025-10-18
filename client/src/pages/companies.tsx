import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Trash2, Search, Package, Power } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCompanyWithAdminSchema, type Company, type Feature } from "@shared/schema";
import { useState, useRef } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneInput, formatPhoneDisplay } from "@/lib/phone-formatter";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { BusinessAutocomplete } from "@/components/business-autocomplete";

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
  const { toast } = useToast();

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
    enabled: featuresOpen && !!selectedCompany?.id,
  });

  const addFeatureMutation = useMutation({
    mutationFn: async ({ companyId, featureId }: { companyId: string; featureId: string }) => {
      const response = await fetch(`/api/companies/${companyId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ featureId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add feature");
      }
      return response.json();
    },
    onSuccess: () => {
      if (selectedCompany) {
        queryClient.invalidateQueries({ queryKey: ["/api/companies", selectedCompany.id, "features"] });
      }
      toast({
        title: "Feature Added",
        description: "The feature has been added to the company",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add feature",
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
    onSuccess: () => {
      if (selectedCompany) {
        queryClient.invalidateQueries({ queryKey: ["/api/companies", selectedCompany.id, "features"] });
      }
      toast({
        title: "Feature Removed",
        description: "The feature has been removed from the company",
      });
    },
    onError: () => {
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
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
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
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            {company.phone ? formatPhoneDisplay(company.phone) : '-'}
                          </p>
                        </div>
                        <div className="text-sm" data-testid={`text-company-address-${company.id}`}>
                          <p className="text-gray-600 dark:text-gray-300">{company.address}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            {[company.city, company.state, company.postalCode].filter(Boolean).join(', ')}
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
                            placeholder="+1 (415) 555-2671" 
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
                            placeholder="+1 (415) 555-2671" 
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
