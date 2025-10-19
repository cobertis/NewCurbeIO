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
  
  // Company Information refs
  const companyNameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const businessCategoryRef = useRef<HTMLSelectElement>(null);
  const businessNicheRef = useRef<HTMLSelectElement>(null);
  const companyEmailRef = useRef<HTMLInputElement>(null);
  const companyPhoneRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const companySizeRef = useRef<HTMLSelectElement>(null);
  const timezoneRef = useRef<HTMLInputElement>(null);
  const currencyRef = useRef<HTMLInputElement>(null);
  const platformLanguageRef = useRef<HTMLInputElement>(null);
  
  // Physical Address refs
  const addressRef = useRef<HTMLInputElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const postalCodeRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  
  // Authorized Representative refs
  const representativeFirstNameRef = useRef<HTMLInputElement>(null);
  const representativeLastNameRef = useRef<HTMLInputElement>(null);
  const representativeEmailRef = useRef<HTMLInputElement>(null);
  const representativePhoneRef = useRef<HTMLInputElement>(null);
  const representativePositionRef = useRef<HTMLInputElement>(null);
  
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
      // Only send fields that have actual values
      const dataToSend: any = {};
      
      if (data.firstName && data.firstName !== "") {
        dataToSend.firstName = data.firstName;
      }
      if (data.lastName && data.lastName !== "") {
        dataToSend.lastName = data.lastName;
      }
      if (data.email && data.email !== "") {
        dataToSend.email = data.email;
      }
      if (data.phone && data.phone !== "") {
        dataToSend.phone = formatPhoneE164(data.phone);
      }
      if (data.dateOfBirth && data.dateOfBirth !== "") {
        dataToSend.dateOfBirth = new Date(data.dateOfBirth).toISOString();
      }
      if (data.preferredLanguage && data.preferredLanguage !== "") {
        dataToSend.preferredLanguage = data.preferredLanguage;
      }
      
      // Ensure at least one field has a value
      if (Object.keys(dataToSend).length === 0) {
        throw new Error("Please fill in at least one field before saving");
      }
      
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
      
      return apiRequest("PATCH", "/api/settings/profile", dataToSend);
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

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user?.companyId) {
        throw new Error("No company ID found");
      }
      return apiRequest("PATCH", `/api/companies/${user.companyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", user?.companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Company Updated",
        description: "Company information has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update company information.",
        variant: "destructive",
      });
    },
  });

  // Handler for Company Information Save
  const handleSaveCompanyInformation = () => {
    const data: any = {};
    
    if (companyNameRef.current?.value) data.name = companyNameRef.current.value;
    if (slugRef.current?.value) data.slug = slugRef.current.value;
    if (businessCategoryRef.current?.value) data.businessCategory = businessCategoryRef.current.value;
    if (businessNicheRef.current?.value) data.businessNiche = businessNicheRef.current.value;
    if (companyEmailRef.current?.value) data.email = companyEmailRef.current.value;
    if (companyPhoneRef.current?.value) data.phone = companyPhoneRef.current.value;
    if (websiteRef.current?.value) data.website = websiteRef.current.value;
    if (companySizeRef.current?.value) data.companySize = companySizeRef.current.value;
    if (timezoneRef.current?.value) data.timezone = timezoneRef.current.value;
    if (currencyRef.current?.value) data.currency = currencyRef.current.value;
    if (platformLanguageRef.current?.value) data.platformLanguage = platformLanguageRef.current.value;
    
    updateCompanyMutation.mutate(data);
  };

  // Handler for Physical Address Save
  const handleSavePhysicalAddress = () => {
    const data: any = {};
    
    if (addressRef.current?.value) data.address = addressRef.current.value;
    if (addressLine2Ref.current?.value) data.addressLine2 = addressLine2Ref.current.value;
    if (cityRef.current?.value) data.city = cityRef.current.value;
    if (stateRef.current?.value) data.state = stateRef.current.value;
    if (postalCodeRef.current?.value) data.postalCode = postalCodeRef.current.value;
    if (countryRef.current?.value) data.country = countryRef.current.value;
    
    updateCompanyMutation.mutate(data);
  };

  // Handler for Authorized Representative Save
  const handleSaveAuthorizedRepresentative = () => {
    const data: any = {};
    
    if (representativeFirstNameRef.current?.value) data.representativeFirstName = representativeFirstNameRef.current.value;
    if (representativeLastNameRef.current?.value) data.representativeLastName = representativeLastNameRef.current.value;
    if (representativeEmailRef.current?.value) data.representativeEmail = representativeEmailRef.current.value;
    if (representativePhoneRef.current?.value) data.representativePhone = representativePhoneRef.current.value;
    if (representativePositionRef.current?.value) data.representativePosition = representativePositionRef.current.value;
    
    updateCompanyMutation.mutate(data);
  };

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
              {isAdmin && (
                <TabsTrigger value="company" className="gap-2" data-testid="tab-company">
                  <Building2 className="h-4 w-4" />
                  Company
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2" data-testid="tab-preferences">
                <Bell className="h-4 w-4" />
                Preferences
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="system" className="gap-2" data-testid="tab-system">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              )}
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
                {/* Company Information */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Company Information</CardTitle>
                      <CardDescription>
                        Basic company details and contact information
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSaveCompanyInformation}
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-company-information"
                    >
                      {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
                        <Input
                          id="companyName"
                          ref={companyNameRef}
                          defaultValue={companyData?.company?.name || ""}
                          data-testid="input-company-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">Company Slug</Label>
                        <Input
                          id="slug"
                          ref={slugRef}
                          defaultValue={companyData?.company?.slug || ""}
                          data-testid="input-slug"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessCategory">Business Category</Label>
                        <select
                          id="businessCategory"
                          ref={businessCategoryRef}
                          defaultValue={(companyData?.company as any)?.businessCategory || ""}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-business-category"
                          onChange={(e) => {
                            const category = e.target.value;
                            const nicheSelect = businessNicheRef.current;
                            if (nicheSelect) {
                              const optgroups = nicheSelect.querySelectorAll('optgroup');
                              optgroups.forEach((optgroup) => {
                                if (!category || optgroup.label === category) {
                                  optgroup.style.display = '';
                                } else {
                                  optgroup.style.display = 'none';
                                }
                              });
                              nicheSelect.value = '';
                            }
                          }}
                        >
                          <option value="">Select a category</option>
                          <option value="Healthcare & Medical">Healthcare & Medical</option>
                          <option value="Technology & Software">Technology & Software</option>
                          <option value="Finance & Insurance">Finance & Insurance</option>
                          <option value="Education & Training">Education & Training</option>
                          <option value="Real Estate & Property">Real Estate & Property</option>
                          <option value="Retail & E-commerce">Retail & E-commerce</option>
                          <option value="Food & Beverage">Food & Beverage</option>
                          <option value="Professional Services">Professional Services</option>
                          <option value="Construction & Trades">Construction & Trades</option>
                          <option value="Manufacturing & Production">Manufacturing & Production</option>
                          <option value="Transportation & Logistics">Transportation & Logistics</option>
                          <option value="Hospitality & Tourism">Hospitality & Tourism</option>
                          <option value="Entertainment & Media">Entertainment & Media</option>
                          <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                          <option value="Fitness & Wellness">Fitness & Wellness</option>
                          <option value="Legal & Compliance">Legal & Compliance</option>
                          <option value="Marketing & Advertising">Marketing & Advertising</option>
                          <option value="Human Resources & Recruiting">Human Resources & Recruiting</option>
                          <option value="Agriculture & Farming">Agriculture & Farming</option>
                          <option value="Energy & Utilities">Energy & Utilities</option>
                          <option value="Environmental & Sustainability">Environmental & Sustainability</option>
                          <option value="Non-Profit & Social Services">Non-Profit & Social Services</option>
                          <option value="Automotive & Vehicles">Automotive & Vehicles</option>
                          <option value="Home & Garden">Home & Garden</option>
                          <option value="Arts & Crafts">Arts & Crafts</option>
                          <option value="Sports & Recreation">Sports & Recreation</option>
                          <option value="Pet Care & Veterinary">Pet Care & Veterinary</option>
                          <option value="Telecommunications">Telecommunications</option>
                          <option value="Security & Safety">Security & Safety</option>
                          <option value="Events & Event Planning">Events & Event Planning</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessNiche">Business Niche</Label>
                        <select
                          id="businessNiche"
                          ref={businessNicheRef}
                          defaultValue={(companyData?.company as any)?.businessNiche || ""}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-business-niche"
                        >
                        <option value="">Select a niche</option>
                        
                        <optgroup label="Healthcare & Medical">
                          <option value="General Practice">General Practice</option>
                          <option value="Dentistry">Dentistry</option>
                          <option value="Cardiology">Cardiology</option>
                          <option value="Dermatology">Dermatology</option>
                          <option value="Pediatrics">Pediatrics</option>
                          <option value="Orthopedics">Orthopedics</option>
                          <option value="Physical Therapy">Physical Therapy</option>
                          <option value="Mental Health Counseling">Mental Health Counseling</option>
                          <option value="Chiropractic Care">Chiropractic Care</option>
                          <option value="Nursing Services">Nursing Services</option>
                          <option value="Home Healthcare">Home Healthcare</option>
                          <option value="Medical Imaging">Medical Imaging</option>
                          <option value="Laboratory Services">Laboratory Services</option>
                          <option value="Pharmacy">Pharmacy</option>
                          <option value="Optometry">Optometry</option>
                          <option value="Audiology">Audiology</option>
                          <option value="Urgent Care">Urgent Care</option>
                          <option value="Hospice Care">Hospice Care</option>
                          <option value="Alternative Medicine">Alternative Medicine</option>
                          <option value="Medical Equipment Sales">Medical Equipment Sales</option>
                        </optgroup>

                        <optgroup label="Technology & Software">
                          <option value="SaaS Development">SaaS Development</option>
                          <option value="Mobile App Development">Mobile App Development</option>
                          <option value="Web Development">Web Development</option>
                          <option value="AI & Machine Learning">AI & Machine Learning</option>
                          <option value="Cybersecurity">Cybersecurity</option>
                          <option value="Cloud Computing">Cloud Computing</option>
                          <option value="Data Analytics">Data Analytics</option>
                          <option value="IT Consulting">IT Consulting</option>
                          <option value="Software Testing">Software Testing</option>
                          <option value="DevOps Services">DevOps Services</option>
                          <option value="Blockchain Development">Blockchain Development</option>
                          <option value="Game Development">Game Development</option>
                          <option value="UI/UX Design">UI/UX Design</option>
                          <option value="API Development">API Development</option>
                          <option value="Database Management">Database Management</option>
                          <option value="Network Solutions">Network Solutions</option>
                          <option value="IoT Solutions">IoT Solutions</option>
                          <option value="AR/VR Development">AR/VR Development</option>
                          <option value="E-learning Platforms">E-learning Platforms</option>
                          <option value="CRM Systems">CRM Systems</option>
                        </optgroup>

                        <optgroup label="Finance & Insurance">
                          <option value="Life Insurance">Life Insurance</option>
                          <option value="Health Insurance">Health Insurance</option>
                          <option value="Auto Insurance">Auto Insurance</option>
                          <option value="Home Insurance">Home Insurance</option>
                          <option value="Business Insurance">Business Insurance</option>
                          <option value="Disability Insurance">Disability Insurance</option>
                          <option value="Long-term Care Insurance">Long-term Care Insurance</option>
                          <option value="Medicare/Medicaid">Medicare/Medicaid</option>
                          <option value="ACA Marketplace Plans">ACA Marketplace Plans</option>
                          <option value="Investment Banking">Investment Banking</option>
                          <option value="Wealth Management">Wealth Management</option>
                          <option value="Financial Planning">Financial Planning</option>
                          <option value="Accounting Services">Accounting Services</option>
                          <option value="Tax Preparation">Tax Preparation</option>
                          <option value="Bookkeeping">Bookkeeping</option>
                          <option value="Payroll Services">Payroll Services</option>
                          <option value="Mortgage Lending">Mortgage Lending</option>
                          <option value="Credit Unions">Credit Unions</option>
                          <option value="Payment Processing">Payment Processing</option>
                          <option value="Cryptocurrency Exchange">Cryptocurrency Exchange</option>
                        </optgroup>

                        <optgroup label="Education & Training">
                          <option value="Online Learning Platforms">Online Learning Platforms</option>
                          <option value="K-12 Education">K-12 Education</option>
                          <option value="Higher Education">Higher Education</option>
                          <option value="Vocational Training">Vocational Training</option>
                          <option value="Corporate Training">Corporate Training</option>
                          <option value="Language Learning">Language Learning</option>
                          <option value="Test Preparation">Test Preparation</option>
                          <option value="Music Education">Music Education</option>
                          <option value="Art Education">Art Education</option>
                          <option value="STEM Education">STEM Education</option>
                          <option value="Tutoring Services">Tutoring Services</option>
                          <option value="Early Childhood Education">Early Childhood Education</option>
                          <option value="Special Education">Special Education</option>
                          <option value="Continuing Education">Continuing Education</option>
                          <option value="Professional Certification">Professional Certification</option>
                        </optgroup>

                        <optgroup label="Real Estate & Property">
                          <option value="Residential Real Estate">Residential Real Estate</option>
                          <option value="Commercial Real Estate">Commercial Real Estate</option>
                          <option value="Property Management">Property Management</option>
                          <option value="Real Estate Investment">Real Estate Investment</option>
                          <option value="Real Estate Development">Real Estate Development</option>
                          <option value="Vacation Rentals">Vacation Rentals</option>
                          <option value="Property Appraisal">Property Appraisal</option>
                          <option value="Title Services">Title Services</option>
                          <option value="Home Inspection">Home Inspection</option>
                          <option value="Real Estate Photography">Real Estate Photography</option>
                          <option value="REITs">REITs</option>
                        </optgroup>

                        <optgroup label="Retail & E-commerce">
                          <option value="Online Marketplace">Online Marketplace</option>
                          <option value="Fashion & Apparel">Fashion & Apparel</option>
                          <option value="Electronics Retail">Electronics Retail</option>
                          <option value="Furniture & Home Decor">Furniture & Home Decor</option>
                          <option value="Sporting Goods">Sporting Goods</option>
                          <option value="Books & Media">Books & Media</option>
                          <option value="Toys & Games">Toys & Games</option>
                          <option value="Jewelry & Accessories">Jewelry & Accessories</option>
                          <option value="Health & Beauty Products">Health & Beauty Products</option>
                          <option value="Grocery & Food Delivery">Grocery & Food Delivery</option>
                          <option value="Subscription Boxes">Subscription Boxes</option>
                          <option value="Dropshipping">Dropshipping</option>
                          <option value="Print on Demand">Print on Demand</option>
                          <option value="Handmade & Crafts">Handmade & Crafts</option>
                        </optgroup>

                        <optgroup label="Food & Beverage">
                          <option value="Restaurant">Restaurant</option>
                          <option value="Fast Food">Fast Food</option>
                          <option value="Cafe & Coffee Shop">Cafe & Coffee Shop</option>
                          <option value="Bakery">Bakery</option>
                          <option value="Catering">Catering</option>
                          <option value="Food Truck">Food Truck</option>
                          <option value="Bar & Nightclub">Bar & Nightclub</option>
                          <option value="Brewery & Distillery">Brewery & Distillery</option>
                          <option value="Wine Production">Wine Production</option>
                          <option value="Food Manufacturing">Food Manufacturing</option>
                          <option value="Meal Prep Services">Meal Prep Services</option>
                          <option value="Ghost Kitchen">Ghost Kitchen</option>
                          <option value="Ice Cream Shop">Ice Cream Shop</option>
                          <option value="Juice Bar">Juice Bar</option>
                        </optgroup>

                        <optgroup label="Professional Services">
                          <option value="Consulting">Consulting</option>
                          <option value="Business Coaching">Business Coaching</option>
                          <option value="Life Coaching">Life Coaching</option>
                          <option value="Career Counseling">Career Counseling</option>
                          <option value="Virtual Assistant">Virtual Assistant</option>
                          <option value="Transcription Services">Transcription Services</option>
                          <option value="Translation Services">Translation Services</option>
                          <option value="Copywriting">Copywriting</option>
                          <option value="Grant Writing">Grant Writing</option>
                          <option value="Resume Writing">Resume Writing</option>
                          <option value="Business Plan Writing">Business Plan Writing</option>
                          <option value="Public Relations">Public Relations</option>
                          <option value="Event Management">Event Management</option>
                        </optgroup>

                        <optgroup label="Construction & Trades">
                          <option value="General Contracting">General Contracting</option>
                          <option value="Electrical">Electrical</option>
                          <option value="Plumbing">Plumbing</option>
                          <option value="HVAC">HVAC</option>
                          <option value="Roofing">Roofing</option>
                          <option value="Carpentry">Carpentry</option>
                          <option value="Painting">Painting</option>
                          <option value="Flooring">Flooring</option>
                          <option value="Landscaping">Landscaping</option>
                          <option value="Masonry">Masonry</option>
                          <option value="Welding">Welding</option>
                          <option value="Excavation">Excavation</option>
                          <option value="Demolition">Demolition</option>
                          <option value="Renovation">Renovation</option>
                          <option value="Pool Installation">Pool Installation</option>
                        </optgroup>

                        <optgroup label="Manufacturing & Production">
                          <option value="Electronics Manufacturing">Electronics Manufacturing</option>
                          <option value="Textile Manufacturing">Textile Manufacturing</option>
                          <option value="Automotive Parts">Automotive Parts</option>
                          <option value="Pharmaceutical Manufacturing">Pharmaceutical Manufacturing</option>
                          <option value="Chemical Manufacturing">Chemical Manufacturing</option>
                          <option value="Plastics Manufacturing">Plastics Manufacturing</option>
                          <option value="Metal Fabrication">Metal Fabrication</option>
                          <option value="3D Printing">3D Printing</option>
                          <option value="Packaging Production">Packaging Production</option>
                          <option value="Custom Manufacturing">Custom Manufacturing</option>
                        </optgroup>

                        <optgroup label="Transportation & Logistics">
                          <option value="Freight Shipping">Freight Shipping</option>
                          <option value="Last-Mile Delivery">Last-Mile Delivery</option>
                          <option value="Warehousing">Warehousing</option>
                          <option value="Supply Chain Management">Supply Chain Management</option>
                          <option value="Moving Services">Moving Services</option>
                          <option value="Courier Services">Courier Services</option>
                          <option value="Taxi & Rideshare">Taxi & Rideshare</option>
                          <option value="Truck Rental">Truck Rental</option>
                          <option value="International Shipping">International Shipping</option>
                          <option value="Cold Chain Logistics">Cold Chain Logistics</option>
                        </optgroup>

                        <optgroup label="Hospitality & Tourism">
                          <option value="Hotel">Hotel</option>
                          <option value="Motel">Motel</option>
                          <option value="Bed & Breakfast">Bed & Breakfast</option>
                          <option value="Resort">Resort</option>
                          <option value="Travel Agency">Travel Agency</option>
                          <option value="Tour Operator">Tour Operator</option>
                          <option value="Cruise Line">Cruise Line</option>
                          <option value="Event Venue">Event Venue</option>
                          <option value="Wedding Venue">Wedding Venue</option>
                          <option value="Conference Center">Conference Center</option>
                        </optgroup>

                        <optgroup label="Entertainment & Media">
                          <option value="Music Production">Music Production</option>
                          <option value="Video Production">Video Production</option>
                          <option value="Photography">Photography</option>
                          <option value="Podcasting">Podcasting</option>
                          <option value="Streaming Services">Streaming Services</option>
                          <option value="Publishing">Publishing</option>
                          <option value="News Media">News Media</option>
                          <option value="Radio Broadcasting">Radio Broadcasting</option>
                          <option value="Film Production">Film Production</option>
                          <option value="Animation Studio">Animation Studio</option>
                        </optgroup>

                        <optgroup label="Beauty & Personal Care">
                          <option value="Hair Salon">Hair Salon</option>
                          <option value="Barbershop">Barbershop</option>
                          <option value="Nail Salon">Nail Salon</option>
                          <option value="Spa Services">Spa Services</option>
                          <option value="Massage Therapy">Massage Therapy</option>
                          <option value="Skincare Services">Skincare Services</option>
                          <option value="Makeup Artist">Makeup Artist</option>
                          <option value="Cosmetics Retail">Cosmetics Retail</option>
                          <option value="Tattoo & Piercing">Tattoo & Piercing</option>
                          <option value="Tanning Salon">Tanning Salon</option>
                        </optgroup>

                        <optgroup label="Fitness & Wellness">
                          <option value="Gym & Fitness Center">Gym & Fitness Center</option>
                          <option value="Yoga Studio">Yoga Studio</option>
                          <option value="Pilates Studio">Pilates Studio</option>
                          <option value="Personal Training">Personal Training</option>
                          <option value="CrossFit">CrossFit</option>
                          <option value="Martial Arts">Martial Arts</option>
                          <option value="Dance Studio">Dance Studio</option>
                          <option value="Nutrition Coaching">Nutrition Coaching</option>
                          <option value="Wellness Coaching">Wellness Coaching</option>
                          <option value="Meditation Center">Meditation Center</option>
                        </optgroup>

                        <optgroup label="Legal & Compliance">
                          <option value="Law Firm">Law Firm</option>
                          <option value="Corporate Law">Corporate Law</option>
                          <option value="Family Law">Family Law</option>
                          <option value="Criminal Defense">Criminal Defense</option>
                          <option value="Immigration Law">Immigration Law</option>
                          <option value="Intellectual Property">Intellectual Property</option>
                          <option value="Real Estate Law">Real Estate Law</option>
                          <option value="Tax Law">Tax Law</option>
                          <option value="Employment Law">Employment Law</option>
                          <option value="Compliance Consulting">Compliance Consulting</option>
                          <option value="Notary Services">Notary Services</option>
                          <option value="Mediation Services">Mediation Services</option>
                        </optgroup>

                        <optgroup label="Marketing & Advertising">
                          <option value="Digital Marketing">Digital Marketing</option>
                          <option value="SEO Services">SEO Services</option>
                          <option value="Social Media Marketing">Social Media Marketing</option>
                          <option value="Content Marketing">Content Marketing</option>
                          <option value="Email Marketing">Email Marketing</option>
                          <option value="PPC Advertising">PPC Advertising</option>
                          <option value="Brand Strategy">Brand Strategy</option>
                          <option value="Graphic Design">Graphic Design</option>
                          <option value="Video Marketing">Video Marketing</option>
                          <option value="Influencer Marketing">Influencer Marketing</option>
                          <option value="Market Research">Market Research</option>
                          <option value="Public Relations">Public Relations</option>
                        </optgroup>

                        <optgroup label="Human Resources & Recruiting">
                          <option value="Recruitment Agency">Recruitment Agency</option>
                          <option value="Executive Search">Executive Search</option>
                          <option value="Staffing Services">Staffing Services</option>
                          <option value="HR Consulting">HR Consulting</option>
                          <option value="Payroll Management">Payroll Management</option>
                          <option value="Benefits Administration">Benefits Administration</option>
                          <option value="Background Checks">Background Checks</option>
                          <option value="Employee Training">Employee Training</option>
                          <option value="Outplacement Services">Outplacement Services</option>
                        </optgroup>

                        <optgroup label="Agriculture & Farming">
                          <option value="Crop Farming">Crop Farming</option>
                          <option value="Livestock Farming">Livestock Farming</option>
                          <option value="Organic Farming">Organic Farming</option>
                          <option value="Aquaculture">Aquaculture</option>
                          <option value="Hydroponic Farming">Hydroponic Farming</option>
                          <option value="Vineyard">Vineyard</option>
                          <option value="Poultry Farming">Poultry Farming</option>
                          <option value="Dairy Farming">Dairy Farming</option>
                          <option value="Agricultural Equipment">Agricultural Equipment</option>
                          <option value="Farm Consulting">Farm Consulting</option>
                        </optgroup>

                        <optgroup label="Energy & Utilities">
                          <option value="Solar Energy">Solar Energy</option>
                          <option value="Wind Energy">Wind Energy</option>
                          <option value="Oil & Gas">Oil & Gas</option>
                          <option value="Electric Utilities">Electric Utilities</option>
                          <option value="Water Utilities">Water Utilities</option>
                          <option value="Waste Management">Waste Management</option>
                          <option value="Recycling Services">Recycling Services</option>
                          <option value="Energy Consulting">Energy Consulting</option>
                          <option value="Battery Technology">Battery Technology</option>
                        </optgroup>

                        <optgroup label="Environmental & Sustainability">
                          <option value="Environmental Consulting">Environmental Consulting</option>
                          <option value="Carbon Offset Programs">Carbon Offset Programs</option>
                          <option value="Green Building">Green Building</option>
                          <option value="Water Conservation">Water Conservation</option>
                          <option value="Air Quality Monitoring">Air Quality Monitoring</option>
                          <option value="Sustainable Products">Sustainable Products</option>
                          <option value="Climate Research">Climate Research</option>
                        </optgroup>

                        <optgroup label="Non-Profit & Social Services">
                          <option value="Charity Organization">Charity Organization</option>
                          <option value="Religious Organization">Religious Organization</option>
                          <option value="Social Services">Social Services</option>
                          <option value="Community Development">Community Development</option>
                          <option value="Homeless Services">Homeless Services</option>
                          <option value="Youth Programs">Youth Programs</option>
                          <option value="Senior Services">Senior Services</option>
                          <option value="Addiction Treatment">Addiction Treatment</option>
                          <option value="Food Bank">Food Bank</option>
                          <option value="Animal Rescue">Animal Rescue</option>
                        </optgroup>

                        <optgroup label="Automotive & Vehicles">
                          <option value="Auto Repair">Auto Repair</option>
                          <option value="Auto Body Shop">Auto Body Shop</option>
                          <option value="Auto Detailing">Auto Detailing</option>
                          <option value="Car Dealership">Car Dealership</option>
                          <option value="Car Rental">Car Rental</option>
                          <option value="Tire Shop">Tire Shop</option>
                          <option value="Oil Change">Oil Change</option>
                          <option value="Car Wash">Car Wash</option>
                          <option value="Towing Services">Towing Services</option>
                          <option value="Auto Parts Sales">Auto Parts Sales</option>
                        </optgroup>

                        <optgroup label="Home & Garden">
                          <option value="Interior Design">Interior Design</option>
                          <option value="Home Staging">Home Staging</option>
                          <option value="Furniture Design">Furniture Design</option>
                          <option value="Garden Design">Garden Design</option>
                          <option value="Lawn Care">Lawn Care</option>
                          <option value="Tree Services">Tree Services</option>
                          <option value="Pest Control">Pest Control</option>
                          <option value="Cleaning Services">Cleaning Services</option>
                          <option value="Window Cleaning">Window Cleaning</option>
                          <option value="Junk Removal">Junk Removal</option>
                        </optgroup>

                        <optgroup label="Arts & Crafts">
                          <option value="Fine Arts">Fine Arts</option>
                          <option value="Pottery & Ceramics">Pottery & Ceramics</option>
                          <option value="Woodworking">Woodworking</option>
                          <option value="Metalworking">Metalworking</option>
                          <option value="Textiles & Sewing">Textiles & Sewing</option>
                          <option value="Jewelry Making">Jewelry Making</option>
                          <option value="Glass Blowing">Glass Blowing</option>
                          <option value="Printmaking">Printmaking</option>
                          <option value="Sculpture">Sculpture</option>
                        </optgroup>

                        <optgroup label="Sports & Recreation">
                          <option value="Sports Training">Sports Training</option>
                          <option value="Golf Course">Golf Course</option>
                          <option value="Bowling Alley">Bowling Alley</option>
                          <option value="Skating Rink">Skating Rink</option>
                          <option value="Climbing Gym">Climbing Gym</option>
                          <option value="Trampoline Park">Trampoline Park</option>
                          <option value="Escape Room">Escape Room</option>
                          <option value="Arcade">Arcade</option>
                          <option value="Paintball">Paintball</option>
                          <option value="Laser Tag">Laser Tag</option>
                        </optgroup>

                        <optgroup label="Pet Care & Veterinary">
                          <option value="Veterinary Clinic">Veterinary Clinic</option>
                          <option value="Pet Grooming">Pet Grooming</option>
                          <option value="Pet Boarding">Pet Boarding</option>
                          <option value="Dog Training">Dog Training</option>
                          <option value="Pet Sitting">Pet Sitting</option>
                          <option value="Pet Supplies Retail">Pet Supplies Retail</option>
                          <option value="Aquarium Services">Aquarium Services</option>
                          <option value="Equine Services">Equine Services</option>
                        </optgroup>

                        <optgroup label="Telecommunications">
                          <option value="Mobile Network Operator">Mobile Network Operator</option>
                          <option value="Internet Service Provider">Internet Service Provider</option>
                          <option value="VoIP Services">VoIP Services</option>
                          <option value="Satellite Services">Satellite Services</option>
                          <option value="Cable TV">Cable TV</option>
                        </optgroup>

                        <optgroup label="Security & Safety">
                          <option value="Security Services">Security Services</option>
                          <option value="Alarm Systems">Alarm Systems</option>
                          <option value="CCTV Installation">CCTV Installation</option>
                          <option value="Private Investigation">Private Investigation</option>
                          <option value="Fire Safety">Fire Safety</option>
                          <option value="Background Screening">Background Screening</option>
                          <option value="Cybersecurity Consulting">Cybersecurity Consulting</option>
                        </optgroup>

                        <optgroup label="Events & Event Planning">
                          <option value="Wedding Planning">Wedding Planning</option>
                          <option value="Corporate Events">Corporate Events</option>
                          <option value="Birthday Parties">Birthday Parties</option>
                          <option value="Concert Planning">Concert Planning</option>
                          <option value="Festival Organization">Festival Organization</option>
                          <option value="Trade Show Planning">Trade Show Planning</option>
                          <option value="Event Staffing">Event Staffing</option>
                          <option value="Audio/Visual Rental">Audio/Visual Rental</option>
                        </optgroup>
                      </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyEmail">Company Email</Label>
                        <Input
                          id="companyEmail"
                          ref={companyEmailRef}
                          type="email"
                          defaultValue={companyData?.company?.email || ""}
                          data-testid="input-company-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyPhone">Company Phone</Label>
                        <Input
                          id="companyPhone"
                          ref={companyPhoneRef}
                          type="tel"
                          defaultValue={companyData?.company?.phone || ""}
                          data-testid="input-company-phone"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        ref={websiteRef}
                        type="url"
                        placeholder="https://example.com"
                        defaultValue={companyData?.company?.website || ""}
                        data-testid="input-website"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companySize">Company Size</Label>
                        <select
                          id="companySize"
                          ref={companySizeRef}
                          defaultValue={companyData?.company?.companySize || ""}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-company-size"
                        >
                          <option value="">Select company size</option>
                          <option value="1-10">1-10 employees</option>
                          <option value="11-50">11-50 employees</option>
                          <option value="51-200">51-200 employees</option>
                          <option value="201-500">201-500 employees</option>
                          <option value="501+">501+ employees</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Input
                          id="timezone"
                          ref={timezoneRef}
                          defaultValue={companyData?.company?.timezone || "UTC"}
                          data-testid="input-timezone"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
                          id="currency"
                          ref={currencyRef}
                          defaultValue={companyData?.company?.currency || "USD"}
                          data-testid="input-currency"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="platformLanguage">Platform Language</Label>
                        <Input
                          id="platformLanguage"
                          ref={platformLanguageRef}
                          defaultValue={companyData?.company?.platformLanguage || "English (United States)"}
                          data-testid="input-platform-language"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Physical Address */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Physical Address</CardTitle>
                      <CardDescription>
                        Company address and location details
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSavePhysicalAddress}
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-physical-address"
                    >
                      {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input
                        id="address"
                        ref={addressRef}
                        defaultValue={companyData?.company?.address || ""}
                        data-testid="input-address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="addressLine2">Address Line 2</Label>
                      <Input
                        id="addressLine2"
                        ref={addressLine2Ref}
                        placeholder="Suite, Apt, Unit, etc."
                        defaultValue={companyData?.company?.addressLine2 || ""}
                        data-testid="input-address-line-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          ref={cityRef}
                          defaultValue={companyData?.company?.city || ""}
                          data-testid="input-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State / Province</Label>
                        <Input
                          id="state"
                          ref={stateRef}
                          defaultValue={companyData?.company?.state || ""}
                          data-testid="input-state"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          ref={postalCodeRef}
                          defaultValue={companyData?.company?.postalCode || ""}
                          data-testid="input-postal-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          ref={countryRef}
                          defaultValue={companyData?.company?.country || "United States"}
                          data-testid="input-country"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Authorized Representative */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Authorized Representative</CardTitle>
                      <CardDescription>
                        Contact information for the company's authorized representative
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSaveAuthorizedRepresentative}
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-authorized-representative"
                    >
                      {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="representativeFirstName">First Name</Label>
                        <Input
                          id="representativeFirstName"
                          ref={representativeFirstNameRef}
                          defaultValue={companyData?.company?.representativeFirstName || ""}
                          data-testid="input-representative-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="representativeLastName">Last Name</Label>
                        <Input
                          id="representativeLastName"
                          ref={representativeLastNameRef}
                          defaultValue={companyData?.company?.representativeLastName || ""}
                          data-testid="input-representative-last-name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="representativeEmail">Email</Label>
                        <Input
                          id="representativeEmail"
                          ref={representativeEmailRef}
                          type="email"
                          defaultValue={companyData?.company?.representativeEmail || ""}
                          data-testid="input-representative-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="representativePhone">Phone</Label>
                        <Input
                          id="representativePhone"
                          ref={representativePhoneRef}
                          type="tel"
                          defaultValue={companyData?.company?.representativePhone || ""}
                          data-testid="input-representative-phone"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="representativePosition">Position / Title</Label>
                      <Input
                        id="representativePosition"
                        ref={representativePositionRef}
                        defaultValue={companyData?.company?.representativePosition || ""}
                        data-testid="input-representative-position"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Branding */}
                <Card>
                  <CardHeader>
                    <CardTitle>Branding</CardTitle>
                    <CardDescription>
                      Company logo and visual identity
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo">Logo URL</Label>
                        <Input
                          id="logo"
                          type="url"
                          placeholder="https://example.com/logo.png"
                          defaultValue={companyData?.company?.logo || ""}
                          data-testid="input-logo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="domain">Custom Domain</Label>
                        <Input
                          id="domain"
                          placeholder="app.example.com"
                          defaultValue={companyData?.company?.domain || ""}
                          data-testid="input-domain"
                        />
                      </div>
                    </div>

                    <Button variant="default" data-testid="button-save-company-settings">
                      Save All Changes
                    </Button>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column - Change Password */}
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

                {/* Right Column - 2FA and Active Sessions */}
                <div className="space-y-4">
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
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
