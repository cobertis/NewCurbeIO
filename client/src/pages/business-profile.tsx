import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Building2, Globe, FileText, User as UserIcon, Copy, RefreshCw, Plus } from "lucide-react";
import type { User, Company } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatPhoneDisplay, formatPhoneE164, formatPhoneInput } from "@/lib/phone-formatter";

// Validation Schemas
const generalInfoSchema = z.object({
  logo: z.string().optional(),
  name: z.string().min(1, "Business name is required"),
  legalName: z.string().optional(),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  domain: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  currency: z.string().default("USD"),
  apiKey: z.string().optional(),
});

const addressSchema = z.object({
  address: z.string().min(1, "Street address is required"),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("United States"),
  timezone: z.string().default("UTC"),
  platformLanguage: z.string().default("English (United States)"),
  outboundLanguage: z.string().default("Spanish (United States)"),
});

const businessInfoSchema = z.object({
  businessType: z.string().optional(),
  registrationIdType: z.string().optional(),
  registrationNumber: z.string().optional(),
  isNotRegistered: z.boolean().default(false),
  regionsOfOperation: z.array(z.string()),
});

const representativeSchema = z.object({
  representativeFirstName: z.string().optional(),
  representativeLastName: z.string().optional(),
  representativeEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  representativePosition: z.string().optional(),
  representativePhone: z.string().optional(),
});

