import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Building2, Bell, Shield, Mail, Pencil, Phone as PhoneIcon, AtSign, Briefcase, MapPin, Globe } from "lucide-react";
import type { User, CompanySettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmailTemplatesManager } from "@/components/email-templates-manager";
import { formatPhoneDisplay, formatPhoneE164, formatPhoneInput } from "@/lib/phone-formatter";

export default function Settings() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: preferencesData, isLoading: isLoadingPreferences } = useQuery<{ preferences: any }>({
    queryKey: ["/api/settings/preferences"],
  });

  const { data: companySettingsData, isLoading: isLoadingCompanySettings } = useQuery<{ settings: CompanySettings }>({
    queryKey: ["/api/settings/company"],
    enabled: userData?.user?.role === "admin" || userData?.user?.role === "superadmin",
  });

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery<{ subscription: any }>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: plansData, isLoading: isLoadingPlans } = useQuery<{ plans: any[] }>({
    queryKey: ["/api/plans"],
  });

  const [emailTestAddress, setEmailTestAddress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const user = userData?.user;

  // Fetch company data if user has a companyId
  const { data: companyData, isLoading: isLoadingCompany } = useQuery<{ company: any }>({
    queryKey: ["/api/companies", user?.companyId],
    enabled: !!user?.companyId,
  });
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Check if critical data is still loading
  const isLoadingCriticalData = isLoadingUser || isLoadingPreferences || isLoadingSubscription || isLoadingPlans || (user?.companyId && isLoadingCompany);

  // Get current plan name
  const getCurrentPlanName = () => {
    if (!subscriptionData?.subscription) return "Free";
    const subscription = subscriptionData.subscription;
    
    // If subscription has plan object
    if (subscription.plan?.name) {
      return subscription.plan.name;
    }
    
    // Otherwise find plan by ID
    if (subscription.planId && plansData?.plans) {
      const plan = plansData.plans.find((p: any) => p.id === subscription.planId);
      return plan?.name || "Free";
    }
    
    return "Free";
  };

  // Determine active tab from URL
  const getCurrentTab = () => {
    if (location === "/settings" || location === "/settings/profile") return "profile";
    if (location === "/settings/preferences") return "preferences";
    if (location === "/settings/company") return "company";
    if (location === "/settings/system") return "system";
    if (location === "/settings/security") return "security";
    return "profile"; // default
  };

  const activeTab = getCurrentTab();

  // Profile form state (personal information only)
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    preferredLanguage: "",
  });

  // Insurance profile form state (separate from personal info)
  const [insuranceForm, setInsuranceForm] = useState({
    agentInternalCode: "",
    instructionLevel: "",
    nationalProducerNumber: "",
    federallyFacilitatedMarketplace: "",
    referredBy: "",
  });

  // Update forms when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone ? formatPhoneDisplay(user.phone) : "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
        preferredLanguage: user.preferredLanguage || "en",
      });
      setInsuranceForm({
        agentInternalCode: (user as any).agentInternalCode || "",
        instructionLevel: (user as any).instructionLevel || "",
        nationalProducerNumber: (user as any).nationalProducerNumber || "",
        federallyFacilitatedMarketplace: (user as any).federallyFacilitatedMarketplace || "",
        referredBy: (user as any).referredBy || "",
      });
    }
  }, [user]);

  // Update profile info mutation (personal information)
  const updateProfileInfoMutation = useMutation({
    mutationFn: async (data: { 
      firstName?: string; 
      lastName?: string; 
      email?: string; 
      phone?: string; 
      dateOfBirth?: string; 
      preferredLanguage?: string;
    }) => {
      // Convert phone to E.164 format and dateOfBirth to ISO string
      const dataToSend: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ? formatPhoneE164(data.phone) : data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : data.dateOfBirth,
        preferredLanguage: data.preferredLanguage,
      };
      
      return apiRequest("PATCH", "/api/settings/profile", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile information.",
        variant: "destructive",
      });
    },
  });

  // Update insurance profile mutation
  const updateInsuranceProfileMutation = useMutation({
    mutationFn: async (data: { 
      agentInternalCode?: string;
      instructionLevel?: string;
      nationalProducerNumber?: string;
      federallyFacilitatedMarketplace?: string;
      referredBy?: string;
    }) => {
      // Send all insurance profile fields (including empty strings)
      return apiRequest("PATCH", "/api/settings/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Insurance Profile Updated",
        description: "Your insurance profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update insurance profile.",
        variant: "destructive",
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/settings/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved.",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/email/send-test", { to: email });
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Check your inbox.",
      });
      setEmailTestAddress("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test email. Check SMTP configuration.",
        variant: "destructive",
      });
    },
  });

  // Handler for Profile Information form
  const handleProfileInfoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateProfileInfoMutation.mutate(profileForm);
  };

  // Handler for Insurance Profile Information form
  const handleInsuranceProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateInsuranceProfileMutation.mutate(insuranceForm);
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailTestAddress) {
      sendTestEmailMutation.mutate(emailTestAddress);
    }
  };

  // Update avatar mutation
  const updateAvatarMutation = useMutation({
    mutationFn: async (avatar: string) => {
      const response = await apiRequest("PATCH", "/api/settings/profile", { avatar });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile picture",
      });
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
      });
      return;
    }

    // Validate size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    // Read file and convert to data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      updateAvatarMutation.mutate(result);
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read image file",
      });
    };
    reader.readAsDataURL(file);
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    const firstInitial = user.firstName?.[0] || "";
    const lastInitial = user.lastName?.[0] || "";
    return (firstInitial + lastInitial).toUpperCase() || "U";
  };

  // Get role display text
  const getRoleDisplay = () => {
    if (!user?.role) return "User";
    const roleMap: { [key: string]: string } = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      user: "User",
    };
    return roleMap[user.role] || user.role;
  };

  // Get status display text
  const getStatusDisplay = () => {
    if (!user?.status) return "Unknown";
    const statusMap: { [key: string]: string } = {
      active: "Active",
      pending_activation: "Pending Activation",
      deactivated: "Deactivated",
    };
    return statusMap[user.status] || user.status;
  };

  // Get status color
  const getStatusColor = () => {
    if (!user?.status) return "text-gray-600 dark:text-gray-400";
    const colorMap: { [key: string]: string } = {
      active: "text-green-600 dark:text-green-400",
      pending_activation: "text-yellow-600 dark:text-yellow-400",
      deactivated: "text-red-600 dark:text-red-400",
    };
    return colorMap[user.status] || "text-gray-600 dark:text-gray-400";
  };

  // Show skeleton loader while critical data is loading
  if (isLoadingCriticalData) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Profile Card Skeleton */}
          <div className="lg:col-span-4 xl:col-span-3">
            <Card className="sticky top-6">
              <CardHeader className="text-center pb-4">
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="text-center w-full space-y-2">
                    <Skeleton className="h-6 w-32 mx-auto" />
                    <Skeleton className="h-5 w-24 mx-auto" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 border-t">
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-4 w-4 mt-1" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Settings Tabs Skeleton */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="space-y-6">
              <Skeleton className="h-10 w-full" />
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className="sticky top-6">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Top Section - Avatar and Name */}
                <div className="flex gap-4 items-start">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div 
                      className="relative group cursor-pointer"
                      onClick={handleAvatarClick}
                      data-testid="button-change-avatar"
                    >
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={user?.avatar || ""} alt={user?.firstName || ""} />
                        <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
                      </Avatar>
                      {/* Overlay with pencil icon that appears on hover */}
                      <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="h-6 w-6 text-white" />
                      </div>
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>

                  {/* Name, Email, Phone, and Role */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold mb-2">
                      {user?.firstName} {user?.lastName}
                    </h2>

                    {/* Email and Phone - Compact */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm truncate">{user?.email}</p>
                      </div>

                      {user?.phone && (
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm">{formatPhoneDisplay(user.phone)}</p>
                        </div>
                      )}
                    </div>

                    {/* Role Badge */}
                    <Badge variant="secondary" className="mt-3">
                      {getRoleDisplay()}
                    </Badge>
                  </div>
                </div>

                {/* Business Profile and Status Section */}
                <div className="space-y-4">
                  {/* Business Profile Section */}
                  {(user?.companyId || companyData?.company?.phone || companyData?.company?.website || companyData?.company?.address) && (
                    <div className="pt-6 border-t">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Business Profile</h3>
                      <div className="space-y-3">
                        {/* Company */}
                        {user?.companyId && (
                          <div className="flex items-start gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Company</p>
                              <p className="text-sm font-medium">{companyData?.company?.name || user.companyId}</p>
                            </div>
                          </div>
                        )}

                        {/* Company Phone */}
                        {companyData?.company?.phone && (
                          <div className="flex items-start gap-3">
                            <PhoneIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Phone</p>
                              <p className="text-sm font-medium">{formatPhoneDisplay(companyData.company.phone)}</p>
                            </div>
                          </div>
                        )}

                        {/* Website */}
                        {companyData?.company?.website && (
                          <div className="flex items-start gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Website</p>
                              <a 
                                href={companyData.company.website.startsWith('http') ? companyData.company.website : `https://${companyData.company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary hover:underline truncate block"
                                data-testid="link-company-website"
                              >
                                {companyData.company.website}
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Address */}
                        {companyData?.company?.address && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Address</p>
                              <div className="text-sm font-medium space-y-0.5">
                                <p>{companyData.company.address}</p>
                                {companyData.company.addressLine2 && (
                                  <p>{companyData.company.addressLine2}</p>
                                )}
                                <p>
                                  {companyData.company.city}
                                  {companyData.company.state && `, ${companyData.company.state}`}
                                  {companyData.company.postalCode && ` ${companyData.company.postalCode}`}
                                </p>
                                {companyData.company.country && (
                                  <p>{companyData.company.country}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status and Plan */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className={`text-sm font-semibold ${getStatusColor()}`}>{getStatusDisplay()}</p>
                      </div>
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="text-sm font-semibold">{getCurrentPlanName()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings Tabs */}
        <div className="lg:col-span-8 xl:col-span-9">
          <Tabs value={activeTab} onValueChange={(value) => setLocation(`/settings/${value}`)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 lg:w-auto">
              <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
                <UserIcon className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2" data-testid="tab-preferences">
                <Bell className="h-4 w-4" />
                Preferences
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="company" className="gap-2" data-testid="tab-company">
                  <Building2 className="h-4 w-4" />
                  Company
                </TabsTrigger>
              )}
              {isSuperAdmin && (
                <TabsTrigger value="system" className="gap-2" data-testid="tab-system">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Profile Information Card */}
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                    <div className="space-y-1.5">
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>
                        Update your personal information and contact details.
                      </CardDescription>
                    </div>
                    <Button
                      type="submit"
                      form="profile-info-form"
                      disabled={updateProfileInfoMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileInfoMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <form id="profile-info-form" onSubmit={handleProfileInfoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                          data-testid="input-firstname"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                          data-testid="input-lastname"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          data-testid="input-email-settings"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+1 (415) 555-2671"
                          value={profileForm.phone || ""}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            setProfileForm({ ...profileForm, phone: formatted });
                          }}
                          data-testid="input-phone-settings"
                        />
                        <p className="text-xs text-muted-foreground">Format: +1 (415) 555-2671. Required for SMS two-factor authentication</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          name="dateOfBirth"
                          type="date"
                          value={profileForm.dateOfBirth}
                          onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                          data-testid="input-date-of-birth"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preferredLanguage">Preferred Language</Label>
                        <select
                          id="preferredLanguage"
                          name="preferredLanguage"
                          value={profileForm.preferredLanguage}
                          onChange={(e) => setProfileForm({ ...profileForm, preferredLanguage: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-preferred-language"
                        >
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          name="company"
                          value={companyData?.company?.name || ""}
                          disabled
                          className="bg-muted"
                          data-testid="input-company"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Input
                          id="role"
                          name="role"
                          value={getRoleDisplay()}
                          disabled
                          className="bg-muted"
                          data-testid="input-role"
                        />
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Insurance Profile Information Card */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="space-y-1.5">
                    <CardTitle>Insurance Profile Information</CardTitle>
                    <CardDescription>
                      This is a code assigned by your agency
                    </CardDescription>
                  </div>
                  <Button
                    type="submit"
                    form="insurance-profile-form"
                    disabled={updateInsuranceProfileMutation.isPending}
                    data-testid="button-save-insurance"
                  >
                    {updateInsuranceProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </CardHeader>
                <CardContent>
                  <form id="insurance-profile-form" onSubmit={handleInsuranceProfileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="agentInternalCode">
                          Agent internal code
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-2 text-muted-foreground cursor-help">ⓘ</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This is a code assigned by your agency</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <Input
                          id="agentInternalCode"
                          name="agentInternalCode"
                          placeholder="Enter an internal code"
                          value={insuranceForm.agentInternalCode || ""}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, agentInternalCode: e.target.value })}
                          data-testid="input-agent-internal-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="instructionLevel">Instruction level</Label>
                        <select
                          id="instructionLevel"
                          name="instructionLevel"
                          value={insuranceForm.instructionLevel || ""}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, instructionLevel: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-instruction-level"
                        >
                          <option value="">Select instruction level</option>
                          <option value="Licensed insurance agent">Licensed insurance agent</option>
                          <option value="Broker">Broker</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nationalProducerNumber">National Producer Number (NPN)</Label>
                        <Input
                          id="nationalProducerNumber"
                          name="nationalProducerNumber"
                          type="text"
                          placeholder="17925766"
                          value={insuranceForm.nationalProducerNumber || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                              setInsuranceForm({ ...insuranceForm, nationalProducerNumber: value });
                            }
                          }}
                          maxLength={10}
                          data-testid="input-national-producer-number"
                        />
                        <p className="text-xs text-muted-foreground">6-10 digits only</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="federallyFacilitatedMarketplace">Federally Facilitated Marketplace (FFM)</Label>
                        <Input
                          id="federallyFacilitatedMarketplace"
                          name="federallyFacilitatedMarketplace"
                          placeholder="Enter an FFM"
                          value={insuranceForm.federallyFacilitatedMarketplace || ""}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, federallyFacilitatedMarketplace: e.target.value })}
                          data-testid="input-ffm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="referredBy">Referred by</Label>
                      <Input
                        id="referredBy"
                        name="referredBy"
                        placeholder="Enter a referred"
                        value={insuranceForm.referredBy || ""}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, referredBy: e.target.value })}
                        data-testid="input-referred-by"
                      />
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose which notifications you want to receive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications" className="text-base">
                        Email Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email updates about your account activity.
                      </p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={preferencesData?.preferences?.emailNotifications ?? true}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          emailNotifications: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-email-notifications"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="marketingEmails" className="text-base">
                        Marketing Emails
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive emails about new features and updates.
                      </p>
                    </div>
                    <Switch
                      id="marketingEmails"
                      checked={preferencesData?.preferences?.marketingEmails || false}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          marketingEmails: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-marketing-emails"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="invoiceAlerts" className="text-base">
                        Invoice Alerts
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications when new invoices are generated.
                      </p>
                    </div>
                    <Switch
                      id="invoiceAlerts"
                      checked={preferencesData?.preferences?.invoiceAlerts ?? true}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          invoiceAlerts: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-invoice-alerts"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Company Settings Tab */}
            {isAdmin && (
              <TabsContent value="company" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Company Settings</CardTitle>
                    <CardDescription>
                      Manage your company settings and preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Company Name</Label>
                      <Input
                        value={companySettingsData?.settings?.companyId || ""}
                        disabled
                        className="bg-muted"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="primaryColor">Primary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primaryColor"
                            type="color"
                            defaultValue={companySettingsData?.settings?.primaryColor || "#2196F3"}
                            className="h-10 w-20"
                            data-testid="input-primary-color"
                          />
                          <Input
                            defaultValue={companySettingsData?.settings?.primaryColor || "#2196F3"}
                            className="flex-1"
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secondaryColor">Secondary Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="secondaryColor"
                            type="color"
                            defaultValue={companySettingsData?.settings?.secondaryColor || "#1976D2"}
                            className="h-10 w-20"
                            data-testid="input-secondary-color"
                          />
                          <Input
                            defaultValue={companySettingsData?.settings?.secondaryColor || "#1976D2"}
                            className="flex-1"
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                    <Button data-testid="button-save-company">Save Settings</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* System Settings Tab (Superadmin only) */}
            {isSuperAdmin && (
              <TabsContent value="system" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Email and SMTP Configuration</CardTitle>
                      <CardDescription>
                        Configure system email notification settings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <div className="p-4 border border-border rounded-md bg-muted/50">
                          <h4 className="text-sm font-medium mb-2">SMTP Status</h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            SMTP credentials are configured via environment variables.
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SMTP Host:</span>
                              <span className="font-mono">Configured</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SMTP Port:</span>
                              <span className="font-mono">Configured</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Sender Email:</span>
                              <span className="font-mono">Configured</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="testEmail">Test Email Configuration</Label>
                          <p className="text-sm text-muted-foreground mb-2">
                            Send a test email to verify your SMTP configuration works.
                          </p>
                          <form onSubmit={handleSendTestEmail} className="flex gap-2">
                            <Input
                              id="testEmail"
                              type="email"
                              placeholder="test@example.com"
                              value={emailTestAddress}
                              onChange={(e) => setEmailTestAddress(e.target.value)}
                              data-testid="input-test-email"
                              required
                            />
                            <Button
                              type="submit"
                              disabled={sendTestEmailMutation.isPending}
                              data-testid="button-send-test-email"
                            >
                              {sendTestEmailMutation.isPending ? "Sending..." : "Send Test"}
                            </Button>
                          </form>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>System Notifications</CardTitle>
                      <CardDescription>
                        Configure system notification behavior.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="systemNotifications" className="text-base">
                            Enable System Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Send automatic notifications for system events.
                          </p>
                        </div>
                        <Switch
                          id="systemNotifications"
                          checked={preferencesData?.preferences?.systemNotifications ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              ...preferencesData?.preferences,
                              systemNotifications: checked,
                            });
                          }}
                          disabled={updatePreferencesMutation.isPending}
                          data-testid="switch-system-notifications"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="batchNotifications" className="text-base">
                            Batch Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Group multiple notifications into summary emails.
                          </p>
                        </div>
                        <Switch
                          id="batchNotifications"
                          checked={preferencesData?.preferences?.batchNotifications ?? false}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              ...preferencesData?.preferences,
                              batchNotifications: checked,
                            });
                          }}
                          disabled={updatePreferencesMutation.isPending}
                          data-testid="switch-batch-notifications"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <EmailTemplatesManager />
              </TabsContent>
            )}

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        data-testid="input-current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        data-testid="input-new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        data-testid="input-confirm-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="destructive"
                      data-testid="button-change-password"
                    >
                      Change Password
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an additional layer of security to your account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">SMS Two-Factor</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive verification codes via SMS.
                      </p>
                    </div>
                    <Switch data-testid="switch-2fa" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requires a valid phone number in your profile.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage your active sessions and connected devices.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-md">
                      <div>
                        <p className="font-medium">Current Session</p>
                        <p className="text-sm text-muted-foreground">This device</p>
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-logout-current">
                        Log Out
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
