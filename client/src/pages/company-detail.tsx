import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe, Edit, Users, Power, Trash2, UserPlus, CreditCard, FileText, Briefcase, UserCheck, Eye, Settings, Calendar, Puzzle, Plus, X, Palette, Clock, History, LogIn, Send, ChevronDown, ChevronUp, RefreshCw, PhoneCall, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { formatForDisplay, formatE164, formatPhoneInput } from "@shared/phone";
import type { Company, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import { CompanyBillingTab } from "@/components/company-billing-tab";
import { useTabsState } from "@/hooks/use-tabs-state";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const userFormSchema = insertUserSchema.omit({ password: true }).extend({
  role: z.enum(["admin", "member", "viewer"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional(),
  address: z.string().optional(),
  companyId: z.string(),
});

type UserForm = z.infer<typeof userFormSchema>;

export default function CompanyDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useTabsState(["details", "users", "billing", "features", "settings", "calendar", "phone", "logs"], "details");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [assignFeatureOpen, setAssignFeatureOpen] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);
  const companyId = params.id;

  const { data: companyData, isLoading: isLoadingCompany } = useQuery<{ company: Company }>({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch company");
      return res.json();
    },
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: subscriptionData } = useQuery<{ subscription: any }>({
    queryKey: ["/api/subscription", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/subscription?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: plansData } = useQuery<{ plans: any[] }>({
    queryKey: ["/api/plans"],
  });

  const { data: companyFeaturesData, isLoading: isLoadingCompanyFeatures } = useQuery<{ features: any[] }>({
    queryKey: ["/api/companies", companyId, "features"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${companyId}/features`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch company features");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: allFeaturesData, isLoading: isLoadingAllFeatures } = useQuery<{ features: any[] }>({
    queryKey: ["/api/features"],
    enabled: !!companyId,
  });

  const { data: companySettingsData, isLoading: isLoadingSettings } = useQuery<{ settings: any }>({
    queryKey: ["/api/settings/company", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/settings/company?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch company settings");
      return res.json();
    },
    enabled: !!companyId,
  });

  const { data: activityLogsData, isLoading: isLoadingLogs } = useQuery<{ logs: any[] }>({
    queryKey: ["/api/audit-logs", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?companyId=${companyId}&limit=500`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    enabled: !!companyId && activeTab === "logs",
  });

  const activityLogs = activityLogsData?.logs || [];

  const { data: phoneStatusData, isLoading: isLoadingPhoneStatus, refetch: refetchPhoneStatus } = useQuery<{
    configured: boolean;
    managedAccountId?: string;
    accountDetails?: any;
    message?: string;
  }>({
    queryKey: ["/api/telnyx/managed-accounts/status", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/telnyx/managed-accounts/status?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch phone status");
      return res.json();
    },
    enabled: !!companyId && activeTab === "phone",
  });

  const { data: phoneNumbersData, isLoading: isLoadingPhoneNumbers, refetch: refetchPhoneNumbers } = useQuery<{
    success: boolean;
    numbers?: any[];
  }>({
    queryKey: ["/api/telnyx/my-numbers", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/telnyx/my-numbers?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch phone numbers");
      return res.json();
    },
    enabled: !!companyId && activeTab === "phone" && phoneStatusData?.configured === true,
  });

  // Call Billing Analytics query
  const { data: callBillingData, isLoading: isLoadingCallBilling, refetch: refetchCallBilling } = useQuery<{
    success: boolean;
    records: any[];
    summary: {
      totalCalls: number;
      callsWithCdrData: number;
      totalClientCost: number;
      totalClientCostFormatted: string;
      totalTelnyxCost: number;
      totalTelnyxCostFormatted: string;
      totalProfit: number;
      totalProfitFormatted: string;
      overallProfitMargin: string;
      cdrNote: string;
    };
  }>({
    queryKey: ["/api/telnyx/call-billing", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/telnyx/call-billing?companyId=${companyId}&limit=50`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch call billing");
      return res.json();
    },
    enabled: !!companyId && activeTab === "phone" && phoneStatusData?.configured === true,
  });

  const company = companyData?.company;
  const allUsers = usersData?.users || [];
  const companyUsers = allUsers.filter(user => user.companyId === companyId);
  const currentUser = sessionData?.user;
  const companyFeatures = companyFeaturesData?.features || [];
  const allFeatures = allFeaturesData?.features || [];
  const companySettings = companySettingsData?.settings;

  const availableFeaturesToAssign = allFeatures.filter(
    f => !companyFeatures.some((cf: any) => cf.id === f.id)
  );

  const createUserForm = useForm<UserForm>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      preferredLanguage: "en",
      address: "",
      role: "member",
      companyId: companyId || "",
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      const phoneE164 = data.phone ? formatE164(data.phone) : null;
      return apiRequest("POST", "/api/users", { ...data, phone: phoneE164 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreateUserOpen(false);
      createUserForm.reset();
      toast({
        title: "User Created",
        description: "The user has been created and will receive an activation email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PATCH", `/api/users/${userId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Status Updated",
        description: "User status has been updated successfully",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully",
      });
    },
  });

  const toggleCompanyStatusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/companies/${companyId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({
        title: "Status Updated",
        description: `Company has been ${company?.isActive ? "suspended" : "activated"} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest("POST", `/api/companies/${companyId}/subscription`, { planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription", companyId] });
      setAssignPlanOpen(false);
      setSelectedPlanId("");
      toast({
        title: "Plan Assigned",
        description: "The plan has been successfully assigned to this company.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const assignFeatureMutation = useMutation({
    mutationFn: async (featureId: string) => {
      return apiRequest("POST", `/api/companies/${companyId}/features`, { featureId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "features"] });
      setAssignFeatureOpen(false);
      setSelectedFeatureId("");
      toast({
        title: "Feature Assigned",
        description: "The feature has been successfully assigned to this company.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFeatureMutation = useMutation({
    mutationFn: async (featureId: string) => {
      return apiRequest("DELETE", `/api/companies/${companyId}/features/${featureId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "features"] });
      toast({
        title: "Feature Removed",
        description: "The feature has been removed from this company.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/settings/company`, { ...data, companyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/company", companyId] });
      toast({
        title: "Settings Updated",
        description: "Company settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (data: { logId: string; recipient: string; subject: string; htmlContent: string }) => {
      setResendingLogId(data.logId);
      return apiRequest("POST", `/api/email/resend`, {
        recipient: data.recipient,
        subject: data.subject,
        htmlContent: data.htmlContent,
        companyId,
      });
    },
    onSuccess: () => {
      setResendingLogId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs", companyId] });
      toast({
        title: "Email Resent",
        description: "The email has been resent successfully.",
      });
    },
    onError: (error: Error) => {
      setResendingLogId(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return { label: "Super Admin", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" };
      case "admin":
        return { label: "Admin", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" };
      case "member":
        return { label: "Member", className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" };
      case "viewer":
        return { label: "Viewer", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400" };
      default:
        return { label: role, className: "bg-gray-100 text-gray-800" };
    }
  };

  if (isLoadingCompany) {
    return <LoadingSpinner message="Loading company..." />;
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-2xl font-bold">Company Not Found</h2>
        <Button onClick={() => setLocation("/companies")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="text-sm text-muted-foreground">@{company.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={company.isActive ? "default" : "destructive"}>
            {company.isActive ? "Active" : "Suspended"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleCompanyStatusMutation.mutate()}
            disabled={toggleCompanyStatusMutation.isPending}
            data-testid="button-toggle-company-status"
          >
            <Power className="h-4 w-4 mr-1" />
            {company.isActive ? "Suspend" : "Activate"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-8" data-testid="tabs-company-details">
          <TabsTrigger value="details" data-testid="tab-details">
            <Building2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Details</span>
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Users</span>
            <Badge variant="secondary" className="ml-1 text-xs px-1.5">{companyUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            <CreditCard className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">
            <Puzzle className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Features</span>
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <Calendar className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="phone" data-testid="tab-phone">
            <PhoneCall className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Phone</span>
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <History className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Basic Details Tab */}
        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-company-info">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Company Information</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setLocation(`/companies/${companyId}/edit`)} data-testid="button-edit-company">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Company Name</p>
                    <p className="text-sm font-medium">{company.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Slug</p>
                    <p className="text-sm font-medium">@{company.slug}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Status</p>
                    <Badge variant={company.isActive ? "default" : "destructive"} className="mt-0.5">
                      {company.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </div>
                  {company.timezone && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Timezone</p>
                      <p className="text-sm">{company.timezone}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-contact-info">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                    <p className="text-sm truncate">{company.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Phone</p>
                    <p className="text-sm">{company.phone ? formatForDisplay(company.phone) : "Not provided"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Website</p>
                    {company.website ? (
                      <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block">
                        {company.website}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not provided</p>
                    )}
                  </div>
                </div>
                {company.domain && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">Domain</p>
                      <p className="text-sm truncate">{company.domain}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-address">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Address</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    {company.address && <p className="text-sm">{company.address}</p>}
                    {company.addressLine2 && <p className="text-sm">{company.addressLine2}</p>}
                    {(company.city || company.state || company.postalCode) && (
                      <p className="text-sm">
                        {[company.city, company.state, company.postalCode].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {company.country && <p className="text-sm">{company.country}</p>}
                    {!company.address && !company.city && !company.country && (
                      <p className="text-sm text-muted-foreground">No address provided</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-business-info">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Business Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.businessType && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Business Type</p>
                      <p className="text-sm">{company.businessType}</p>
                    </div>
                  </div>
                )}
                {company.registrationIdType && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Registration Type</p>
                      <p className="text-sm">{company.registrationIdType}</p>
                    </div>
                  </div>
                )}
                {company.registrationNumber && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Registration Number</p>
                      <p className="text-sm font-mono">{company.registrationNumber}</p>
                    </div>
                  </div>
                )}
                {company.isNotRegistered && (
                  <Badge variant="outline">Not Registered</Badge>
                )}
                {company.regionsOfOperation && company.regionsOfOperation.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Regions of Operation</p>
                    <div className="flex flex-wrap gap-1">
                      {company.regionsOfOperation.map((region, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{region}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!company.businessType && !company.registrationNumber && (!company.regionsOfOperation || company.regionsOfOperation.length === 0) && (
                  <p className="text-sm text-muted-foreground">No business information provided</p>
                )}
              </CardContent>
            </Card>

            {(company.representativeFirstName || company.representativeLastName || company.representativeEmail) && (
              <Card className="lg:col-span-2" data-testid="card-representative">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Authorized Representative</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(company.representativeFirstName || company.representativeLastName) && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Name</p>
                          <p className="text-sm">{[company.representativeFirstName, company.representativeLastName].filter(Boolean).join(" ")}</p>
                        </div>
                      </div>
                    )}
                    {company.representativePosition && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Position</p>
                          <p className="text-sm">{company.representativePosition}</p>
                        </div>
                      </div>
                    )}
                    {company.representativeEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Email</p>
                          <p className="text-sm truncate">{company.representativeEmail}</p>
                        </div>
                      </div>
                    )}
                    {company.representativePhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Phone</p>
                          <p className="text-sm">{formatForDisplay(company.representativePhone)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card data-testid="card-users">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Company Users
                </CardTitle>
                <CardDescription>{companyUsers.length} user{companyUsers.length !== 1 ? "s" : ""} in this company</CardDescription>
              </div>
              <Button onClick={() => setCreateUserOpen(true)} data-testid="button-add-user">
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <LoadingSpinner message="Loading users..." />
              ) : companyUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No users in this company yet.</p>
                  <p className="text-sm">Add your first user to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase px-6 py-2">User</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Phone</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Role</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Status</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase px-4 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyUsers.map((user) => {
                        const roleBadge = getRoleBadge(user.role);
                        return (
                          <tr key={user.id} className="border-b hover:bg-muted/50 transition-colors" data-testid={`row-user-${user.id}`}>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.avatar || undefined} alt={user.email} />
                                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                    {(user.firstName?.[0] || user.email.charAt(0)).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  {(user.firstName || user.lastName) ? (
                                    <>
                                      <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                    </>
                                  ) : (
                                    <p className="text-sm font-medium truncate">{user.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {user.phone ? formatForDisplay(user.phone) : <span className="italic">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.className}`}>
                                {roleBadge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLocation(`/users/${user.id}`)} title="View Details" data-testid={`button-view-user-${user.id}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleUserStatusMutation.mutate(user.id)} disabled={toggleUserStatusMutation.isPending} title={user.isActive ? "Deactivate" : "Activate"} data-testid={`button-toggle-user-${user.id}`}>
                                  <Power className={`h-3.5 w-3.5 ${user.isActive ? "text-green-600" : "text-muted-foreground"}`} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteUserMutation.mutate(user.id)} disabled={deleteUserMutation.isPending || user.id === currentUser?.id} title={user.id === currentUser?.id ? "Cannot delete yourself" : "Delete User"} data-testid={`button-delete-user-${user.id}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-4">
          <CompanyBillingTab companyId={companyId!} />
        </TabsContent>

        {/* Features & Limits Tab */}
        <TabsContent value="features" className="mt-4">
          <Card data-testid="card-features">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Puzzle className="h-5 w-5" />
                  Features & Limits
                </CardTitle>
                <CardDescription>Manage features enabled for this company</CardDescription>
              </div>
              <Button onClick={() => setAssignFeatureOpen(true)} disabled={availableFeaturesToAssign.length === 0} data-testid="button-assign-feature">
                <Plus className="h-4 w-4 mr-1.5" />
                Assign Feature
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingCompanyFeatures || isLoadingAllFeatures ? (
                <LoadingSpinner message="Loading features..." />
              ) : companyFeatures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Puzzle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No features assigned to this company.</p>
                  <p className="text-sm">Assign features to enable functionality.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {companyFeatures.map((feature: any) => (
                    <div key={feature.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30" data-testid={`feature-${feature.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Puzzle className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{feature.name || "Unknown Feature"}</p>
                          {feature.key && <p className="text-xs text-muted-foreground font-mono">{feature.key}</p>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0" onClick={() => removeFeatureMutation.mutate(feature.id)} disabled={removeFeatureMutation.isPending} title="Remove Feature" data-testid={`button-remove-feature-${feature.id}`}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          {isLoadingSettings ? (
            <LoadingSpinner message="Loading settings..." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-branding">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Branding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Primary Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-8 w-8 rounded border" style={{ backgroundColor: companySettings?.primaryColor || "#2196F3" }} />
                        <Input value={companySettings?.primaryColor || "#2196F3"} className="h-8 text-sm font-mono" readOnly data-testid="input-primary-color" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Secondary Color</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-8 w-8 rounded border" style={{ backgroundColor: companySettings?.secondaryColor || "#1976D2" }} />
                        <Input value={companySettings?.secondaryColor || "#1976D2"} className="h-8 text-sm font-mono" readOnly data-testid="input-secondary-color" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-timezone">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Timezone & Locale
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Timezone</Label>
                    <p className="text-sm font-medium mt-1">{company.timezone || "UTC"}</p>
                  </div>
                  {company.platformLanguage && (
                    <div>
                      <Label className="text-xs">Platform Language</Label>
                      <p className="text-sm font-medium mt-1">{company.platformLanguage}</p>
                    </div>
                  )}
                  {company.outboundLanguage && (
                    <div>
                      <Label className="text-xs">Outbound Language</Label>
                      <p className="text-sm font-medium mt-1">{company.outboundLanguage}</p>
                    </div>
                  )}
                  {company.currency && (
                    <div>
                      <Label className="text-xs">Currency</Label>
                      <p className="text-sm font-medium mt-1">{company.currency}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {companySettings?.emailSettings && (
                <Card data-testid="card-email-settings">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {companySettings.emailSettings.fromName && (
                        <div>
                          <Label className="text-xs">From Name</Label>
                          <p className="text-sm font-medium mt-1">{companySettings.emailSettings.fromName}</p>
                        </div>
                      )}
                      {companySettings.emailSettings.fromEmail && (
                        <div>
                          <Label className="text-xs">From Email</Label>
                          <p className="text-sm font-medium mt-1">{companySettings.emailSettings.fromEmail}</p>
                        </div>
                      )}
                      {companySettings.emailSettings.replyToEmail && (
                        <div>
                          <Label className="text-xs">Reply-To Email</Label>
                          <p className="text-sm font-medium mt-1">{companySettings.emailSettings.replyToEmail}</p>
                        </div>
                      )}
                    </div>
                    {!companySettings.emailSettings.fromName && !companySettings.emailSettings.fromEmail && (
                      <p className="text-sm text-muted-foreground">No email settings configured</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {companySettings?.features && (
                <Card data-testid="card-feature-flags">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Feature Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(companySettings.features).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <Badge variant={value ? "default" : "secondary"} className="text-xs">
                            {value ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Calendar Settings Tab */}
        <TabsContent value="calendar" className="space-y-4 mt-4">
          <Card data-testid="card-calendar-settings">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar Settings
              </CardTitle>
              <CardDescription>Holiday configuration and calendar preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <Label className="text-xs text-muted-foreground">Holiday Country</Label>
                  <p className="text-sm font-medium mt-1">{companySettings?.holidayCountryCode || "US"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Public holidays based on this country</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Label className="text-xs text-muted-foreground">Timezone</Label>
                  <p className="text-sm font-medium mt-1">{company.timezone || "UTC"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">All calendar events use this timezone</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Holiday Settings</h4>
                <p className="text-sm text-muted-foreground">
                  This company follows the public holiday calendar for <strong>{companySettings?.holidayCountryCode || "US"}</strong>.
                  Holidays are automatically applied to scheduling and availability features.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phone System Tab */}
        <TabsContent value="phone" className="space-y-4 mt-4">
          <Card data-testid="card-phone-system">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PhoneCall className="h-5 w-5" />
                    Phone System
                  </CardTitle>
                  <CardDescription>Manage phone numbers and voice/SMS capabilities</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    refetchPhoneStatus();
                    refetchPhoneNumbers();
                  }}
                  data-testid="button-refresh-phone"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPhoneStatus ? (
                <LoadingSpinner fullScreen={false} />
              ) : phoneStatusData?.configured ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">Phone System Active</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <Label className="text-xs text-muted-foreground">Managed Account ID</Label>
                      <p className="text-sm font-mono mt-1 break-all">{phoneStatusData.managedAccountId}</p>
                    </div>
                    {phoneStatusData.accountDetails?.email && (
                      <div className="p-4 border rounded-lg">
                        <Label className="text-xs text-muted-foreground">Account Email</Label>
                        <p className="text-sm mt-1">{phoneStatusData.accountDetails.email}</p>
                      </div>
                    )}
                    {phoneStatusData.accountDetails?.business_name && (
                      <div className="p-4 border rounded-lg">
                        <Label className="text-xs text-muted-foreground">Business Name</Label>
                        <p className="text-sm mt-1">{phoneStatusData.accountDetails.business_name}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Numbers ({phoneNumbersData?.numbers?.length || 0})
                    </h4>
                    {isLoadingPhoneNumbers ? (
                      <LoadingSpinner fullScreen={false} />
                    ) : phoneNumbersData?.numbers && phoneNumbersData.numbers.length > 0 ? (
                      <div className="space-y-2">
                        {phoneNumbersData.numbers.map((number: any) => (
                          <div key={number.id || number.phone_number} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{formatForDisplay(number.phone_number)}</p>
                                <p className="text-xs text-muted-foreground">{number.connection_name || "Default Connection"}</p>
                              </div>
                            </div>
                            <Badge variant={number.status === "active" ? "default" : "secondary"}>
                              {number.status || "Active"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No phone numbers purchased yet</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Phone system not configured for this company</p>
                  <p className="text-xs text-muted-foreground mt-1">{phoneStatusData?.message || "Company needs to activate their phone system"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Billing Analytics Card - Only visible for superadmin */}
          {phoneStatusData?.configured && (
            <Card data-testid="card-call-billing" className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Call Billing Analytics
                    </CardTitle>
                    <CardDescription>Compare client charges vs Telnyx wholesale costs</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetchCallBilling()}
                    data-testid="button-refresh-billing"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingCallBilling ? (
                  <LoadingSpinner fullScreen={false} />
                ) : callBillingData?.records && callBillingData.records.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Calls</p>
                        <p className="text-lg font-bold">{callBillingData.summary.totalCalls}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Client Revenue</p>
                        <p className="text-lg font-bold text-blue-600">{callBillingData.summary.totalClientCostFormatted}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Telnyx Cost</p>
                        <p className="text-lg font-bold text-orange-600">{callBillingData.summary.totalTelnyxCostFormatted}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Profit</p>
                        <p className="text-lg font-bold text-green-600">{callBillingData.summary.totalProfitFormatted}</p>
                        <p className="text-xs text-green-600">({callBillingData.summary.overallProfitMargin})</p>
                      </div>
                    </div>

                    {callBillingData.summary.cdrNote && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                        <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">{callBillingData.summary.cdrNote}</p>
                      </div>
                    )}

                    {/* Calls Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Date/Time</th>
                              <th className="text-left p-2 font-medium">Direction</th>
                              <th className="text-left p-2 font-medium">From/To</th>
                              <th className="text-right p-2 font-medium">Duration</th>
                              <th className="text-right p-2 font-medium">Client Cost</th>
                              <th className="text-right p-2 font-medium">Telnyx Cost</th>
                              <th className="text-right p-2 font-medium">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {callBillingData.records.map((call: any) => (
                              <tr key={call.id} className="border-t hover:bg-muted/30">
                                <td className="p-2 text-xs">
                                  {call.startedAt ? new Date(call.startedAt).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  }) : 'N/A'}
                                </td>
                                <td className="p-2">
                                  <Badge variant={call.direction === 'inbound' ? 'secondary' : 'outline'} className="text-xs">
                                    {call.direction === 'inbound' ? 'IN' : 'OUT'}
                                  </Badge>
                                </td>
                                <td className="p-2 text-xs">
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">{formatForDisplay(call.fromNumber)}</span>
                                    <span>{formatForDisplay(call.toNumber)}</span>
                                  </div>
                                </td>
                                <td className="p-2 text-right text-xs font-mono">
                                  {Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}
                                  {call.billedDuration > 0 && call.billedDuration !== call.duration && (
                                    <span className="text-muted-foreground ml-1">({Math.ceil(call.billedDuration / 60)}m billed)</span>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono text-blue-600">{call.clientCostFormatted}</td>
                                <td className="p-2 text-right font-mono">
                                  {call.hasTelnyxData ? (
                                    <span className="text-orange-600">{call.telnyxCostFormatted}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">Pending</span>
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {call.hasTelnyxData ? (
                                    <span className="text-green-600">{call.profitFormatted}</span>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No call records found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <Card data-testid="card-activity-logs">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Activity Logs
              </CardTitle>
              <CardDescription>View all authentication, email, and communication activity for this company</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <LoadingSpinner fullScreen={false} />
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No activity logs found for this company</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {activityLogs.map((log: any, index: number) => {
                    const isAuthLog = log.action?.startsWith('auth_');
                    const isEmailLog = log.action?.startsWith('email_') || log.action === 'email_sent';
                    const isPlanLog = log.action === 'plan_selected';
                    const isOtpLog = log.action === 'otp_sent';
                    const metadata = log.metadata || {};
                    
                    const getActionIcon = () => {
                      if (isPlanLog) return <CreditCard className="h-4 w-4" />;
                      if (isAuthLog) return <LogIn className="h-4 w-4" />;
                      if (isEmailLog || isOtpLog) return <Send className="h-4 w-4" />;
                      return <FileText className="h-4 w-4" />;
                    };
                    
                    const getActionBadgeVariant = () => {
                      if (log.action?.includes('failed')) return 'destructive';
                      if (log.action?.includes('login') || log.action?.includes('success')) return 'default';
                      if (isPlanLog) return 'default';
                      if (isEmailLog) return 'secondary';
                      return 'outline';
                    };
                    
                    const formatPrice = (cents: number | null | undefined) => {
                      if (cents === null || cents === undefined) return 'N/A';
                      return `$${(cents / 100).toFixed(2)}`;
                    };
                    
                    const formatAction = (action: string) => {
                      return action
                        .replace('auth_', '')
                        .replace('email_', 'Email: ')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                    };
                    
                    const formatDate = (dateStr: string) => {
                      const date = new Date(dateStr);
                      return date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    };

                    const user = allUsers.find(u => u.id === log.userId);
                    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown User';

                    const isExpanded = expandedLogId === log.id;
                    const hasEmailContent = isEmailLog && metadata.htmlContent;

                    return (
                      <div 
                        key={log.id || index} 
                        className="border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`log-entry-${index}`}
                      >
                        <div className="flex items-start gap-3 p-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getActionIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={getActionBadgeVariant()} className="text-xs">
                                {formatAction(log.action || 'unknown')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {log.userId && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">User:</span>{' '}
                                  <span className="font-medium">{userName}</span>
                                </p>
                              )}
                              {metadata.email && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Email:</span>{' '}
                                  <span className="font-medium">{metadata.email}</span>
                                </p>
                              )}
                              {metadata.recipient && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Recipient:</span>{' '}
                                  <span className="font-medium">{metadata.recipient}</span>
                                </p>
                              )}
                              {metadata.subject && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Subject:</span>{' '}
                                  <span className="font-medium">{metadata.subject}</span>
                                </p>
                              )}
                              {metadata.templateSlug && (
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Template:</span>{' '}
                                  <span className="font-medium">{metadata.templateSlug}</span>
                                </p>
                              )}
                              {log.ipAddress && (
                                <p className="text-xs text-muted-foreground">
                                  IP: {log.ipAddress}
                                  {metadata.city && metadata.country && ` (${metadata.city}, ${metadata.country})`}
                                </p>
                              )}
                              {/* Plan Details Section - Single Line */}
                              {isPlanLog && (
                                <p className="text-sm mt-1">
                                  <span className="font-semibold">{metadata.planName || 'Unknown Plan'}</span>
                                  {metadata.monthlyPrice !== undefined && (
                                    <span className="text-muted-foreground"> | {formatPrice(metadata.monthlyPrice)}/mo</span>
                                  )}
                                  {metadata.billingPeriod && (
                                    <span className="text-muted-foreground"> | {metadata.billingPeriod}</span>
                                  )}
                                  {metadata.maxUsers !== undefined && (
                                    <span className="text-muted-foreground"> | {metadata.maxUsers || '∞'} users</span>
                                  )}
                                  {metadata.trialEndDate && (
                                    <span className="text-muted-foreground"> | Trial ends {new Date(metadata.trialEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  )}
                                  {metadata.stripeSubscriptionId && (
                                    <span className="text-muted-foreground font-mono text-xs"> | {metadata.stripeSubscriptionId}</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                          {hasEmailContent && (
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                data-testid={`btn-expand-log-${index}`}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="ml-1 text-xs">{isExpanded ? 'Hide' : 'View'}</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resendEmailMutation.mutate({
                                  logId: log.id,
                                  recipient: metadata.recipient,
                                  subject: metadata.subject,
                                  htmlContent: metadata.htmlContent,
                                })}
                                disabled={resendingLogId === log.id}
                                data-testid={`btn-resend-log-${index}`}
                              >
                                <RefreshCw className={`h-3 w-3 ${resendingLogId === log.id ? 'animate-spin' : ''}`} />
                                <span className="ml-1 text-xs">{resendingLogId === log.id ? 'Sending...' : 'Resend'}</span>
                              </Button>
                            </div>
                          )}
                        </div>
                        {isExpanded && hasEmailContent && (
                          <div className="border-t px-3 pb-3 pt-2">
                            <div className="bg-white dark:bg-zinc-900 border rounded-lg p-4 max-h-[400px] overflow-y-auto">
                              <div dangerouslySetInnerHTML={{ __html: metadata.htmlContent }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add User to {company.name}</DialogTitle>
            <DialogDescription>Create a new user for this company.</DialogDescription>
          </DialogHeader>
          <Form {...createUserForm}>
            <form onSubmit={createUserForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={createUserForm.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">First Name</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} className="h-9" data-testid="input-create-firstName" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createUserForm.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Last Name</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} className="h-9" data-testid="input-create-lastName" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={createUserForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Email</FormLabel>
                  <FormControl><Input {...field} type="email" className="h-9" data-testid="input-create-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createUserForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Phone Number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} type="tel" placeholder="(415) 555-2671" className="h-9" onChange={(e) => { const formatted = formatPhoneInput(e.target.value); field.onChange(formatted); }} data-testid="input-create-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={createUserForm.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Date of Birth</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} type="date" className="h-9" data-testid="input-create-dateOfBirth" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createUserForm.control} name="preferredLanguage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Language</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-9" data-testid="select-create-language"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={createUserForm.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Office Address (Optional)</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} placeholder="123 Main St, City, State" className="h-9" data-testid="input-create-address" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createUserForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-9" data-testid="select-create-role"><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <input type="hidden" {...createUserForm.register("companyId")} value={companyId || ""} />
              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={createUserMutation.isPending} data-testid="button-create-user-submit">
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign Plan Dialog */}
      <Dialog open={assignPlanOpen} onOpenChange={setAssignPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Plan</DialogTitle>
            <DialogDescription>Select a subscription plan for this company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger data-testid="select-plan"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
              <SelectContent>
                {plansData?.plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.name} - ${(plan.price / 100).toFixed(2)}/{plan.billingCycle}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignPlanOpen(false)}>Cancel</Button>
              <Button onClick={() => selectedPlanId && assignPlanMutation.mutate(selectedPlanId)} disabled={!selectedPlanId || assignPlanMutation.isPending} data-testid="button-confirm-assign-plan">
                {assignPlanMutation.isPending ? "Assigning..." : "Assign Plan"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Feature Dialog */}
      <Dialog open={assignFeatureOpen} onOpenChange={setAssignFeatureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Feature</DialogTitle>
            <DialogDescription>Select a feature to enable for this company.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedFeatureId} onValueChange={setSelectedFeatureId}>
              <SelectTrigger data-testid="select-feature"><SelectValue placeholder="Choose a feature" /></SelectTrigger>
              <SelectContent>
                {availableFeaturesToAssign.map((feature) => (
                  <SelectItem key={feature.id} value={feature.id}>{feature.name} ({feature.key})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignFeatureOpen(false)}>Cancel</Button>
              <Button onClick={() => selectedFeatureId && assignFeatureMutation.mutate(selectedFeatureId)} disabled={!selectedFeatureId || assignFeatureMutation.isPending} data-testid="button-confirm-assign-feature">
                {assignFeatureMutation.isPending ? "Assigning..." : "Assign Feature"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
