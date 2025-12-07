import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Key, Eye, EyeOff, Plus, Pencil, Trash2, Shield, Clock, User as UserIcon, Activity, ExternalLink, HelpCircle } from "lucide-react";
import type { 
  SystemApiCredential, 
  SystemApiCredentialsAudit, 
  ApiProvider, 
  CredentialAuditAction,
  User 
} from "@shared/schema";
import { apiProviders } from "@shared/schema";

interface ProviderKeyConfig {
  keyName: string;
  label: string;
  required: boolean;
  hint?: string;
}

interface ProviderConfig {
  provider: string;
  label: string;
  helpText?: string;
  helpUrl?: string | null;
  keys: ProviderKeyConfig[];
}

interface ProvidersResponse {
  providers: ProviderConfig[];
  apiProviders: string[];
}

interface CredentialsResponse {
  credentials: SystemApiCredential[];
}

interface AuditResponse {
  logs: (SystemApiCredentialsAudit & { actor?: { firstName: string | null; lastName: string | null; email: string } })[];
}

interface RevealResponse {
  value: string;
}

const credentialFormSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  keyName: z.string().min(1, "Key name is required"),
  value: z.string().min(1, "Value is required"),
  description: z.string().optional(),
  environment: z.enum(["production", "development", "staging"]),
  isActive: z.boolean().default(true),
});

type CredentialFormData = z.infer<typeof credentialFormSchema>;

const bulkCredentialFormSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  environment: z.enum(["production", "development", "staging"]),
  credentials: z.record(z.string()),
});

type BulkCredentialFormData = z.infer<typeof bulkCredentialFormSchema>;

const revealPasswordSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

type RevealPasswordData = z.infer<typeof revealPasswordSchema>;

