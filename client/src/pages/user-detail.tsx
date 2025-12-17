import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, User as UserIcon, MapPin, Building2, Bell, Loader2, Briefcase } from "lucide-react";
import { formatForDisplay, formatE164, formatPhoneInput } from "@shared/phone";
import type { Company, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LoadingSpinner } from "@/components/loading-spinner";

// Validation schemas for each form section
const personalInfoSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  avatar: z.union([
    z.string().url("Please enter a valid URL"),
    z.string().regex(/^data:image\/(png|jpg|jpeg|gif|webp);base64,/, "Avatar must be a valid URL or base64 image"),
    z.literal(""),
    z.null()
  ]).optional(),
});

const contactInfoSchema = z.object({
  phone: z.string().optional().or(z.literal("")),
  timezone: z.string().optional(),
  preferredLanguage: z.string().optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
});

const accountDetailsSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]).optional(),
});

const notificationPreferencesSchema = z.object({
  emailSubscribed: z.boolean().optional(),
  smsSubscribed: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  invoiceAlerts: z.boolean().optional(),
});

const insuranceProfileSchema = z.object({
  agentInternalCode: z.string().optional(),
  instructionLevel: z.string().optional(),
  nationalProducerNumber: z.string().optional(),
  federallyFacilitatedMarketplace: z.string().optional(),
  referredBy: z.string().optional(),
});

