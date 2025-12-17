import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { TelnyxBrand } from "@shared/schema";

interface MessagingProfileResponse {
  exists: boolean;
  profile?: {
    id: string;
    name?: string;
    enabled?: boolean;
    webhook_url?: string | null;
  };
}

interface TollFreeVerification {
  id: string;
  verificationRequestId?: string;
  verificationStatus: string;
  businessName: string;
  phoneNumbers?: { phoneNumber: string }[];
  createdAt?: string;
}

interface TollFreeVerificationsResponse {
  verifications: TollFreeVerification[];
  meta?: any;
}

interface TenDLCCampaign {
  campaignId: string;
  brandId: string;
  usecase: string;
  description?: string;
  status: string;
  createDate?: string;
  sample1?: string;
  sample2?: string;
}

interface CampaignsResponse {
  campaigns: TenDLCCampaign[];
}

const USE_CASES = [
  { value: "2FA", label: "Two-Factor Authentication", description: "Authentication, verification, or one-time passcode" },
  { value: "ACCOUNT_NOTIFICATION", label: "Account Notifications", description: "Password reset, low-balance, transaction alerts" },
  { value: "CUSTOMER_CARE", label: "Customer Care", description: "Account management and customer support" },
  { value: "DELIVERY_NOTIFICATION", label: "Delivery Notifications", description: "Status of delivery of a product or service" },
  { value: "FRAUD_ALERT", label: "Fraud Alert Messaging", description: "Notifications regarding potential fraudulent activity" },
  { value: "HIGHER_EDUCATION", label: "Higher Education", description: "Colleges, Universities, School Districts messaging" },
  { value: "LOW_VOLUME", label: "Low Volume Mixed", description: "Multiple use cases with low messaging throughput (max 5)" },
  { value: "M2M", label: "Machine-to-Machine", description: "Device-to-device communication, no human interaction" },
  { value: "MARKETING", label: "Marketing", description: "Marketing and promotional content" },
  { value: "MIXED", label: "Mixed", description: "2-5 sub use cases on the same campaign" },
  { value: "POLLING_VOTING", label: "Polling and Voting", description: "Surveys, polling, and voting campaigns" },
  { value: "PUBLIC_SERVICE_ANNOUNCEMENT", label: "Public Service Announcement", description: "Informational messaging about important issues" },
  { value: "SECURITY_ALERT", label: "Security Alert", description: "System security compromise notifications" },
] as const;

const SUB_USE_CASES = [
  { value: "2FA", label: "2FA" },
  { value: "ACCOUNT_NOTIFICATION", label: "Account Notification" },
  { value: "CUSTOMER_CARE", label: "Customer Care" },
  { value: "DELIVERY_NOTIFICATION", label: "Delivery Notification" },
  { value: "FRAUD_ALERT", label: "Fraud Alert Messaging" },
  { value: "HIGHER_EDUCATION", label: "Higher Education" },
  { value: "M2M", label: "Machine to Machine" },
  { value: "MARKETING", label: "Marketing" },
  { value: "POLLING_VOTING", label: "Polling and voting" },
  { value: "PUBLIC_SERVICE_ANNOUNCEMENT", label: "Public Service Announcement" },
  { value: "SECURITY_ALERT", label: "Security Alert" },
] as const;

const ENTITY_TYPES = [
  { value: "PRIVATE_PROFIT", label: "Private For-Profit Company" },
  { value: "PUBLIC_PROFIT", label: "Public For-Profit Company" },
  { value: "NON_PROFIT", label: "Non-Profit Organization" },
  { value: "GOVERNMENT", label: "Government Entity" },
  { value: "SOLE_PROPRIETOR", label: "Sole Proprietor" },
] as const;

const VERTICALS = [
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "ENERGY", label: "Energy" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "RETAIL", label: "Retail" },
  { value: "AGRICULTURE", label: "Agriculture" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "EDUCATION", label: "Education" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "GAMBLING", label: "Gambling" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "NGO", label: "NGO" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "COMMUNICATION", label: "Communication" },
] as const;