export default function BusinessProfile() {
  const { toast } = useToast();

  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = userData?.user;
  const companyId = user?.companyId;

  const { data: companyData, isLoading } = useQuery<{ company: Company }>({
    queryKey: ["/api/companies", companyId],
    enabled: !!companyId,
  });

  const company = companyData?.company;

  // General Information Form
  const generalForm = useForm({
    resolver: zodResolver(generalInfoSchema),
    defaultValues: {
      logo: "",
      name: "",
      legalName: "",
      email: "",
      phone: "",
      domain: "",
      website: "",
      industry: "",
      currency: "USD",
      apiKey: "",
    },
  });

  // Address Form
  const addressForm = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address: "",
      city: "",
      postalCode: "",
      state: "",
      country: "United States",
      timezone: "UTC",
      platformLanguage: "English (United States)",
      outboundLanguage: "Spanish (United States)",
    },
  });

  // Business Info Form
  const businessForm = useForm<{
    businessType?: string;
    registrationIdType?: string;
    registrationNumber?: string;
    isNotRegistered: boolean;
    regionsOfOperation: string[];
  }>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
      businessType: "",
      registrationIdType: "",
      registrationNumber: "",
      isNotRegistered: false,
      regionsOfOperation: [] as string[],
    },
  });

  // Representative Form
  const representativeForm = useForm({
    resolver: zodResolver(representativeSchema),
    defaultValues: {
      representativeFirstName: "",
      representativeLastName: "",
      representativeEmail: "",
      representativePosition: "",
      representativePhone: "",
    },
  });

  // Update forms when company data loads
  useEffect(() => {
    if (company) {
      generalForm.reset({
        logo: company.logo || "",
        name: company.name || "",
        legalName: company.legalName || "",
        email: company.email || "",
        phone: company.phone ? formatPhoneDisplay(company.phone) : "",
        domain: company.domain || "",
        website: company.website || "",
        industry: company.industry || "",
        currency: company.currency || "USD",
        apiKey: company.apiKey || "",
      });

      addressForm.reset({
        address: company.address || "",
        city: company.city || "",
        postalCode: company.postalCode || "",
        state: company.state || "",
        country: company.country || "United States",
        timezone: company.timezone || "UTC",
        platformLanguage: company.platformLanguage || "English (United States)",
        outboundLanguage: company.outboundLanguage || "Spanish (United States)",
      });

      businessForm.reset({
        businessType: company.businessType || "",
        registrationIdType: company.registrationIdType || "",
        registrationNumber: company.registrationNumber || "",
        isNotRegistered: company.isNotRegistered || false,
        regionsOfOperation: (company.regionsOfOperation || []) as string[],
      });

      representativeForm.reset({
        representativeFirstName: company.representativeFirstName || "",
        representativeLastName: company.representativeLastName || "",
        representativeEmail: company.representativeEmail || "",
        representativePosition: company.representativePosition || "",
        representativePhone: company.representativePhone ? formatPhoneDisplay(company.representativePhone) : "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // Update mutations
  const updateGeneralMutation = useMutation({
    mutationFn: async (data: any) => {
      const dataToSend = {
        ...data,
        phone: data.phone ? formatPhoneE164(data.phone) : data.phone,
      };
      return apiRequest("PATCH", `/api/companies/${companyId}`, dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Success", description: "General information updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update general information.", variant: "destructive" });
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/companies/${companyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Success", description: "Business address updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update business address.", variant: "destructive" });
    },
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/companies/${companyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Success", description: "Business information updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update business information.", variant: "destructive" });
    },
  });

  const updateRepresentativeMutation = useMutation({
    mutationFn: async (data: any) => {
      const dataToSend = {
        ...data,
        representativePhone: data.representativePhone ? formatPhoneE164(data.representativePhone) : data.representativePhone,
      };
      return apiRequest("PATCH", `/api/companies/${companyId}`, dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Success", description: "Representative information updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update representative information.", variant: "destructive" });
    },
  });

  // Generate API Key using browser-safe crypto
  const generateRandomHex = (length: number) => {
    const array = new Uint8Array(length / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const generateApiKeyMutation = useMutation({
    mutationFn: async () => {
      const newApiKey = generateRandomHex(64); // 32 bytes = 64 hex characters
      return apiRequest("PATCH", `/api/companies/${companyId}`, { apiKey: newApiKey });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      toast({ title: "Success", description: "API key generated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate API key.", variant: "destructive" });
    },
  });

  // Copy API Key
  const copyApiKey = () => {
    if (company?.apiKey) {
      navigator.clipboard.writeText(company.apiKey);
      toast({ title: "Copied", description: "API key copied to clipboard." });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
          <p className="text-muted-foreground">Loading business profile...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No company data available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 pb-8">
        {/* Section 1: General Information */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            General Information
          </CardTitle>
          <CardDescription>Update your business details and branding</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit((data) => updateGeneralMutation.mutate(data))} className="space-y-4">
              <FormField
                control={generalForm.control}
                name="logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Logo</FormLabel>
                    <FormDescription className="text-sm text-muted-foreground">
                      The proposed size is 350px * 180px. No bigger than 2.5 MB
                    </FormDescription>
                    <div className="flex items-start gap-4 mt-2">
                      <div className="w-[350px] h-[180px] border-2 border-dashed border-muted rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden">
                        {field.value ? (
                          <img 
                            src={field.value} 
                            alt="Business Logo" 
                            className="max-w-full max-h-full object-contain"
                            data-testid="img-business-logo"
                          />
                        ) : (
                          <Plus className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <FormControl>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="logo-upload"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2.5 * 1024 * 1024) {
                                  toast({ 
                                    title: "Error", 
                                    description: "File size must not exceed 2.5 MB", 
                                    variant: "destructive" 
                                  });
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  field.onChange(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            data-testid="input-logo-file"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('logo-upload')?.click()}
                          data-testid="button-upload-logo"
                        >
                          Upload
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => field.onChange("")}
                          disabled={!field.value}
                          data-testid="button-remove-logo"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={generalForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Friendly Business Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-business-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={generalForm.control}
                  name="legalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Business Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-legal-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={generalForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Email *</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-business-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={generalForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Phone *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            field.onChange(formatted);
                          }}
                          placeholder="+1 (415) 555-2671"
                          data-testid="input-business-phone" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={generalForm.control}
                  name="domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branded Domain</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="yourbusiness.com" data-testid="input-domain" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={generalForm.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://yourbusiness.com" data-testid="input-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={generalForm.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Niche</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Real Estate">Real Estate</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={generalForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                          <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                          <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={generalForm.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input {...field} readOnly className="font-mono text-sm bg-muted" data-testid="input-api-key" />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyApiKey}
                        disabled={!company.apiKey}
                        data-testid="button-copy-api-key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => generateApiKeyMutation.mutate()}
                        disabled={generateApiKeyMutation.isPending}
                        data-testid="button-generate-api-key"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate Key
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateGeneralMutation.isPending} data-testid="button-save-general">
                {updateGeneralMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Section 2: Business Physical Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Business Physical Address
          </CardTitle>
          <CardDescription>Update your business location and language preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...addressForm}>
            <form onSubmit={addressForm.handleSubmit((data) => updateAddressMutation.mutate(data))} className="space-y-4">
              <FormField
                control={addressForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={addressForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addressForm.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal/Zip Code</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-postal-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addressForm.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State/Province/Region</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          <SelectItem value="AL">Alabama</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={addressForm.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Mexico">Mexico</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addressForm.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time Zone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-timezone">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">America - USA</div>
                        <SelectItem value="America/New_York">(UTC-05:00) EST, New York</SelectItem>
                        <SelectItem value="America/Chicago">(UTC-06:00) CST, Chicago</SelectItem>
                        <SelectItem value="America/Denver">(UTC-07:00) MST, Denver</SelectItem>
                        <SelectItem value="America/Los_Angeles">(UTC-08:00) PST, Los Angeles</SelectItem>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Europe</div>
                        <SelectItem value="Europe/London">(UTC+00:00) GMT, London</SelectItem>
                        <SelectItem value="Europe/Paris">(UTC+01:00) CET, Paris</SelectItem>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Asia</div>
                        <SelectItem value="Asia/Tokyo">(UTC+09:00) JST, Tokyo</SelectItem>
                        <SelectItem value="Asia/Shanghai">(UTC+08:00) CST, Shanghai</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addressForm.control}
                  name="platformLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Language</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-platform-language">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="English (United States)">English (United States)</SelectItem>
                          <SelectItem value="Spanish (United States)">Spanish (United States)</SelectItem>
                          <SelectItem value="French">French</SelectItem>
                          <SelectItem value="German">German</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addressForm.control}
                  name="outboundLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outbound Communication Language</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-outbound-language">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Spanish (United States)">Spanish (United States)</SelectItem>
                          <SelectItem value="English (United States)">English (United States)</SelectItem>
                          <SelectItem value="French">French</SelectItem>
                          <SelectItem value="German">German</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={updateAddressMutation.isPending} data-testid="button-save-address">
                {updateAddressMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Section 3: Business Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Business Information
          </CardTitle>
          <CardDescription>Update your business type and registration details</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...businessForm}>
            <form onSubmit={businessForm.handleSubmit((data) => updateBusinessMutation.mutate(data))} className="space-y-4">
              <FormField
                control={businessForm.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-business-type">
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Limited Liability Company Or Sole-Proprietorship">Limited Liability Company Or Sole-Proprietorship</SelectItem>
                        <SelectItem value="Corporation">Corporation</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={businessForm.control}
                name="registrationIdType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Registration ID Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-registration-id-type">
                          <SelectValue placeholder="Select registration ID type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USA: Employer Identification Number (EIN)">USA: Employer Identification Number (EIN)</SelectItem>
                        <SelectItem value="USA: Social Security Number (SSN)">USA: Social Security Number (SSN)</SelectItem>
                        <SelectItem value="Canada: Business Number (BN)">Canada: Business Number (BN)</SelectItem>
                        <SelectItem value="UK: Company Registration Number">UK: Company Registration Number</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={businessForm.control}
                name="registrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Registration Number</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-registration-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={businessForm.control}
                name="isNotRegistered"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-not-registered"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>My business is Not registered</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={businessForm.control}
                name="regionsOfOperation"
                render={() => (
                  <FormItem>
                    <FormLabel>Business Regions of Operations</FormLabel>
                    <div className="space-y-2">
                      {["Africa", "Asia", "Europe", "Latin America", "USA and Canada"].map((region) => (
                        <FormField
                          key={region}
                          control={businessForm.control}
                          name="regionsOfOperation"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(region)}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    return checked
                                      ? field.onChange([...currentValue, region])
                                      : field.onChange(currentValue.filter((value: string) => value !== region));
                                  }}
                                  data-testid={`checkbox-region-${region.toLowerCase().replace(/\s+/g, '-')}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">{region}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateBusinessMutation.isPending} data-testid="button-save-business">
                {updateBusinessMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Section 4: Authorized Representative */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Authorized Representative
          </CardTitle>
          <CardDescription>Update authorized representative information</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...representativeForm}>
            <form onSubmit={representativeForm.handleSubmit((data) => updateRepresentativeMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={representativeForm.control}
                  name="representativeFirstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-rep-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={representativeForm.control}
                  name="representativeLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-rep-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={representativeForm.control}
                name="representativeEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Representative Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-rep-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={representativeForm.control}
                name="representativePosition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Position</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-rep-position">
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CEO">CEO</SelectItem>
                        <SelectItem value="CFO">CFO</SelectItem>
                        <SelectItem value="CTO">CTO</SelectItem>
                        <SelectItem value="COO">COO</SelectItem>
                        <SelectItem value="Director">Director</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={representativeForm.control}
                name="representativePhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                        placeholder="+1 (415) 555-2671"
                        data-testid="input-rep-phone" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateRepresentativeMutation.isPending} data-testid="button-save-representative">
                {updateRepresentativeMutation.isPending ? "Updating..." : "Update"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