export default function UserDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = params.id;

  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
  });

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const currentUser = sessionData?.user;
  const isSuperAdmin = currentUser?.role === "superadmin";

  // Gate companies query to only run for superadmin users
  const { data: companiesData } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
    enabled: isSuperAdmin,
  });

  const user = userData?.user;
  const companies = companiesData?.companies || [];
  const isViewingOwnProfile = currentUser?.id === userId;

  // Initialize forms with react-hook-form
  const personalForm = useForm({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      avatar: "",
    },
  });

  const contactForm = useForm({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: {
      phone: "",
      timezone: "",
      preferredLanguage: "",
      dateOfBirth: "",
    },
  });

  const accountForm = useForm({
    resolver: zodResolver(accountDetailsSchema),
    defaultValues: {
      role: "member" as "admin" | "member" | "viewer",
    },
  });

  const notificationForm = useForm({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      emailSubscribed: true,
      smsSubscribed: true,
      emailNotifications: true,
      invoiceAlerts: true,
    },
  });

  const insuranceProfileForm = useForm({
    resolver: zodResolver(insuranceProfileSchema),
    defaultValues: {
      agentInternalCode: "",
      instructionLevel: "",
      nationalProducerNumber: "",
      federallyFacilitatedMarketplace: "",
      referredBy: "",
    },
  });

  // Update forms when user data changes - using useEffect to prevent infinite re-renders
  useEffect(() => {
    if (user) {
      personalForm.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        avatar: user.avatar || "",
      });

      contactForm.reset({
        phone: user.phone ? formatForDisplay(user.phone) : "",
        timezone: user.timezone || "",
        preferredLanguage: user.preferredLanguage || "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
      });

      accountForm.reset({
        role: (user.role === "admin" || user.role === "member" || user.role === "viewer") ? user.role : "member",
      });

      notificationForm.reset({
        emailSubscribed: user.emailSubscribed ?? true,
        smsSubscribed: user.smsSubscribed ?? true,
        emailNotifications: user.emailNotifications ?? true,
        invoiceAlerts: user.invoiceAlerts ?? true,
      });

      insuranceProfileForm.reset({
        agentInternalCode: (user as any).agentInternalCode || "",
        instructionLevel: (user as any).instructionLevel || "",
        nationalProducerNumber: (user as any).nationalProducerNumber || "",
        federallyFacilitatedMarketplace: (user as any).federallyFacilitatedMarketplace || "",
        referredBy: (user as any).referredBy || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Update Personal Information Mutation
  const updatePersonalMutation = useMutation({
    mutationFn: async (data: z.infer<typeof personalInfoSchema>) => {
      return apiRequest("PATCH", `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Personal Information Updated",
        description: "Personal information has been updated successfully",
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

  // Update Contact & Location Mutation
  const updateContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof contactInfoSchema>) => {
      const phoneE164 = data.phone ? formatE164(data.phone) : "";
      return apiRequest("PATCH", `/api/users/${userId}`, { 
        ...data, 
        phone: phoneE164,
        dateOfBirth: data.dateOfBirth || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Contact Information Updated",
        description: "Contact information has been updated successfully",
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

  // Update Account Details Mutation
  const updateAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountDetailsSchema>) => {
      return apiRequest("PATCH", `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Account Details Updated",
        description: "Account details have been updated successfully",
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

  // Update Notification Preferences Mutation
  const updateNotificationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof notificationPreferencesSchema>) => {
      return apiRequest("PATCH", `/api/users/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Notification Preferences Updated",
        description: "Notification preferences have been updated successfully",
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

  // Update Insurance Profile Mutation
  const updateInsuranceProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insuranceProfileSchema>) => {
      // Only send fields that have actual values (not empty strings)
      const dataToSend: any = {};
      if (data.agentInternalCode !== undefined && data.agentInternalCode !== "") {
        dataToSend.agentInternalCode = data.agentInternalCode;
      }
      if (data.instructionLevel !== undefined && data.instructionLevel !== "") {
        dataToSend.instructionLevel = data.instructionLevel;
      }
      if (data.nationalProducerNumber !== undefined && data.nationalProducerNumber !== "") {
        dataToSend.nationalProducerNumber = data.nationalProducerNumber;
      }
      if (data.federallyFacilitatedMarketplace !== undefined && data.federallyFacilitatedMarketplace !== "") {
        dataToSend.federallyFacilitatedMarketplace = data.federallyFacilitatedMarketplace;
      }
      if (data.referredBy !== undefined && data.referredBy !== "") {
        dataToSend.referredBy = data.referredBy;
      }
      
      // Ensure at least one field has a value
      if (Object.keys(dataToSend).length === 0) {
        throw new Error("Please fill in at least one field before saving");
      }
      
      return apiRequest("PATCH", `/api/users/${userId}`, dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Insurance Profile Updated",
        description: "Insurance profile has been updated successfully",
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

  // Check if any mutation is pending to disable all save buttons
  const isAnyMutationPending = 
    updatePersonalMutation.isPending || 
    updateContactMutation.isPending || 
    updateAccountMutation.isPending || 
    updateNotificationMutation.isPending ||
    updateInsuranceProfileMutation.isPending;

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

  const getStatusInfo = () => {
    // Gracefully handle missing company data for non-superadmin users
    const userCompany = user?.companyId && isSuperAdmin ? companies.find(c => c.id === user.companyId) : null;
    const isCompanySuspended = userCompany && !userCompany.isActive;
    const isUserInactive = user?.isActive === false;

    if (isCompanySuspended) {
      return {
        label: "Suspended",
        variant: "destructive" as const,
        description: "Company is inactive"
      };
    } else if (isUserInactive) {
      return {
        label: "Inactive",
        variant: "outline" as const,
        description: "User is inactive"
      };
    } else {
      return {
        label: "Active",
        variant: "default" as const,
        description: "User is active"
      };
    }
  };

  if (isLoadingUser) {
    return <LoadingSpinner message="Loading user..." />;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-2xl font-bold">User Not Found</h2>
        <Button onClick={() => setLocation("/users")} data-testid="button-back-to-users">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  const roleBadge = getRoleBadge(user.role);
  const statusInfo = getStatusInfo();
  const userCompany = user.companyId && isSuperAdmin ? companies.find(c => c.id === user.companyId) : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/users")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarImage src={user.avatar || undefined} />
          <AvatarFallback className="text-lg">
            {user.firstName && user.lastName
              ? `${user.firstName[0]}${user.lastName[0]}`
              : user.email[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={roleBadge.className} data-testid="badge-role">
            {roleBadge.label}
          </Badge>
          <Badge variant={statusInfo.variant} data-testid="badge-status">
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your personal details and profile picture
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...personalForm}>
              <form onSubmit={personalForm.handleSubmit((data) => updatePersonalMutation.mutate(data))} className="space-y-4">
                <div className="flex justify-center pb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={personalForm.watch("avatar") || undefined} />
                    <AvatarFallback className="text-2xl">
                      {personalForm.watch("firstName") && personalForm.watch("lastName")
                        ? `${personalForm.watch("firstName")[0]}${personalForm.watch("lastName")[0]}`
                        : user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <FormField
                  control={personalForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-firstName"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={personalForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          data-testid="input-lastName"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={personalForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={isAnyMutationPending}
                  data-testid="button-save-personal"
                >
                  {updatePersonalMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Contact & Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Contact & Location
            </CardTitle>
            <CardDescription>
              Manage your contact details and location preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...contactForm}>
              <form onSubmit={contactForm.handleSubmit((data) => updateContactMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="(415) 555-2671"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            field.onChange(formatted);
                          }}
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select 
                        value={field.value || ""} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">America - USA</div>
                          <SelectItem value="America/New_York">(UTC-05:00) EST, New York, Toronto</SelectItem>
                          <SelectItem value="America/Chicago">(UTC-06:00) CST, Chicago, Mexico City</SelectItem>
                          <SelectItem value="America/Denver">(UTC-07:00) MST, Denver, Phoenix</SelectItem>
                          <SelectItem value="America/Los_Angeles">(UTC-08:00) PST, Los Angeles, Vancouver</SelectItem>
                          <SelectItem value="America/Anchorage">(UTC-09:00) AKST, Anchorage</SelectItem>
                          <SelectItem value="Pacific/Honolulu">(UTC-10:00) HST, Honolulu</SelectItem>
                          
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Europe</div>
                          <SelectItem value="Europe/London">(UTC+00:00) GMT, London, Dublin</SelectItem>
                          <SelectItem value="Europe/Paris">(UTC+01:00) CET, Paris, Madrid, Berlin</SelectItem>
                          <SelectItem value="Europe/Istanbul">(UTC+02:00) EET, Istanbul, Athens</SelectItem>
                          
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Asia</div>
                          <SelectItem value="Asia/Tokyo">(UTC+09:00) JST, Tokyo, Osaka</SelectItem>
                          <SelectItem value="Asia/Shanghai">(UTC+08:00) CST, Shanghai, Beijing</SelectItem>
                          <SelectItem value="Asia/Kolkata">(UTC+05:30) IST, Kolkata, Mumbai</SelectItem>
                          
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">UTC</div>
                          <SelectItem value="UTC">(UTC+00:00) UTC, Greenwich</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="preferredLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Language</FormLabel>
                      <Select 
                        value={field.value || ""} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-dateOfBirth"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={isAnyMutationPending}
                  data-testid="button-save-contact"
                >
                  {updateContactMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Account Details
            </CardTitle>
            <CardDescription>
              View and manage account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
                {isViewingOwnProfile || user.role === "superadmin" ? (
                  <Input
                    value={roleBadge.label}
                    disabled
                    className="bg-muted"
                    data-testid="input-role-disabled"
                  />
                ) : (
                  <Form {...accountForm}>
                    <form onSubmit={accountForm.handleSubmit((data) => updateAccountMutation.mutate(data))}>
                      <div className="space-y-4">
                        <FormField
                          control={accountForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <Select 
                                value={field.value || ""} 
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-role">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          disabled={isAnyMutationPending}
                          data-testid="button-save-role"
                        >
                          {updateAccountMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </div>
              {isSuperAdmin && user.companyId && userCompany && (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setLocation(`/companies/${userCompany.id}`)}
                    data-testid="button-view-company"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {userCompany.name}
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <Label>Account Status</Label>
                <div className="flex items-center gap-2">
                  <Badge variant={statusInfo.variant} data-testid="text-account-status">
                    {statusInfo.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{statusInfo.description}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Created At</Label>
                <p className="text-sm" data-testid="text-created-at">
                  {new Date(user.createdAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Manage how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...notificationForm}>
              <form onSubmit={notificationForm.handleSubmit((data) => updateNotificationMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={notificationForm.control}
                  name="emailSubscribed"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Email Subscriptions
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Receive marketing and promotional emails
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-emailSubscribed"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={notificationForm.control}
                  name="smsSubscribed"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          SMS Subscriptions
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Receive marketing and promotional SMS
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-smsSubscribed"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={notificationForm.control}
                  name="emailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Email Notifications
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Receive email notifications about your account
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-emailNotifications"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={notificationForm.control}
                  name="invoiceAlerts"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Invoice Alerts
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Get notified about invoices and billing
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-invoiceAlerts"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={isAnyMutationPending}
                  data-testid="button-save-notifications"
                >
                  {updateNotificationMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Insurance Profile Information */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Insurance Profile Information
              </CardTitle>
              <CardDescription>
                Manage insurance industry specific information
              </CardDescription>
            </div>
            <Button
              type="submit"
              form="insurance-profile-form"
              disabled={isAnyMutationPending}
              data-testid="button-save-insurance"
            >
              {updateInsuranceProfileMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <Form {...insuranceProfileForm}>
              <form id="insurance-profile-form" onSubmit={insuranceProfileForm.handleSubmit((data) => updateInsuranceProfileMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={insuranceProfileForm.control}
                  name="agentInternalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Internal Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter an internal code"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-agentInternalCode"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={insuranceProfileForm.control}
                  name="instructionLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instruction Level</FormLabel>
                      <Select 
                        value={field.value || ""} 
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-instructionLevel">
                            <SelectValue placeholder="Select instruction level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Licensed insurance agent">Licensed insurance agent</SelectItem>
                          <SelectItem value="Broker">Broker</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={insuranceProfileForm.control}
                  name="nationalProducerNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>National Producer Number (NPN)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="17925766"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                              field.onChange(value);
                            }
                          }}
                          maxLength={10}
                          data-testid="input-nationalProducerNumber"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">6-10 digits only</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={insuranceProfileForm.control}
                  name="federallyFacilitatedMarketplace"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Federally Facilitated Marketplace (FFM)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter an FFM"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-federallyFacilitatedMarketplace"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={insuranceProfileForm.control}
                  name="referredBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referred By</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter a referred"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-referredBy"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