const STOCK_EXCHANGES = [
  { value: "NASDAQ", label: "NASDAQ" },
  { value: "NYSE", label: "NYSE" },
  { value: "AMEX", label: "AMEX" },
  { value: "AMX", label: "AMX" },
  { value: "ASX", label: "ASX" },
  { value: "B3", label: "B3" },
  { value: "BME", label: "BME" },
  { value: "BSE", label: "BSE" },
  { value: "FRA", label: "FRA" },
  { value: "ICEX", label: "ICEX" },
  { value: "JPX", label: "JPX" },
  { value: "JSE", label: "JSE" },
  { value: "KRX", label: "KRX" },
  { value: "LON", label: "LON" },
  { value: "NSE", label: "NSE" },
  { value: "OMX", label: "OMX" },
  { value: "SEHK", label: "SEHK" },
  { value: "SGX", label: "SGX" },
  { value: "SSE", label: "SSE" },
  { value: "STO", label: "STO" },
  { value: "SWX", label: "SWX" },
  { value: "SZSE", label: "SZSE" },
  { value: "TSX", label: "TSX" },
  { value: "TWSE", label: "TWSE" },
  { value: "VSE", label: "VSE" },
  { value: "OTHER", label: "Other" },
] as const;

const baseFormSchema = z.object({
  entityType: z.enum(["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "GOVERNMENT", "SOLE_PROPRIETOR"]),
  displayName: z.string().min(1, "Display name is required").max(100),
  email: z.string().email("Valid email is required"),
  vertical: z.enum(["REAL_ESTATE", "HEALTHCARE", "ENERGY", "ENTERTAINMENT", "RETAIL", "AGRICULTURE", "INSURANCE", "EDUCATION", "HOSPITALITY", "FINANCIAL", "GAMBLING", "CONSTRUCTION", "NGO", "MANUFACTURING", "GOVERNMENT", "TECHNOLOGY", "COMMUNICATION"]),
  companyName: z.string().max(100).optional(),
  ein: z.string().max(20).optional(),
  businessContactEmail: z.string().email().optional().or(z.literal("")),
  stockSymbol: z.string().max(10).optional(),
  stockExchange: z.string().max(50).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  street: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(20).optional(),
  postalCode: z.string().max(10).optional(),
  website: z.string().max(100).optional(),
});

const brandFormSchema = baseFormSchema.superRefine((data, ctx) => {
  const { entityType, companyName, ein, businessContactEmail, stockSymbol, stockExchange, firstName, lastName, phone, street, city, state, postalCode } = data;
  
  if (["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "GOVERNMENT"].includes(entityType)) {
    if (!companyName || companyName.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Legal company name is required", path: ["companyName"] });
    }
  }
  
  if (entityType === "NON_PROFIT") {
    if (!ein || ein.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "EIN (Tax ID) is required for non-profits", path: ["ein"] });
    }
  }
  
  if (entityType === "PUBLIC_PROFIT") {
    if (!businessContactEmail || businessContactEmail.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Business contact email is required", path: ["businessContactEmail"] });
    }
    if (!stockSymbol || stockSymbol.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Stock symbol is required for public companies", path: ["stockSymbol"] });
    }
    if (!stockExchange || stockExchange.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Stock exchange is required for public companies", path: ["stockExchange"] });
    }
  }
  
  if (entityType === "SOLE_PROPRIETOR") {
    if (!firstName || firstName.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "First name is required for sole proprietors", path: ["firstName"] });
    }
    if (!lastName || lastName.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Last name is required for sole proprietors", path: ["lastName"] });
    }
    if (!phone || phone.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone number is required for sole proprietors", path: ["phone"] });
    }
    if (!street || street.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Street address is required for sole proprietors", path: ["street"] });
    }
    if (!city || city.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "City is required for sole proprietors", path: ["city"] });
    }
    if (!state || state.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "State is required for sole proprietors", path: ["state"] });
    }
    if (!postalCode || postalCode.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ZIP code is required for sole proprietors", path: ["postalCode"] });
    }
  }
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