export default function SystemSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("credentials");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [revealDialogOpen, setRevealDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<SystemApiCredential | null>(null);
  const [revealedValues, setRevealedValues] = useState<Record<string, { value: string; expiresAt: number }>>({});
  const [showValue, setShowValue] = useState(false);
  const [showFieldValues, setShowFieldValues] = useState<Record<string, boolean>>({});
  const [bulkFormProvider, setBulkFormProvider] = useState<string>("");
  const [bulkFormEnvironment, setBulkFormEnvironment] = useState<"production" | "development" | "staging">("production");
  const [bulkFormValues, setBulkFormValues] = useState<Record<string, string>>({});
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: providersData, isLoading: isLoadingProviders } = useQuery<ProvidersResponse>({
    queryKey: ["/api/system/credentials/providers"],
    enabled: sessionData?.user?.role === "superadmin",
  });

  const { data: credentialsData, isLoading: isLoadingCredentials } = useQuery<CredentialsResponse>({
    queryKey: ["/api/system/credentials"],
    enabled: sessionData?.user?.role === "superadmin",
  });

  const { data: auditData, isLoading: isLoadingAudit } = useQuery<AuditResponse>({
    queryKey: ["/api/system/credentials/audit"],
    enabled: sessionData?.user?.role === "superadmin" && activeTab === "audit",
  });

  const addForm = useForm<CredentialFormData>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      provider: "",
      keyName: "",
      value: "",
      description: "",
      environment: "production",
      isActive: true,
    },
  });

  const editForm = useForm<CredentialFormData>({
    resolver: zodResolver(credentialFormSchema),
    defaultValues: {
      provider: "",
      keyName: "",
      value: "",
      description: "",
      environment: "production",
      isActive: true,
    },
  });

  const revealForm = useForm<RevealPasswordData>({
    resolver: zodResolver(revealPasswordSchema),
    defaultValues: {
      password: "",
    },
  });

  const selectedProvider = addForm.watch("provider") as ApiProvider;
  const editSelectedProvider = editForm.watch("provider") as ApiProvider;

  const createMutation = useMutation({
    mutationFn: async (data: CredentialFormData) => {
      return apiRequest("POST", "/api/system/credentials", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
      setAddDialogOpen(false);
      addForm.reset();
      toast({
        title: "Credential Created",
        description: "The API credential has been created successfully.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to create credential.";
      try {
        if (error?.message) {
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error?.message || "Failed to create credential.";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CredentialFormData> }) => {
      return apiRequest("PATCH", `/api/system/credentials/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
      setEditDialogOpen(false);
      setSelectedCredential(null);
      editForm.reset();
      toast({
        title: "Credential Updated",
        description: "The API credential has been updated successfully.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to update credential.";
      try {
        if (error?.message) {
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error?.message || "Failed to update credential.";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/system/credentials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
      setDeleteDialogOpen(false);
      setSelectedCredential(null);
      toast({
        title: "Credential Deleted",
        description: "The API credential has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to delete credential.";
      try {
        if (error?.message) {
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error?.message || "Failed to delete credential.";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const revealMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      return apiRequest("POST", `/api/system/credentials/${id}/reveal`, { password });
    },
    onSuccess: (data: RevealResponse, variables) => {
      const expiresAt = Date.now() + 30000;
      setRevealedValues(prev => ({
        ...prev,
        [variables.id]: { value: data.value, expiresAt },
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
      setRevealDialogOpen(false);
      setSelectedCredential(null);
      revealForm.reset();
      toast({
        title: "Credential Revealed",
        description: "The value will be hidden after 30 seconds.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to reveal credential.";
      try {
        if (error?.message) {
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error?.message || "Failed to reveal credential.";
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRevealedValues(prev => {
        const newValues: Record<string, { value: string; expiresAt: number }> = {};
        let hasChanges = false;
        for (const [id, data] of Object.entries(prev)) {
          if (data.expiresAt > now) {
            newValues[id] = data;
          } else {
            hasChanges = true;
          }
        }
        return hasChanges ? newValues : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAddSubmit = (data: CredentialFormData) => {
    createMutation.mutate(data);
  };

  const handleBulkSubmit = async () => {
    if (!bulkFormProvider) {
      toast({
        title: "Error",
        description: "Please select a provider",
        variant: "destructive",
      });
      return;
    }

    const providerConfig = getProviderConfig(bulkFormProvider);
    if (!providerConfig) return;

    const requiredKeys = providerConfig.keys.filter(k => k.required);
    const missingRequired = requiredKeys.filter(k => !bulkFormValues[k.keyName]?.trim());
    
    if (missingRequired.length > 0) {
      toast({
        title: "Error",
        description: `Missing required fields: ${missingRequired.map(k => k.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const credentialsToCreate = Object.entries(bulkFormValues)
      .filter(([_, value]) => value?.trim())
      .map(([keyName, value]) => ({
        provider: bulkFormProvider,
        keyName,
        value: value.trim(),
        environment: bulkFormEnvironment,
      }));

    if (credentialsToCreate.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one credential value",
        variant: "destructive",
      });
      return;
    }

    setIsBulkSubmitting(true);
    try {
      const results = await Promise.allSettled(
        credentialsToCreate.map(cred => 
          apiRequest("POST", "/api/system/credentials", cred)
        )
      );
      
      const succeeded = results.filter(r => r.status === "fulfilled");
      const failed = results.filter(r => r.status === "rejected");
      
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
      
      if (failed.length === 0) {
        setAddDialogOpen(false);
        setBulkFormProvider("");
        setBulkFormValues({});
        setShowFieldValues({});
        
        toast({
          title: "Credentials Created",
          description: `Successfully created ${succeeded.length} credential(s) for ${getProviderDisplayName(bulkFormProvider)}.`,
        });
      } else if (succeeded.length > 0) {
        const failedKeys = credentialsToCreate
          .filter((_, idx) => results[idx].status === "rejected")
          .map(c => getKeyLabel(c.provider, c.keyName));
        
        const newValues = { ...bulkFormValues };
        credentialsToCreate.forEach((cred, idx) => {
          if (results[idx].status === "fulfilled") {
            delete newValues[cred.keyName];
          }
        });
        setBulkFormValues(newValues);
        
        toast({
          title: "Partial Success",
          description: `Created ${succeeded.length} credential(s). Failed: ${failedKeys.join(", ")}. Please retry the failed ones.`,
          variant: "destructive",
        });
      } else {
        let errorMessage = "Failed to create credentials.";
        const firstRejection = failed[0] as PromiseRejectedResult;
        if (firstRejection?.reason?.message) {
          try {
            const colonIndex = firstRejection.reason.message.indexOf(': ');
            if (colonIndex !== -1) {
              const jsonPart = firstRejection.reason.message.substring(colonIndex + 2);
              const errorData = JSON.parse(jsonPart);
              errorMessage = errorData.message || firstRejection.reason.message;
            } else {
              errorMessage = firstRejection.reason.message;
            }
          } catch {
            errorMessage = firstRejection.reason.message || "Failed to create credentials.";
          }
        }
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleEditSubmit = (data: CredentialFormData) => {
    if (selectedCredential) {
      updateMutation.mutate({ id: selectedCredential.id, data });
    }
  };

  const handleRevealSubmit = (data: RevealPasswordData) => {
    if (selectedCredential) {
      revealMutation.mutate({ id: selectedCredential.id, password: data.password });
    }
  };

  const handleEditClick = (credential: SystemApiCredential) => {
    setSelectedCredential(credential);
    editForm.reset({
      provider: credential.provider,
      keyName: credential.keyName,
      value: "",
      description: credential.description || "",
      environment: credential.environment as "production" | "development" | "staging",
      isActive: credential.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleRevealClick = (credential: SystemApiCredential) => {
    setSelectedCredential(credential);
    revealForm.reset();
    setRevealDialogOpen(true);
  };

  const handleDeleteClick = (credential: SystemApiCredential) => {
    setSelectedCredential(credential);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedCredential) {
      deleteMutation.mutate(selectedCredential.id);
    }
  };

  const getProviderConfig = (provider: string): ProviderConfig | undefined => {
    return providersData?.providers?.find(p => p.provider === provider);
  };

  const getProviderDisplayName = (provider: string): string => {
    const config = getProviderConfig(provider);
    if (config) {
      return config.label;
    }
    return provider.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const getKeyOptions = (provider: string): string[] => {
    const config = getProviderConfig(provider);
    if (config) {
      return config.keys.map(k => k.keyName);
    }
    return [];
  };

  const getKeyLabel = (provider: string, keyName: string): string => {
    const config = getProviderConfig(provider);
    if (config) {
      const key = config.keys.find(k => k.keyName === keyName);
      return key?.label || keyName;
    }
    return keyName;
  };

  const getActionBadgeVariant = (action: CredentialAuditAction): "default" | "secondary" | "destructive" | "outline" => {
    switch (action) {
      case "created":
        return "default";
      case "viewed":
        return "secondary";
      case "deleted":
        return "destructive";
      case "updated":
      case "rotated":
        return "outline";
      default:
        return "outline";
    }
  };

  const getActionBadgeColor = (action: CredentialAuditAction): string => {
    switch (action) {
      case "created":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "viewed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "deleted":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "updated":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "rotated":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "";
    }
  };

  const groupCredentialsByProvider = (credentials: SystemApiCredential[]) => {
    const grouped: Record<string, SystemApiCredential[]> = {};
    for (const credential of credentials) {
      if (!grouped[credential.provider]) {
        grouped[credential.provider] = [];
      }
      grouped[credential.provider].push(credential);
    }
    return grouped;
  };

  if (sessionData?.user?.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You do not have permission to access this page. Only superadmins can manage system API credentials.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingProviders || isLoadingCredentials) {
    return <LoadingSpinner fullScreen={true} message="Loading system settings..." />;
  }

  const credentials = credentialsData?.credentials || [];
  const groupedCredentials = groupCredentialsByProvider(credentials);
  const auditLogs = auditData?.logs || [];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1" data-testid="page-title">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage system-wide API credentials and view audit logs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md" data-testid="settings-tabs">
          <TabsTrigger value="credentials" data-testid="tab-credentials">
            <Key className="h-4 w-4 mr-2" />
            API Credentials
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <Activity className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">API Credentials</CardTitle>
                <CardDescription>
                  Securely manage API keys for integrated services
                </CardDescription>
              </div>
              <Button 
                onClick={() => {
                  addForm.reset();
                  setShowValue(false);
                  setAddDialogOpen(true);
                }}
                data-testid="button-add-credential"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Credential
              </Button>
            </CardHeader>
            <CardContent>
              {credentials.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No API credentials configured</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      addForm.reset();
                      setShowValue(false);
                      setAddDialogOpen(true);
                    }}
                    data-testid="button-add-credential-empty"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Credential
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedCredentials).map(([provider, providerCredentials]) => (
                    <div key={provider} className="space-y-3">
                      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                        {getProviderDisplayName(provider)}
                      </h3>
                      <div className="space-y-2">
                        {providerCredentials.map((credential) => {
                          const revealed = revealedValues[credential.id];
                          const timeRemaining = revealed ? Math.ceil((revealed.expiresAt - Date.now()) / 1000) : 0;
                          
                          return (
                            <div 
                              key={credential.id} 
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                              data-testid={`credential-${credential.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium" data-testid={`credential-keyname-${credential.id}`}>
                                    {credential.keyName}
                                  </span>
                                  <Badge 
                                    variant={credential.isActive ? "default" : "secondary"}
                                    data-testid={`credential-status-${credential.id}`}
                                  >
                                    {credential.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {credential.environment}
                                  </Badge>
                                </div>
                                {credential.description && (
                                  <p className="text-sm text-muted-foreground mb-2" data-testid={`credential-description-${credential.id}`}>
                                    {credential.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="font-mono" data-testid={`credential-value-${credential.id}`}>
                                    {revealed ? revealed.value : "••••••••••••••••"}
                                  </span>
                                  {revealed && (
                                    <span className="text-yellow-600 dark:text-yellow-400">
                                      Hiding in {timeRemaining}s
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span data-testid={`credential-updated-${credential.id}`}>
                                    Updated {format(new Date(credential.updatedAt), "PPp")}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRevealClick(credential)}
                                  disabled={!!revealed}
                                  data-testid={`button-reveal-${credential.id}`}
                                >
                                  {revealed ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditClick(credential)}
                                  data-testid={`button-edit-${credential.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(credential)}
                                  data-testid={`button-delete-${credential.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Log</CardTitle>
              <CardDescription>
                Track all changes and access to API credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAudit ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner fullScreen={false} className="h-8 w-8" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No audit logs yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Key Name</TableHead>
                        <TableHead>Actor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                          <TableCell className="whitespace-nowrap" data-testid={`audit-date-${log.id}`}>
                            {format(new Date(log.createdAt), "PPp")}
                          </TableCell>
                          <TableCell data-testid={`audit-action-${log.id}`}>
                            <Badge className={getActionBadgeColor(log.action as CredentialAuditAction)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`audit-provider-${log.id}`}>
                            {getProviderDisplayName(log.provider)}
                          </TableCell>
                          <TableCell className="font-mono text-sm" data-testid={`audit-keyname-${log.id}`}>
                            {log.keyName}
                          </TableCell>
                          <TableCell data-testid={`audit-actor-${log.id}`}>
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {log.actor 
                                  ? `${log.actor.firstName || ""} ${log.actor.lastName || ""}`.trim() || log.actor.email
                                  : "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) {
          setBulkFormProvider("");
          setBulkFormValues({});
          setShowFieldValues({});
        }
      }}>
        <DialogContent className="sm:max-w-[550px]" data-testid="dialog-add-credential">
          <DialogHeader>
            <DialogTitle>Add API Credentials</DialogTitle>
            <DialogDescription>
              Configure credentials for an integrated service. Required fields are marked with *.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select 
                onValueChange={(value) => {
                  setBulkFormProvider(value);
                  setBulkFormValues({});
                  setShowFieldValues({});
                }} 
                value={bulkFormProvider}
              >
                <SelectTrigger data-testid="select-provider">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providersData?.providers?.map((provider) => (
                    <SelectItem key={provider.provider} value={provider.provider} data-testid={`option-provider-${provider.provider}`}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkFormProvider && (
              <>
                {getProviderConfig(bulkFormProvider)?.helpText && (
                  <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                    <HelpCircle className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-muted-foreground">{getProviderConfig(bulkFormProvider)?.helpText}</p>
                      {getProviderConfig(bulkFormProvider)?.helpUrl && (
                        <a 
                          href={getProviderConfig(bulkFormProvider)?.helpUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                          data-testid="link-help-url"
                        >
                          Open {getProviderConfig(bulkFormProvider)?.label} Dashboard
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Environment</label>
                  <Select 
                    onValueChange={(value) => setBulkFormEnvironment(value as "production" | "development" | "staging")} 
                    value={bulkFormEnvironment}
                  >
                    <SelectTrigger data-testid="select-environment">
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production" data-testid="option-env-production">Production</SelectItem>
                      <SelectItem value="development" data-testid="option-env-development">Development</SelectItem>
                      <SelectItem value="staging" data-testid="option-env-staging">Staging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">Credentials</h4>
                  <div className="space-y-4">
                    {getProviderConfig(bulkFormProvider)?.keys.map((key) => (
                      <div key={key.keyName} className="space-y-1.5">
                        <label className="text-sm font-medium flex items-center gap-1">
                          {key.label}
                          {key.required && <span className="text-red-500">*</span>}
                          {!key.required && <span className="text-xs text-muted-foreground">(Optional)</span>}
                        </label>
                        <div className="relative">
                          <Input
                            type={showFieldValues[key.keyName] ? "text" : "password"}
                            placeholder={key.hint || `Enter ${key.label.toLowerCase()}`}
                            value={bulkFormValues[key.keyName] || ""}
                            onChange={(e) => setBulkFormValues(prev => ({
                              ...prev,
                              [key.keyName]: e.target.value
                            }))}
                            className="pr-10"
                            data-testid={`input-${key.keyName}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setShowFieldValues(prev => ({
                              ...prev,
                              [key.keyName]: !prev[key.keyName]
                            }))}
                            data-testid={`button-toggle-${key.keyName}`}
                          >
                            {showFieldValues[key.keyName] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {key.hint && (
                          <p className="text-xs text-muted-foreground">{key.hint}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                data-testid="button-cancel-add"
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleBulkSubmit}
                disabled={isBulkSubmitting || !bulkFormProvider}
                data-testid="button-submit-add"
              >
                {isBulkSubmitting && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
                Save Credentials
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-edit-credential">
          <DialogHeader>
            <DialogTitle>Edit API Credential</DialogTitle>
            <DialogDescription>
              Update the API credential. Leave value empty to keep existing.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled>
                      <FormControl>
                        <SelectTrigger data-testid="edit-select-provider">
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {apiProviders.map((provider) => (
                          <SelectItem key={provider} value={provider}>
                            {getProviderDisplayName(provider)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="keyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Name</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled>
                      <FormControl>
                        <SelectTrigger data-testid="edit-select-keyname">
                          <SelectValue placeholder="Select a key" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getKeyOptions(editSelectedProvider).map((key) => (
                          <SelectItem key={key} value={key}>
                            {key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Value (leave empty to keep existing)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showValue ? "text" : "password"}
                          placeholder="Enter new value or leave empty"
                          className="pr-10"
                          data-testid="edit-input-value"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setShowValue(!showValue)}
                          data-testid="edit-button-toggle-value"
                        >
                          {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Environment</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="edit-select-environment">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add a description for this credential"
                        rows={3}
                        data-testid="edit-input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateMutation.isPending && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
                  Update Credential
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={revealDialogOpen} onOpenChange={setRevealDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="dialog-reveal-credential">
          <DialogHeader>
            <DialogTitle>Confirm Password</DialogTitle>
            <DialogDescription>
              Enter your password to reveal the credential value. The value will be visible for 30 seconds.
            </DialogDescription>
          </DialogHeader>
          <Form {...revealForm}>
            <form onSubmit={revealForm.handleSubmit(handleRevealSubmit)} className="space-y-4">
              <FormField
                control={revealForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your password"
                        data-testid="input-reveal-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevealDialogOpen(false)}
                  data-testid="button-cancel-reveal"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={revealMutation.isPending}
                  data-testid="button-submit-reveal"
                >
                  {revealMutation.isPending && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
                  Reveal Value
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-credential">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the credential "{selectedCredential?.keyName}" for {selectedCredential && getProviderDisplayName(selectedCredential.provider)}? 
              This action cannot be undone and may affect services that depend on this credential.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
              Delete Credential
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
