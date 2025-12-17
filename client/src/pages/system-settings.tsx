import { useState, useEffect, useCallback } from "react";
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
import { Key, Eye, EyeOff, Plus, Pencil, Trash2, Shield, Clock, User as UserIcon, Activity, ExternalLink, HelpCircle, Settings2, Check, Save, Globe, Lock, Unlock, DollarSign, Phone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { 
  SystemApiCredential, 
  SystemApiCredentialsAudit, 
  ApiProvider, 
  CredentialAuditAction,
  User,
  SystemConfig,
  TelnyxGlobalPricing
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

interface SystemConfigResponse {
  configs: SystemConfig[];
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


// Telnyx Global Pricing Section Component
function TelnyxPricingSection() {
  const { toast } = useToast();
  const [formValues, setFormValues] = useState<Partial<TelnyxGlobalPricing>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: pricingData, isLoading } = useQuery<{ pricing: TelnyxGlobalPricing }>({
    queryKey: ["/api/telnyx/global-pricing"],
  });

  useEffect(() => {
    if (pricingData?.pricing) {
      setFormValues(pricingData.pricing);
      setHasChanges(false);
    }
  }, [pricingData]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<TelnyxGlobalPricing>) => {
      return apiRequest("PUT", "/api/telnyx/global-pricing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/global-pricing"] });
      setHasChanges(false);
      toast({
        title: "Pricing Updated",
        description: "Telnyx global pricing has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update pricing.",
        variant: "destructive",
      });
    },
  });

  const handleValueChange = useCallback((field: keyof TelnyxGlobalPricing, value: string | number) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    updateMutation.mutate(formValues);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner fullScreen={false} />
      </div>
    );
  }

  const renderPricingRow = (
    label: string, 
    costField: keyof TelnyxGlobalPricing, 
    priceField: keyof TelnyxGlobalPricing,
    step = "0.0001"
  ) => {
    const costValue = formValues[costField];
    const priceValue = formValues[priceField];
    const costDisplay = costValue !== undefined && costValue !== null ? String(costValue) : "";
    const priceDisplay = priceValue !== undefined && priceValue !== null ? String(priceValue) : "";
    
    const cost = parseFloat(costDisplay) || 0;
    const price = parseFloat(priceDisplay) || 0;
    const margin = price > 0 && cost > 0 ? ((price - cost) / cost * 100).toFixed(0) : "--";
    
    return (
      <div key={costField} className="grid grid-cols-4 gap-2 items-center py-1.5 border-b border-border/50 last:border-0">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            step={step}
            min="0"
            value={costDisplay}
            onChange={(e) => handleValueChange(costField, e.target.value)}
            className="w-24 text-right text-sm h-8"
            data-testid={`input-pricing-${costField}`}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            step={step}
            min="0"
            value={priceDisplay}
            onChange={(e) => handleValueChange(priceField, e.target.value)}
            className="w-24 text-right text-sm h-8"
            data-testid={`input-pricing-${priceField}`}
          />
        </div>
        <span className={`text-sm font-medium text-right ${margin !== "--" && Number(margin) > 0 ? "text-green-600" : "text-muted-foreground"}`}>
          {margin !== "--" ? `+${margin}%` : margin}
        </span>
      </div>
    );
  };

  const renderIntegerInput = (field: keyof TelnyxGlobalPricing, label: string, suffix = "") => {
    const value = formValues[field];
    const displayValue = value !== undefined && value !== null ? String(value) : "";
    return (
      <div key={field} className="flex items-center justify-between py-2">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="1"
            min="0"
            value={displayValue}
            onChange={(e) => handleValueChange(field, e.target.value)}
            className="w-28 text-right"
            data-testid={`input-pricing-${field}`}
          />
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      </div>
    );
  };

  const TableHeader = () => (
    <div className="grid grid-cols-4 gap-2 pb-2 border-b border-border mb-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase">Service</span>
      <span className="text-xs font-semibold text-muted-foreground uppercase">Telnyx Cost</span>
      <span className="text-xs font-semibold text-muted-foreground uppercase">Client Price</span>
      <span className="text-xs font-semibold text-muted-foreground uppercase text-right">Margin</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure base rates for Telnyx telephony services. These rates apply globally across all organizations.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          data-testid="button-save-pricing"
        >
          {updateMutation.isPending ? (
            <>
              <LoadingSpinner fullScreen={false} />
              <span className="ml-2">Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-voice-rates">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Voice Rates (per minute)
            </CardTitle>
            <CardDescription className="text-xs">
              60/60 billing increment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TableHeader />
            {renderPricingRow("Local Outbound", "voiceLocalOutboundCost", "voiceLocalOutbound")}
            {renderPricingRow("Local Inbound", "voiceLocalInboundCost", "voiceLocalInbound")}
            {renderPricingRow("Toll-Free Out", "voiceTollfreeOutboundCost", "voiceTollfreeOutbound")}
            {renderPricingRow("Toll-Free In", "voiceTollfreeInboundCost", "voiceTollfreeInbound")}
          </CardContent>
        </Card>

        <Card data-testid="card-sms-rates">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              SMS Rates (per message)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TableHeader />
            {renderPricingRow("Longcode Out", "smsLongcodeOutboundCost", "smsLongcodeOutbound")}
            {renderPricingRow("Longcode In", "smsLongcodeInboundCost", "smsLongcodeInbound")}
            {renderPricingRow("Toll-Free Out", "smsTollfreeOutboundCost", "smsTollfreeOutbound")}
            {renderPricingRow("Toll-Free In", "smsTollfreeInboundCost", "smsTollfreeInbound")}
          </CardContent>
        </Card>

        <Card data-testid="card-addons">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TableHeader />
            {renderPricingRow("Call Ctrl In", "callControlInboundCost", "callControlInbound")}
            {renderPricingRow("Call Ctrl Out", "callControlOutboundCost", "callControlOutbound")}
            {renderPricingRow("Recording/min", "recordingPerMinuteCost", "recordingPerMinute")}
            {renderPricingRow("CNAM /num/mo", "cnamLookupCost", "cnamLookup")}
            {renderPricingRow("E911 /num/mo", "e911AddressCost", "e911Address", "0.01")}
            {renderPricingRow("Port Out Fee", "portOutFeeCost", "portOutFee", "0.01")}
            {renderPricingRow("Unreg E911 Call", "unregisteredE911Cost", "unregisteredE911", "1.00")}
          </CardContent>
        </Card>

        <Card data-testid="card-dids">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              DIDs (monthly)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TableHeader />
            {renderPricingRow("Local DID", "didLocalCost", "didLocal", "0.01")}
            {renderPricingRow("Toll-Free DID", "didTollfreeCost", "didTollfree", "0.01")}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" data-testid="card-billing-config">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Billing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderIntegerInput("billingIncrement", "Billing Increment", "seconds")}
              {renderIntegerInput("minBillableSeconds", "Min Billable Seconds", "seconds")}
            </div>
          </CardContent>
        </Card>
      </div>

      {pricingData?.pricing?.updatedAt && (
        <p className="text-xs text-muted-foreground text-right" data-testid="text-last-updated">
          Last updated: {format(new Date(pricingData.pricing.updatedAt), "PPpp")}
        </p>
      )}
    </div>
  );
}

// Deployment Section Component
function DeploymentSection() {
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  
  const { data: deployStatus, refetch: refetchStatus } = useQuery<{ jobs?: any[]; currentStatus?: string; lastDeployment?: any }>({
    queryKey: ["/api/admin/deploy/status"],
    refetchInterval: isDeploying ? 3000 : false,
  });
  
  
  // Clear isDeploying when job completes
  if (isDeploying && deployStatus?.currentStatus && deployStatus.currentStatus !== "in_progress" && deployStatus.currentStatus !== "pending") {
    setIsDeploying(false);
  }
  const deployMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/deploy");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Deployment Started",
        description: "Production deployment has been triggered. Check status below.",
      });
      setIsDeploying(true);
      refetchStatus();
    },
    onError: (error: Error) => {
      toast({
        title: "Deployment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleDeploy = () => {
    deployMutation.mutate();
  };
  
  const lastDeployment = deployStatus?.lastDeployment;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div>
          <h4 className="font-medium">Sync Production Server</h4>
          <p className="text-sm text-muted-foreground">
            Pull latest changes from GitHub and restart the production server
          </p>
        </div>
        <Button
          onClick={handleDeploy}
          disabled={deployMutation.isPending || deployStatus?.currentStatus === "in_progress"}
          data-testid="btn-deploy"
        >
          {deployMutation.isPending ? (
            <>
              <LoadingSpinner fullScreen={false} />
              <span className="ml-2">Deploying...</span>
            </>
          ) : (
            <>
              <Globe className="h-4 w-4 mr-2" />
              Deploy Now
            </>
          )}
        </Button>
      </div>
      
      {lastDeployment && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Last Deployment</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <Badge 
                variant={
                  lastDeployment.status === "completed" ? "default" :
                  lastDeployment.status === "failed" ? "destructive" :
                  lastDeployment.status === "in_progress" ? "secondary" : "outline"
                }
                className="ml-2"
              >
                {lastDeployment.status}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Triggered by:</span>
              <span className="ml-2">{lastDeployment.triggeredBy}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Started:</span>
              <span className="ml-2">{format(new Date(lastDeployment.startedAt), "PPpp")}</span>
            </div>
            {lastDeployment.completedAt && (
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-2">{format(new Date(lastDeployment.completedAt), "PPpp")}</span>
              </div>
            )}
          </div>
          {lastDeployment.errorMessage && (
            <div className="mt-3 p-3 bg-destructive/10 rounded text-destructive text-sm">
              {lastDeployment.errorMessage}
            </div>
          )}
        </div>
      )}
      
      {deployStatus?.jobs && deployStatus.jobs.length > 1 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Recent Deployments</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployStatus.jobs.slice(1).map((job: any) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Badge 
                      variant={
                        job.status === "completed" ? "default" :
                        job.status === "failed" ? "destructive" : "outline"
                      }
                    >
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{job.triggeredBy}</TableCell>
                  <TableCell>{format(new Date(job.startedAt), "PPp")}</TableCell>
                  <TableCell>
                    {job.completedAt ? format(new Date(job.completedAt), "PPp") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function SystemSettings() {
  const { toast } = useToast();
  
  // Read initial tab from URL query param
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['credentials', 'pricing', 'config', 'audit', 'deploy'].includes(tab)) {
        return tab;
      }
    }
    return 'credentials';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
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
  const [viewProviderDialogOpen, setViewProviderDialogOpen] = useState(false);
  const [selectedProviderForView, setSelectedProviderForView] = useState<string | null>(null);
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false);
  const [selectedProviderForDelete, setSelectedProviderForDelete] = useState<string | null>(null);
  const [editProviderPasswordDialogOpen, setEditProviderPasswordDialogOpen] = useState(false);
  const [selectedProviderForEdit, setSelectedProviderForEdit] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoadingEditValues, setIsLoadingEditValues] = useState(false);
  
  const [unlockExpiry, setUnlockExpiry] = useState<number | null>(null);
  const [unlockTimeRemaining, setUnlockTimeRemaining] = useState(0);
  const [cachedPassword, setCachedPassword] = useState<string | null>(null);
  const isUnlocked = unlockExpiry !== null && Date.now() < unlockExpiry;
  
  const [viewDialogPassword, setViewDialogPassword] = useState("");
  const [showViewDialogPassword, setShowViewDialogPassword] = useState(false);
  const [viewDialogUnlocking, setViewDialogUnlocking] = useState(false);

  const { data: sessionData, isLoading: isLoadingSession } = useQuery<{ user: User }>({
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

  const { data: systemConfigData, isLoading: isLoadingConfig } = useQuery<SystemConfigResponse>({
    queryKey: ["/api/system-config"],
    enabled: sessionData?.user?.role === "superadmin" && activeTab === "config",
  });

  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editConfigValue, setEditConfigValue] = useState("");
  const [editConfigDescription, setEditConfigDescription] = useState("");
  const [editConfigIsPublic, setEditConfigIsPublic] = useState(false);
  const [addConfigDialogOpen, setAddConfigDialogOpen] = useState(false);
  const [newConfigKey, setNewConfigKey] = useState("");
  const [newConfigValue, setNewConfigValue] = useState("");
  const [newConfigDescription, setNewConfigDescription] = useState("");
  const [newConfigIsPublic, setNewConfigIsPublic] = useState(false);

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value, description, isPublic }: { key: string; value: string; description?: string; isPublic?: boolean }) => {
      return apiRequest("PUT", `/api/system-config/${encodeURIComponent(key)}`, { value, description, isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config"] });
      setEditingConfig(null);
      toast({
        title: "Configuration Updated",
        description: "The system configuration has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update configuration.",
        variant: "destructive",
      });
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: async ({ key, value, description, isPublic }: { key: string; value: string; description?: string; isPublic?: boolean }) => {
      return apiRequest("POST", "/api/system-config", { key, value, description, isPublic });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config"] });
      setAddConfigDialogOpen(false);
      setNewConfigKey("");
      setNewConfigValue("");
      setNewConfigDescription("");
      setNewConfigIsPublic(false);
      toast({
        title: "Configuration Created",
        description: "The new system configuration has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create configuration.",
        variant: "destructive",
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (key: string) => {
      return apiRequest("DELETE", `/api/system-config/${encodeURIComponent(key)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-config"] });
      toast({
        title: "Configuration Deleted",
        description: "The system configuration has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete configuration.",
        variant: "destructive",
      });
    },
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("DELETE", `/api/system/credentials/provider/${encodeURIComponent(provider)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
      setDeleteProviderDialogOpen(false);
      setSelectedProviderForDelete(null);
      toast({
        title: "Credentials Deleted",
        description: "All credentials for this provider have been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete credentials.",
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

  useEffect(() => {
    if (!unlockExpiry) {
      setUnlockTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((unlockExpiry - now) / 1000));
      setUnlockTimeRemaining(remaining);
      
      if (remaining <= 0) {
        setUnlockExpiry(null);
        setCachedPassword(null);
        toast({
          title: "Session Locked",
          description: "Your credential viewing session has expired. Enter your password to unlock again.",
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [unlockExpiry, toast]);

  const handleUnlock = (password: string) => {
    const UNLOCK_DURATION = 5 * 60 * 1000;
    setUnlockExpiry(Date.now() + UNLOCK_DURATION);
    setCachedPassword(password);
    setUnlockTimeRemaining(Math.ceil(UNLOCK_DURATION / 1000));
    toast({
      title: "Session Unlocked",
      description: "You can now view and edit credentials for 5 minutes without re-entering your password.",
    });
  };

  const handleLock = () => {
    setUnlockExpiry(null);
    setCachedPassword(null);
    setRevealedValues({});
    toast({
      title: "Session Locked",
      description: "Credential viewing session has been locked.",
    });
  };

  const handleViewDialogUnlock = async () => {
    if (!viewDialogPassword || !selectedProviderForView) return;
    
    setViewDialogUnlocking(true);
    
    const providerCredentials = groupedCredentials[selectedProviderForView] || [];
    if (providerCredentials.length === 0) {
      setViewDialogUnlocking(false);
      toast({
        title: "Error",
        description: "No credentials found for this provider.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const testCredential = providerCredentials[0];
      await apiRequest("POST", `/api/system/credentials/${testCredential.id}/reveal`, {
        password: viewDialogPassword,
      });
      
      const UNLOCK_DURATION = 5 * 60 * 1000;
      setUnlockExpiry(Date.now() + UNLOCK_DURATION);
      setCachedPassword(viewDialogPassword);
      setViewDialogPassword("");
      setShowViewDialogPassword(false);
      
      toast({
        title: "Session Unlocked",
        description: "You can now reveal credentials for 5 minutes without re-entering your password.",
      });
    } catch (error: any) {
      let errorMessage = "Failed to unlock session.";
      try {
        if (error?.message) {
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
          }
        }
      } catch {}
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setViewDialogUnlocking(false);
    }
  };

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
      if (!isUnlocked) {
        handleUnlock(data.password);
      }
      revealMutation.mutate({ id: selectedCredential.id, password: data.password });
    }
  };

  const revealWithCachedPassword = async (credential: SystemApiCredential) => {
    if (!cachedPassword) return;
    
    try {
      const response = await apiRequest("POST", `/api/system/credentials/${credential.id}/reveal`, { 
        password: cachedPassword 
      }) as RevealResponse;
      
      const expiresAt = Date.now() + 30000;
      setRevealedValues(prev => ({
        ...prev,
        [credential.id]: { value: response.value, expiresAt },
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/system/credentials/audit"] });
    } catch (error: any) {
      setUnlockExpiry(null);
      setCachedPassword(null);
      toast({
        title: "Session Expired",
        description: "Your password session has expired. Please enter your password again.",
        variant: "destructive",
      });
      setSelectedCredential(credential);
      revealForm.reset();
      setRevealDialogOpen(true);
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
    if (isUnlocked && cachedPassword) {
      revealWithCachedPassword(credential);
    } else {
      setSelectedCredential(credential);
      revealForm.reset();
      setRevealDialogOpen(true);
    }
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

  const loadProviderCredentials = async (provider: string, environment: string, password: string) => {
    setSelectedProviderForEdit(provider);
    setBulkFormProvider(provider);
    setBulkFormEnvironment(environment as "production" | "development" | "staging");
    setBulkFormValues({});
    setShowFieldValues({});
    setIsEditMode(true);
    setIsLoadingEditValues(true);
    
    const providerCredentials = groupedCredentials[provider] || [];
    
    try {
      const revealPromises = providerCredentials.map(async (credential) => {
        const response = await apiRequest("POST", `/api/system/credentials/${credential.id}/reveal`, { 
          password 
        }) as RevealResponse;
        return { keyName: credential.keyName, value: response.value };
      });
      
      const results = await Promise.all(revealPromises);
      const values: Record<string, string> = {};
      results.forEach(r => {
        values[r.keyName] = r.value;
      });
      
      setBulkFormValues(values);
      setAddDialogOpen(true);
      
      toast({
        title: "Credentials Loaded",
        description: "Existing values have been loaded for editing.",
      });
    } catch (error: any) {
      let errorMessage = "Failed to load credentials.";
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
        errorMessage = error?.message || "Failed to load credentials.";
      }
      
      if (errorMessage.toLowerCase().includes("invalid password") || errorMessage.toLowerCase().includes("incorrect")) {
        setUnlockExpiry(null);
        setCachedPassword(null);
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingEditValues(false);
    }
  };

  const handleEditProviderClick = (provider: string, environment: string) => {
    if (isUnlocked && cachedPassword) {
      loadProviderCredentials(provider, environment, cachedPassword);
    } else {
      setSelectedProviderForEdit(provider);
      setBulkFormProvider(provider);
      setBulkFormEnvironment(environment as "production" | "development" | "staging");
      setBulkFormValues({});
      setShowFieldValues({});
      setIsEditMode(true);
      revealForm.reset();
      setEditProviderPasswordDialogOpen(true);
    }
  };

  const handleEditProviderPasswordSubmit = async (data: RevealPasswordData) => {
    if (!selectedProviderForEdit) return;
    
    if (!isUnlocked) {
      handleUnlock(data.password);
    }
    
    setEditProviderPasswordDialogOpen(false);
    revealForm.reset();
    
    await loadProviderCredentials(selectedProviderForEdit, bulkFormEnvironment, data.password);
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

  if (isLoadingSession) {
    return <LoadingSpinner fullScreen={true} message="Loading system settings..." />;
  }

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
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1" data-testid="page-title">System Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage system-wide API credentials and view audit logs
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl" data-testid="settings-tabs">
          <TabsTrigger value="credentials" data-testid="tab-credentials">
            <Key className="h-4 w-4 mr-2" />
            API Credentials
          </TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-pricing">
            <DollarSign className="h-4 w-4 mr-2" />
            Telnyx Pricing
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings2 className="h-4 w-4 mr-2" />
            System Config
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <Activity className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="deploy" data-testid="tab-deploy">
            <Globe className="h-4 w-4 mr-2" />
            Deploy
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
              {isUnlocked && (
                <div className="flex items-center justify-between p-3 mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg" data-testid="unlock-banner">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Unlock className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Session unlocked - {Math.floor(unlockTimeRemaining / 60)}:{String(unlockTimeRemaining % 60).padStart(2, '0')} remaining
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLock}
                    className="text-green-700 dark:text-green-400 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-900/40"
                    data-testid="button-lock-session"
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Lock Now
                  </Button>
                </div>
              )}
              
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
                <div className="space-y-4">
                  {Object.entries(groupedCredentials).map(([provider, providerCredentials]) => {
                    const latestUpdate = providerCredentials.reduce((latest, cred) => 
                      new Date(cred.updatedAt) > new Date(latest.updatedAt) ? cred : latest
                    );
                    const environment = providerCredentials[0]?.environment || "production";
                    
                    return (
                      <div 
                        key={provider} 
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                        data-testid={`provider-card-${provider}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{getProviderDisplayName(provider)}</span>
                            <Badge variant="outline" className="text-xs">{environment}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span>{providerCredentials.length} credential(s) configured</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Updated {format(new Date(latestUpdate.updatedAt), "PPp")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProviderForView(provider);
                              setViewProviderDialogOpen(true);
                            }}
                            data-testid={`button-view-provider-${provider}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProviderClick(provider, environment)}
                            data-testid={`button-edit-provider-${provider}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedProviderForDelete(provider);
                              setDeleteProviderDialogOpen(true);
                            }}
                            data-testid={`button-delete-provider-${provider}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Telnyx Global Pricing</CardTitle>
              <CardDescription>
                Configure global pricing rates for Telnyx telephony services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TelnyxPricingSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">System Configuration</CardTitle>
                <CardDescription>
                  Manage global configuration values stored in the database
                </CardDescription>
              </div>
              <Button 
                onClick={() => setAddConfigDialogOpen(true)}
                data-testid="button-add-config"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Config
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner fullScreen={false} className="h-8 w-8" />
                </div>
              ) : !systemConfigData?.configs || systemConfigData.configs.length === 0 ? (
                <div className="text-center py-12">
                  <Settings2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No system configuration found</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setAddConfigDialogOpen(true)}
                    data-testid="button-add-config-empty"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Configuration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {systemConfigData.configs.map((config) => (
                    <div 
                      key={config.key} 
                      className="flex flex-col sm:flex-row sm:items-start justify-between p-4 border rounded-lg gap-4"
                      data-testid={`config-${config.key}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium font-mono" data-testid={`config-key-${config.key}`}>
                            {config.key}
                          </span>
                          {config.isPublic && (
                            <Badge variant="outline" className="text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              Public
                            </Badge>
                          )}
                        </div>
                        {config.description && (
                          <p className="text-sm text-muted-foreground mb-2" data-testid={`config-description-${config.key}`}>
                            {config.description}
                          </p>
                        )}
                        
                        {editingConfig === config.key ? (
                          <div className="space-y-3 mt-3">
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Value</label>
                              <Input
                                value={editConfigValue}
                                onChange={(e) => setEditConfigValue(e.target.value)}
                                placeholder="Enter value"
                                data-testid={`input-config-value-${config.key}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium">Description</label>
                              <Input
                                value={editConfigDescription}
                                onChange={(e) => setEditConfigDescription(e.target.value)}
                                placeholder="Enter description (optional)"
                                data-testid={`input-config-description-${config.key}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={editConfigIsPublic}
                                onCheckedChange={setEditConfigIsPublic}
                                data-testid={`switch-config-public-${config.key}`}
                              />
                              <label className="text-sm">Public (safe for frontend)</label>
                            </div>
                          </div>
                        ) : (
                          <div className="font-mono text-sm bg-muted px-2 py-1 rounded break-all" data-testid={`config-value-${config.key}`}>
                            {config.value}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span data-testid={`config-updated-${config.key}`}>
                            Updated {format(new Date(config.updatedAt), "PPp")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {editingConfig === config.key ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingConfig(null)}
                              data-testid={`button-cancel-edit-${config.key}`}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateConfigMutation.mutate({
                                key: config.key,
                                value: editConfigValue,
                                description: editConfigDescription || undefined,
                                isPublic: editConfigIsPublic,
                              })}
                              disabled={updateConfigMutation.isPending}
                              data-testid={`button-save-config-${config.key}`}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingConfig(config.key);
                                setEditConfigValue(config.value);
                                setEditConfigDescription(config.description || "");
                                setEditConfigIsPublic(config.isPublic);
                              }}
                              data-testid={`button-edit-config-${config.key}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete "${config.key}"?`)) {
                                  deleteConfigMutation.mutate(config.key);
                                }
                              }}
                              data-testid={`button-delete-config-${config.key}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
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

        <TabsContent value="deploy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Production Deployment</CardTitle>
              <CardDescription>
                Trigger manual deployment to production server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DeploymentSection />
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
          setIsEditMode(false);
        }
      }}>
        <DialogContent className="sm:max-w-[550px]" data-testid="dialog-add-credential">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit API Credentials" : "Add API Credentials"}</DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? "Update credentials for this service. Modified fields will be saved."
                : "Configure credentials for an integrated service. Required fields are marked with *."}
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
                disabled={isEditMode}
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
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowFieldValues(prev => ({
                              ...prev,
                              [key.keyName]: !prev[key.keyName]
                            }))}
                            data-testid={`button-toggle-${key.keyName}`}
                          >
                            {showFieldValues[key.keyName] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
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
                      <div className="relative">
                        <Input
                          {...field}
                          type={showValue ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pr-10"
                          data-testid="input-reveal-password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowValue(!showValue)}
                          data-testid="button-toggle-reveal-password"
                        >
                          {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRevealDialogOpen(false);
                    setShowValue(false);
                  }}
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

      <Dialog open={editProviderPasswordDialogOpen} onOpenChange={(open) => {
        setEditProviderPasswordDialogOpen(open);
        if (!open) {
          setSelectedProviderForEdit(null);
          setIsEditMode(false);
        }
      }}>
        <DialogContent className="sm:max-w-[400px]" data-testid="dialog-edit-provider-password">
          <DialogHeader>
            <DialogTitle>Confirm Password</DialogTitle>
            <DialogDescription>
              Enter your password to load and edit credentials for {selectedProviderForEdit && getProviderDisplayName(selectedProviderForEdit)}.
            </DialogDescription>
          </DialogHeader>
          <Form {...revealForm}>
            <form onSubmit={revealForm.handleSubmit(handleEditProviderPasswordSubmit)} className="space-y-4">
              <FormField
                control={revealForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showValue ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pr-10"
                          data-testid="input-edit-provider-password"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowValue(!showValue)}
                          data-testid="button-toggle-edit-provider-password"
                        >
                          {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditProviderPasswordDialogOpen(false);
                    setShowValue(false);
                  }}
                  data-testid="button-cancel-edit-provider"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoadingEditValues}
                  data-testid="button-submit-edit-provider"
                >
                  {isLoadingEditValues && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
                  Load Credentials
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

      <Dialog open={addConfigDialogOpen} onOpenChange={setAddConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-config">
          <DialogHeader>
            <DialogTitle>Add System Configuration</DialogTitle>
            <DialogDescription>
              Add a new system configuration value. Public configs can be accessed by the frontend.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Key *</label>
              <Input
                value={newConfigKey}
                onChange={(e) => setNewConfigKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                placeholder="e.g. APP_NAME, FEATURE_FLAG"
                className="font-mono"
                data-testid="input-new-config-key"
              />
              <p className="text-xs text-muted-foreground">Use uppercase letters, numbers, and underscores</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Value *</label>
              <Input
                value={newConfigValue}
                onChange={(e) => setNewConfigValue(e.target.value)}
                placeholder="Enter configuration value"
                data-testid="input-new-config-value"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newConfigDescription}
                onChange={(e) => setNewConfigDescription(e.target.value)}
                placeholder="Describe what this configuration is for"
                data-testid="input-new-config-description"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={newConfigIsPublic}
                onCheckedChange={setNewConfigIsPublic}
                data-testid="switch-new-config-public"
              />
              <label className="text-sm">
                Public (can be accessed by frontend without authentication)
              </label>
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddConfigDialogOpen(false);
                setNewConfigKey("");
                setNewConfigValue("");
                setNewConfigDescription("");
                setNewConfigIsPublic(false);
              }}
              data-testid="button-cancel-add-config"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newConfigKey && newConfigValue) {
                  createConfigMutation.mutate({
                    key: newConfigKey,
                    value: newConfigValue,
                    description: newConfigDescription || undefined,
                    isPublic: newConfigIsPublic,
                  });
                }
              }}
              disabled={createConfigMutation.isPending || !newConfigKey || !newConfigValue}
              data-testid="button-submit-add-config"
            >
              {createConfigMutation.isPending && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
              Add Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewProviderDialogOpen} onOpenChange={(open) => {
        setViewProviderDialogOpen(open);
        if (!open) {
          setViewDialogPassword("");
          setShowViewDialogPassword(false);
          setViewDialogUnlocking(false);
        }
      }}>
        <DialogContent className="sm:max-w-[550px]" data-testid="dialog-view-provider">
          <DialogHeader>
            <DialogTitle>
              {selectedProviderForView && getProviderDisplayName(selectedProviderForView)} Credentials
            </DialogTitle>
            <DialogDescription>
              View configured credentials for this provider.
            </DialogDescription>
          </DialogHeader>
          
          {isUnlocked ? (
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Unlock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Unlocked - {Math.floor(unlockTimeRemaining / 60)}:{String(unlockTimeRemaining % 60).padStart(2, '0')} remaining
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLock}
                className="text-green-700 dark:text-green-400 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-900/40"
                data-testid="button-lock-view-dialog"
              >
                <Lock className="h-4 w-4 mr-1" />
                Lock
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Enter password to reveal credentials</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showViewDialogPassword ? "text" : "password"}
                    value={viewDialogPassword}
                    onChange={(e) => setViewDialogPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && viewDialogPassword) {
                        e.preventDefault();
                        handleViewDialogUnlock();
                      }
                    }}
                    data-testid="input-view-dialog-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowViewDialogPassword(!showViewDialogPassword)}
                    data-testid="button-toggle-view-dialog-password"
                  >
                    {showViewDialogPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleViewDialogUnlock}
                  disabled={viewDialogUnlocking || !viewDialogPassword}
                  data-testid="button-unlock-view-dialog"
                >
                  {viewDialogUnlocking && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
                  Unlock
                </Button>
              </div>
            </div>
          )}
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {selectedProviderForView && groupedCredentials[selectedProviderForView]?.map((credential) => {
              const revealed = revealedValues[credential.id];
              const timeRemaining = revealed ? Math.ceil((revealed.expiresAt - Date.now()) / 1000) : 0;
              
              return (
                <div 
                  key={credential.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`view-credential-${credential.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm" data-testid={`view-credential-keyname-${credential.id}`}>
                      {credential.keyName}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground break-all">
                      <span data-testid={`view-credential-value-${credential.id}`}>
                        {revealed ? revealed.value : "••••••••••••••••"}
                      </span>
                      {revealed && (
                        <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                          ({timeRemaining}s)
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isUnlocked && cachedPassword) {
                        revealWithCachedPassword(credential);
                      }
                    }}
                    disabled={!!revealed || !isUnlocked}
                    data-testid={`button-reveal-view-${credential.id}`}
                  >
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setViewProviderDialogOpen(false)}
              data-testid="button-close-view-provider"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteProviderDialogOpen} onOpenChange={setDeleteProviderDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-provider">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Credentials</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all credentials for{" "}
              {selectedProviderForDelete && getProviderDisplayName(selectedProviderForDelete)}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-provider">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProviderForDelete && bulkDeleteMutation.mutate(selectedProviderForDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-delete-provider"
            >
              {bulkDeleteMutation.isPending && <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