function getStatusBadge(status: string | null) {
  switch (status?.toUpperCase()) {
    case "VERIFIED":
    case "OK":
      return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
    case "VETTED_VERIFIED":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><ShieldCheck className="h-3 w-3 mr-1" />Vetted</Badge>;
    case "PENDING":
    case "REGISTRATION_PENDING":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "UNVERIFIED":
    case "REGISTRATION_FAILED":
      return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case "SELF_DECLARED":
      return <Badge className="bg-slate-100 text-slate-800 border-slate-200">Self Declared</Badge>;
    default:
      return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
}

export function ComplianceTab() {
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: brands = [], isLoading } = useQuery<TelnyxBrand[]>({
    queryKey: ["/api/phone-system/brands"],
  });

  const { data: messagingProfile, isLoading: isLoadingProfile } = useQuery<MessagingProfileResponse>({
    queryKey: ["/api/phone-system/messaging-profile"],
  });

  const { data: tollFreeData, isLoading: isLoadingTollFree } = useQuery<TollFreeVerificationsResponse>({
    queryKey: ["/api/phone-system/toll-free/verifications"],
  });

  const { data: campaignsData, isLoading: isLoadingCampaigns } = useQuery<CampaignsResponse>({
    queryKey: ["/api/phone-system/campaigns"],
  });

  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false);
  const [selectedBrandForCampaign, setSelectedBrandForCampaign] = useState<string>("");
  const [selectedUseCase, setSelectedUseCase] = useState<string>("");
  const [selectedSubUseCases, setSelectedSubUseCases] = useState<string[]>([]);
  const [campaignDescription, setCampaignDescription] = useState<string>("");
  const [sampleMessage1, setSampleMessage1] = useState<string>("");
  const [sampleMessage2, setSampleMessage2] = useState<string>("");
  const [messageFlow, setMessageFlow] = useState<string>("Customers opt-in via our website or in-person sign-up form. They can opt-out at any time by replying STOP.");

  const needsSubUseCases = selectedUseCase === "MIXED" || selectedUseCase === "LOW_VOLUME";
  const minSubUseCases = selectedUseCase === "MIXED" ? 2 : 1;
  const maxSubUseCases = 5;

  const toggleSubUseCase = (value: string) => {
    setSelectedSubUseCases(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      }
      if (prev.length >= maxSubUseCases) {
        return prev;
      }
      return [...prev, value];
    });
  };

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/phone-system/campaigns", {
        brandId: selectedBrandForCampaign,
        useCase: selectedUseCase,
        subUseCases: needsSubUseCases ? selectedSubUseCases : undefined,
        description: campaignDescription,
        sampleMessage1,
        sampleMessage2,
        messageFlow,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/phone-system/campaigns"] });
      toast({ title: "Campaign created", description: "Your 10DLC campaign has been submitted for approval." });
      setCampaignSheetOpen(false);
      setSelectedBrandForCampaign("");
      setSelectedUseCase("");
      setSelectedSubUseCases([]);
      setCampaignDescription("");
      setSampleMessage1("");
      setSampleMessage2("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/phone-system/messaging-profile", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/phone-system/messaging-profile"] });
      toast({ title: "Messaging Profile created", description: "Your SMS profile has been configured." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create profile", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      entityType: "PRIVATE_PROFIT",
      displayName: "",
      email: "",
      vertical: "INSURANCE",
      companyName: "",
      ein: "",
      businessContactEmail: "",
      stockSymbol: "",
      stockExchange: "",
      firstName: "",
      lastName: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      postalCode: "",
      website: "",
    },
  });

  const entityType = form.watch("entityType");

  const createBrandMutation = useMutation({
    mutationFn: async (data: BrandFormValues) => {
      return await apiRequest("POST", "/api/phone-system/brands", data);
    },
    onSuccess: () => {
      toast({ title: "Brand registered successfully", description: "Your 10DLC brand has been submitted for verification." });
      queryClient.invalidateQueries({ queryKey: ["/api/phone-system/brands"] });
      setSheetOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Registration failed", description: error.message || "Failed to register brand", variant: "destructive" });
    },
  });

  const onSubmit = (data: BrandFormValues) => {
    createBrandMutation.mutate(data);
  };

  const needsCompanyName = ["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "GOVERNMENT"].includes(entityType);
  const needsEin = ["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT"].includes(entityType);
  const needsPublicFields = entityType === "PUBLIC_PROFIT";
  const isSoleProprietor = entityType === "SOLE_PROPRIETOR";

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Registered Brands</h3>
            <p className="text-sm text-slate-500 mt-1">Your 10DLC brands registered with The Campaign Registry</p>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button data-testid="btn-register-brand">
                <Plus className="h-4 w-4 mr-2" />
                Register Brand
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Register 10DLC Brand</SheetTitle>
                <SheetDescription>
                  Submit your business information for 10DLC compliance. This is required to send SMS in the US.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Registration Fee: $4.00</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">This is a non-refundable fee charged by The Campaign Registry (TCR).</p>
                  </div>
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b pb-2">Company Information</h3>
                    
                    <FormField
                      control={form.control}
                      name="entityType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Entity Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-entity-type">
                                <SelectValue placeholder="Select entity type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ENTITY_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name (DBA) *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your business name" {...field} data-testid="input-display-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {needsCompanyName && (
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Legal Company Name {needsCompanyName ? "*" : ""}</FormLabel>
                            <FormControl>
                              <Input placeholder="Legal entity name" {...field} data-testid="input-company-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {needsEin && (
                      <FormField
                        control={form.control}
                        name="ein"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>EIN (Tax ID) *</FormLabel>
                            <FormControl>
                              <Input placeholder="XX-XXXXXXX" {...field} data-testid="input-ein" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contact@company.com" {...field} data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="vertical"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vertical">
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {VERTICALS.map((v) => (
                                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {needsPublicFields && (
                      <>
                        <FormField
                          control={form.control}
                          name="businessContactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Contact Email *</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="business@company.com" {...field} data-testid="input-business-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="stockSymbol"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock Symbol *</FormLabel>
                                <FormControl>
                                  <Input placeholder="AAPL" {...field} data-testid="input-stock-symbol" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="stockExchange"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock Exchange *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-stock-exchange">
                                      <SelectValue placeholder="Select exchange" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {STOCK_EXCHANGES.map((ex) => (
                                      <SelectItem key={ex.value} value={ex.value}>{ex.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b pb-2">
                      Contact Information {isSoleProprietor ? "(Required)" : "(Optional)"}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name {isSoleProprietor && "*"}</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} data-testid="input-first-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name {isSoleProprietor && "*"}</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number {isSoleProprietor && "*"}</FormLabel>
                          <FormControl>
                            <Input placeholder="+12024567890" {...field} data-testid="input-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b pb-2">
                      Address {isSoleProprietor ? "(Required)" : "(Optional)"}
                    </h3>
                    
                    <FormField
                      control={form.control}
                      name="street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address {isSoleProprietor && "*"}</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} data-testid="input-street" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City {isSoleProprietor && "*"}</FormLabel>
                            <FormControl>
                              <Input placeholder="Miami" {...field} data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State {isSoleProprietor && "*"}</FormLabel>
                            <FormControl>
                              <Input placeholder="FL" maxLength={2} {...field} data-testid="input-state" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code {isSoleProprietor && "*"}</FormLabel>
                            <FormControl>
                              <Input placeholder="33101" {...field} data-testid="input-zip" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b pb-2">Additional (Optional)</h3>
                    
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://yourcompany.com" {...field} data-testid="input-website" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createBrandMutation.isPending}
                    data-testid="btn-submit-brand"
                  >
                    {createBrandMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering...</>
                    ) : (
                      <>Register Brand ($4.00)</>
                    )}
                  </Button>
                </form>
              </Form>
            </SheetContent>
          </Sheet>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mb-4" />
            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">No brands registered</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Register a 10DLC brand to enable SMS messaging in the United States. This is required for A2P compliance.
            </p>
            <Button className="mt-4" onClick={() => setSheetOpen(true)} data-testid="btn-register-first-brand">
              <Plus className="h-4 w-4 mr-2" />
              Register Your First Brand
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {brands.map((brand) => (
              <div key={brand.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">{brand.displayName}</h4>
                      <p className="text-sm text-slate-500 mt-0.5">{brand.companyName || brand.email}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-400">
                          {ENTITY_TYPES.find(e => e.value === brand.entityType)?.label}
                        </span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-400">
                          {VERTICALS.find(v => v.value === brand.vertical)?.label}
                        </span>
                      </div>
                      {brand.brandId && (
                        <p className="text-xs text-slate-400 mt-1 font-mono">Brand ID: {brand.brandId}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(brand.status)}
                    {brand.identityStatus && brand.identityStatus !== brand.status && (
                      <span className="text-xs text-slate-500">Identity: {brand.identityStatus}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Messaging Profile</h3>
            <p className="text-sm text-slate-500 mt-1">Required for sending SMS/MMS messages through your phone numbers</p>
          </div>
          {!isLoadingProfile && !messagingProfile?.exists && (
            <Button 
              onClick={() => createProfileMutation.mutate()}
              disabled={createProfileMutation.isPending}
              data-testid="btn-create-messaging-profile"
            >
              {createProfileMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Create Profile</>
              )}
            </Button>
          )}
        </div>

        <div className="p-6">
          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : messagingProfile?.exists ? (
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {messagingProfile.profile?.name || "SMS Profile"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Profile ID: {messagingProfile.profile?.id}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />Active
              </Badge>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-slate-300 mb-4" />
              <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">No messaging profile</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Create a messaging profile to enable SMS/MMS sending through your phone numbers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 10DLC Campaigns Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">10DLC Campaigns</h3>
            <p className="text-sm text-slate-500 mt-1">Register messaging campaigns to enable A2P SMS on your phone numbers</p>
          </div>
          {brands.some(b => b.status === "OK" || b.identityStatus === "VERIFIED") && (
            <Sheet open={campaignSheetOpen} onOpenChange={setCampaignSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" data-testid="btn-open-create-campaign">
                  <Plus className="h-4 w-4 mr-2" />Create Campaign
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Create 10DLC Campaign</SheetTitle>
                  <SheetDescription>
                    Register a messaging campaign with The Campaign Registry. One-time fee: $2-10 + monthly fee.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label>Select Brand</Label>
                    <Select value={selectedBrandForCampaign} onValueChange={setSelectedBrandForCampaign}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a verified brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.filter(b => b.status === "OK" || b.identityStatus === "VERIFIED").map(brand => (
                          <SelectItem key={brand.brandId} value={brand.brandId || ""}>
                            {brand.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Use Case</Label>
                    <Select value={selectedUseCase} onValueChange={(value) => {
                      setSelectedUseCase(value);
                      setSelectedSubUseCases([]);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select messaging use case" />
                      </SelectTrigger>
                      <SelectContent>
                        {USE_CASES.map(uc => (
                          <SelectItem key={uc.value} value={uc.value}>
                            <div className="flex flex-col">
                              <span>{uc.label}</span>
                              <span className="text-xs text-slate-500">{uc.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {needsSubUseCases && (
                    <div className="space-y-3">
                      <div>
                        <Label>Select use case type for {selectedUseCase === "MIXED" ? "Mixed" : "Low Volume"} campaign type</Label>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedUseCase === "MIXED" 
                            ? "Select 2-5 sub use cases for your campaign" 
                            : "Select up to 5 sub use cases for your low volume campaign"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {SUB_USE_CASES.map(sub => (
                          <div 
                            key={sub.value}
                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                              selectedSubUseCases.includes(sub.value) 
                                ? "bg-primary/10 border-primary" 
                                : "hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                            onClick={() => toggleSubUseCase(sub.value)}
                          >
                            <input 
                              type="checkbox" 
                              checked={selectedSubUseCases.includes(sub.value)}
                              onChange={() => toggleSubUseCase(sub.value)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm">{sub.label}</span>
                          </div>
                        ))}
                      </div>
                      {selectedSubUseCases.length > 0 && (
                        <p className="text-xs text-slate-500">
                          Selected: {selectedSubUseCases.length}/{maxSubUseCases} 
                          {selectedUseCase === "MIXED" && selectedSubUseCases.length < minSubUseCases && 
                            ` (minimum ${minSubUseCases} required)`}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Campaign Description</Label>
                    <Input 
                      value={campaignDescription}
                      onChange={(e) => setCampaignDescription(e.target.value)}
                      placeholder="Brief description of your messaging campaign"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sample Message 1</Label>
                    <Input 
                      value={sampleMessage1}
                      onChange={(e) => setSampleMessage1(e.target.value)}
                      placeholder="Hi, this is a reminder about your appointment tomorrow at 2pm."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sample Message 2</Label>
                    <Input 
                      value={sampleMessage2}
                      onChange={(e) => setSampleMessage2(e.target.value)}
                      placeholder="Reply STOP to unsubscribe from these messages."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message Flow Description</Label>
                    <Input 
                      value={messageFlow}
                      onChange={(e) => setMessageFlow(e.target.value)}
                      placeholder="Describe how customers opt-in and opt-out"
                    />
                    <p className="text-xs text-slate-500">Explain how users consent to receive messages and how they can stop.</p>
                  </div>

                  {selectedUseCase && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">Carrier Terms Preview</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Registration Fee (3 months):</span>
                          <span className="font-medium">
                            {selectedUseCase === "LOW_VOLUME" ? "$6.00" : "$30.00"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Monthly Fee (after 3 months):</span>
                          <span className="font-medium">
                            {selectedUseCase === "LOW_VOLUME" ? "$2.00/mo" : "$10.00/mo"}
                          </span>
                        </div>
                        <div className="border-t pt-3 mt-3">
                          <p className="text-xs text-slate-500 font-medium mb-2">Carrier Throughput Limits:</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">T-Mobile:</span>
                              <span>{selectedUseCase === "LOW_VOLUME" ? "0.2 MPS" : "4+ MPS"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">AT&T:</span>
                              <span>{selectedUseCase === "LOW_VOLUME" ? "75 TPM" : "4,500 TPM"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Verizon:</span>
                              <span>Varies by trust score</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full mt-4"
                    onClick={() => createCampaignMutation.mutate()}
                    disabled={
                      createCampaignMutation.isPending || 
                      !selectedBrandForCampaign || 
                      !selectedUseCase ||
                      (needsSubUseCases && selectedSubUseCases.length < minSubUseCases)
                    }
                    data-testid="btn-submit-create-campaign"
                  >
                    {createCampaignMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating Campaign...</>
                    ) : (
                      "Submit Campaign Registration"
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <div className="p-6">
          {isLoadingCampaigns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : campaignsData?.campaigns && campaignsData.campaigns.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {campaignsData.campaigns.map((campaign) => {
                const status = campaign.status?.toUpperCase();
                let statusBadge;
                if (status === "ACTIVE" || status === "APPROVED") {
                  statusBadge = <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
                } else if (status === "PENDING" || status === "IN_REVIEW") {
                  statusBadge = <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
                } else if (status === "REJECTED" || status === "FAILED") {
                  statusBadge = <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
                } else {
                  statusBadge = <Badge variant="outline">{campaign.status || "Unknown"}</Badge>;
                }

                return (
                  <div key={campaign.campaignId} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            {USE_CASES.find(uc => uc.value === campaign.usecase)?.label || campaign.usecase}
                          </h4>
                          <p className="text-sm text-slate-500 mt-0.5">{campaign.description}</p>
                          <p className="text-xs text-slate-400 mt-1 font-mono">Campaign ID: {campaign.campaignId}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {statusBadge}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-12 w-12 text-slate-300 mb-4" />
              <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">No 10DLC campaigns</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                {brands.some(b => b.status === "OK" || b.identityStatus === "VERIFIED") 
                  ? "Create a campaign to start sending A2P messages through your phone numbers."
                  : "You need a verified brand before you can create a campaign."}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Toll-Free Verification</h3>
            <p className="text-sm text-slate-500 mt-1">Verify toll-free numbers (800, 888, 877, etc.) for SMS/MMS messaging</p>
          </div>
          {!isLoadingTollFree && (!tollFreeData?.verifications || tollFreeData.verifications.length === 0) && (
            <Button 
              disabled
              data-testid="btn-submit-toll-free-verification"
            >
              <Plus className="h-4 w-4 mr-2" />Submit Verification
            </Button>
          )}
        </div>

        <div className="p-6">
          {isLoadingTollFree ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : tollFreeData?.verifications && tollFreeData.verifications.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tollFreeData.verifications.map((verification) => {
                const status = verification.verificationStatus?.toUpperCase();
                let statusBadge;
                if (status === "VERIFIED") {
                  statusBadge = <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
                } else if (["PENDING", "IN PROGRESS", "WAITING FOR VENDOR", "WAITING FOR TELNYX"].includes(status)) {
                  statusBadge = <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />{verification.verificationStatus}</Badge>;
                } else if (status === "WAITING FOR CUSTOMER") {
                  statusBadge = <Badge className="bg-orange-100 text-orange-800 border-orange-200"><AlertTriangle className="h-3 w-3 mr-1" />Waiting For Customer</Badge>;
                } else if (status === "REJECTED") {
                  statusBadge = <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
                } else {
                  statusBadge = <Badge variant="outline">{verification.verificationStatus || "Unknown"}</Badge>;
                }

                return (
                  <div key={verification.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">{verification.businessName}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-500">
                              {verification.phoneNumbers?.length || 0} phone number{(verification.phoneNumbers?.length || 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 font-mono">ID: {verification.id}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {statusBadge}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="h-12 w-12 text-slate-300 mb-4" />
              <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300">No toll-free verifications</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Submit a verification request to enable messaging on your toll-free numbers.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          What is 10DLC?
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
          10DLC (10-Digit Long Code) is the standard for Application-to-Person (A2P) messaging in the United States. 
          All businesses sending SMS must register their brand and campaigns with The Campaign Registry (TCR).
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
            <p className="font-medium text-slate-900 dark:text-white">Step 1: Brand</p>
            <p className="text-slate-500 text-xs mt-1">Register your business identity ($4 one-time)</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
            <p className="font-medium text-slate-900 dark:text-white">Step 2: Campaign</p>
            <p className="text-slate-500 text-xs mt-1">Define your messaging use case ($2-10/mo)</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-3">
            <p className="font-medium text-slate-900 dark:text-white">Step 3: Numbers</p>
            <p className="text-slate-500 text-xs mt-1">Assign phone numbers to your campaign</p>
          </div>
        </div>
      </div>
    </div>
  );
}
