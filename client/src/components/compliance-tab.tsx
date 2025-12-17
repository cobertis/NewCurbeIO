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
  AlertCircle,
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
  { value: "2FA", label: "2FA" },
  { value: "ACCOUNT_NOTIFICATION", label: "Account Notification" },
  { value: "CHARITY", label: "Charity" },
  { value: "CUSTOMER_CARE", label: "Customer Care" },
  { value: "DELIVERY_NOTIFICATION", label: "Delivery Notification" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "FRAUD_ALERT", label: "Fraud Alert Messaging" },
  { value: "HIGHER_EDUCATION", label: "Higher Education" },
  { value: "LOW_VOLUME", label: "Low Volume Mixed" },
  { value: "M2M", label: "Machine to Machine" },
  { value: "MARKETING", label: "Marketing" },
  { value: "MIXED", label: "Mixed" },
  { value: "PLATFORM_FREE_TRIAL", label: "Platform Free Trial" },
  { value: "POLITICAL", label: "Political" },
  { value: "POLLING_VOTING", label: "Polling and voting" },
  { value: "PROXY", label: "Proxy" },
  { value: "PUBLIC_SERVICE_ANNOUNCEMENT", label: "Public Service Announcement" },
  { value: "SECURITY_ALERT", label: "Security Alert" },
  { value: "SOCIAL", label: "Social" },
  { value: "UCAAS_LOW_VOLUME", label: "UCaaS Low Volume" },
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

  const [showCampaignWizard, setShowCampaignWizard] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [selectedBrandForCampaign, setSelectedBrandForCampaign] = useState<string>("");
  const [selectedUseCase, setSelectedUseCase] = useState<string>("");
  const [selectedSubUseCases, setSelectedSubUseCases] = useState<string[]>([]);
  const [campaignDescription, setCampaignDescription] = useState<string>("");
  const [campaignVertical, setCampaignVertical] = useState<string>("");
  const [sampleMessage1, setSampleMessage1] = useState<string>("");
  const [sampleMessage2, setSampleMessage2] = useState<string>("");
  const [messageFlow, setMessageFlow] = useState<string>("Customers opt-in via our website or in-person sign-up form. They can opt-out at any time by replying STOP.");
  const [optInKeywords, setOptInKeywords] = useState<string>("START,YES");
  const [optOutKeywords, setOptOutKeywords] = useState<string>("STOP,UNSUBSCRIBE");
  const [helpKeywords, setHelpKeywords] = useState<string>("HELP");
  const [optInMessage, setOptInMessage] = useState<string>("");
  const [optOutMessage, setOptOutMessage] = useState<string>("");
  const [helpMessage, setHelpMessage] = useState<string>("");
  const [privacyPolicyLink, setPrivacyPolicyLink] = useState<string>("");
  const [termsAndConditionsLink, setTermsAndConditionsLink] = useState<string>("");
  const [embeddedLinkSample, setEmbeddedLinkSample] = useState<string>("");
  const [embeddedLink, setEmbeddedLink] = useState<boolean>(false);
  const [embeddedPhone, setEmbeddedPhone] = useState<boolean>(false);
  const [numberPool, setNumberPool] = useState<boolean>(false);
  const [ageGated, setAgeGated] = useState<boolean>(false);
  const [directLending, setDirectLending] = useState<boolean>(false);
  const [subscriberOptin, setSubscriberOptin] = useState<boolean>(true);
  const [subscriberOptout, setSubscriberOptout] = useState<boolean>(true);
  const [subscriberHelp, setSubscriberHelp] = useState<boolean>(true);
  const [webhookURL, setWebhookURL] = useState<string>("");
  const [webhookFailoverURL, setWebhookFailoverURL] = useState<string>("");
  const [sampleMessage3, setSampleMessage3] = useState<string>("");
  const [sampleMessage4, setSampleMessage4] = useState<string>("");
  const [sampleMessage5, setSampleMessage5] = useState<string>("");

  const CARRIER_TERMS = [
    { carrier: "AT&T", qualify: "Yes", mnoReview: "No", surcharge: "N/A", smsTpm: "240", mmsTpm: "150", brandTier: "-", dailyLimit: "-", messageClass: "F" },
    { carrier: "T-Mobile", qualify: "Yes", mnoReview: "No", surcharge: "N/A", smsTpm: "N/A", mmsTpm: "N/A", brandTier: "LOW", dailyLimit: "2000", messageClass: "N/A" },
    { carrier: "US Cellular", qualify: "Yes", mnoReview: "No", surcharge: "N/A", smsTpm: "N/A", mmsTpm: "N/A", brandTier: "-", dailyLimit: "-", messageClass: "N/A" },
    { carrier: "Verizon Wireless", qualify: "Yes", mnoReview: "No", surcharge: "N/A", smsTpm: "N/A", mmsTpm: "N/A", brandTier: "-", dailyLimit: "-", messageClass: "N/A" },
    { carrier: "ClearSky", qualify: "Yes", mnoReview: "No", surcharge: "N/A", smsTpm: "N/A", mmsTpm: "N/A", brandTier: "-", dailyLimit: "-", messageClass: "N/A" },
    { carrier: "Interop", qualify: "Yes", mnoReview: "No", surcharge: "N/A", smsTpm: "N/A", mmsTpm: "N/A", brandTier: "-", dailyLimit: "-", messageClass: "N/A" },
  ];

  const resetCampaignForm = () => {
    setCampaignStep(1);
    setSelectedBrandForCampaign("");
    setSelectedUseCase("");
    setSelectedSubUseCases([]);
    setCampaignDescription("");
    setCampaignVertical("");
    setSampleMessage1("");
    setSampleMessage2("");
    setSampleMessage3("");
    setSampleMessage4("");
    setSampleMessage5("");
    setMessageFlow("Customers opt-in via our website or in-person sign-up form. They can opt-out at any time by replying STOP.");
    setOptInKeywords("START,YES");
    setOptOutKeywords("STOP,UNSUBSCRIBE");
    setHelpKeywords("HELP");
    setOptInMessage("");
    setOptOutMessage("");
    setHelpMessage("");
    setPrivacyPolicyLink("");
    setTermsAndConditionsLink("");
    setEmbeddedLinkSample("");
    setEmbeddedLink(false);
    setEmbeddedPhone(false);
    setNumberPool(false);
    setAgeGated(false);
    setDirectLending(false);
    setSubscriberOptin(true);
    setSubscriberOptout(true);
    setSubscriberHelp(true);
    setWebhookURL("");
    setWebhookFailoverURL("");
  };

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
        usecase: selectedUseCase,
        subUsecases: needsSubUseCases ? selectedSubUseCases : undefined,
        description: campaignDescription,
        sample1: sampleMessage1,
        sample2: sampleMessage2,
        sample3: sampleMessage3 || undefined,
        sample4: sampleMessage4 || undefined,
        sample5: sampleMessage5 || undefined,
        messageFlow,
        optinKeywords: optInKeywords,
        optinMessage: optInMessage,
        optoutKeywords: optOutKeywords,
        optoutMessage: optOutMessage,
        helpKeywords: helpKeywords,
        helpMessage: helpMessage,
        subscriberOptin,
        subscriberOptout,
        subscriberHelp,
        embeddedLink,
        embeddedPhone,
        numberPool,
        ageGated,
        directLending,
        privacyPolicyLink: privacyPolicyLink || undefined,
        termsAndConditionsLink: termsAndConditionsLink || undefined,
        embeddedLinkSample: embeddedLinkSample || undefined,
        webhookURL: webhookURL || undefined,
        webhookFailoverURL: webhookFailoverURL || undefined,
        termsAndConditions: true,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/phone-system/campaigns"] });
      toast({ title: "Campaign created", description: "Your 10DLC campaign has been submitted for approval." });
      setShowCampaignWizard(false);
      resetCampaignForm();
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

  // Campaign Wizard - Full Width Main Content
  if (showCampaignWizard) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Create a campaign</h2>
          </div>
          <div className="p-6">
            <div className="flex gap-8">
              {/* Main Content */}
              <div className="flex-1 max-w-4xl">
                {campaignStep === 1 && (
                  <div className="space-y-6">
                    <h3 className="font-semibold text-lg">Campaign use case</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Select value={selectedBrandForCampaign} onValueChange={setSelectedBrandForCampaign}>
                          <SelectTrigger><SelectValue placeholder="Please select" /></SelectTrigger>
                          <SelectContent>
                            {brands.filter(b => b.status === "OK" || b.identityStatus === "VERIFIED").map(brand => (
                              <SelectItem key={brand.brandId} value={brand.brandId || ""}>{brand.displayName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Use case</Label>
                        <Select value={selectedUseCase} onValueChange={(value) => { setSelectedUseCase(value); setSelectedSubUseCases([]); }}>
                          <SelectTrigger><SelectValue placeholder="Please select" /></SelectTrigger>
                          <SelectContent>
                            {USE_CASES.map(uc => (<SelectItem key={uc.value} value={uc.value}>{uc.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {needsSubUseCases && (
                      <div className="space-y-3">
                        <Label>Select use case type for {selectedUseCase === "MIXED" ? "Mixed" : "Low Volume"} campaign type</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {SUB_USE_CASES.map(sub => (
                            <div key={sub.value} className={`flex items-center gap-2 p-3 rounded border cursor-pointer ${selectedSubUseCases.includes(sub.value) ? "bg-primary/10 border-primary" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`} onClick={() => toggleSubUseCase(sub.value)}>
                              <input type="checkbox" checked={selectedSubUseCases.includes(sub.value)} onChange={() => toggleSubUseCase(sub.value)} className="h-4 w-4" />
                              <span className="text-sm">{sub.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-6">
                      <Button onClick={() => setCampaignStep(2)} disabled={!selectedBrandForCampaign || !selectedUseCase || (needsSubUseCases && selectedSubUseCases.length < minSubUseCases)}>Next</Button>
                      <Button variant="outline" onClick={() => { setShowCampaignWizard(false); resetCampaignForm(); }}>Cancel</Button>
                    </div>
                  </div>
                )}

                {campaignStep === 2 && (
                  <div className="space-y-6">
                    <h3 className="font-semibold text-lg">Carrier terms preview</h3>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                      The terms displayed in this page may be subject to change at the sole discretion of the mobile network operator.
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Carrier</th>
                            <th className="text-left py-2 font-medium">Qualify</th>
                            <th className="text-left py-2 font-medium">MNO Review</th>
                            <th className="text-left py-2 font-medium">Surcharge</th>
                            <th className="text-left py-2 font-medium">SMS TPM</th>
                            <th className="text-left py-2 font-medium">MMS TPM</th>
                            <th className="text-left py-2 font-medium">Brand Tier</th>
                            <th className="text-left py-2 font-medium">Daily Limit</th>
                            <th className="text-left py-2 font-medium">Message Class</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CARRIER_TERMS.map(ct => (
                            <tr key={ct.carrier} className="border-b">
                              <td className="py-2">{ct.carrier}</td>
                              <td className="py-2">{ct.qualify}</td>
                              <td className="py-2">{ct.mnoReview}</td>
                              <td className="py-2">{ct.surcharge}</td>
                              <td className="py-2">{ct.smsTpm}</td>
                              <td className="py-2">{ct.mmsTpm}</td>
                              <td className="py-2">{ct.brandTier}</td>
                              <td className="py-2">{ct.dailyLimit}</td>
                              <td className="py-2">{ct.messageClass}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2 pt-6">
                      <Button onClick={() => setCampaignStep(3)}>Next</Button>
                      <Button variant="outline" onClick={() => setCampaignStep(1)}>Back</Button>
                    </div>
                  </div>
                )}

                {campaignStep === 3 && (
                  <div className="space-y-6">
                    <h3 className="font-semibold text-lg">Campaign details</h3>
                    
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-600 dark:text-slate-300">
                      Ideally this should match Brand Vertical.
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Vertical
                        <span className="text-slate-400 cursor-help" title="The industry vertical for this campaign">?</span>
                      </Label>
                      <Select value={campaignVertical} onValueChange={setCampaignVertical}>
                        <SelectTrigger className="w-full md:w-1/2">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {VERTICALS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Content details</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Campaign Description <span className="text-red-500">*</span></Label>
                          <textarea className="w-full min-h-[100px] p-3 border rounded-md text-sm" value={campaignDescription} onChange={(e) => setCampaignDescription(e.target.value)} placeholder="Your selected Use Case(s) from Brand Name. EX: Customer care Messages for Telnyx" />
                        </div>
                        <div className="space-y-2">
                          <Label>Opt In Workflow Description (Message Flow) <span className="text-red-500">*</span></Label>
                          <textarea className="w-full min-h-[100px] p-3 border rounded-md text-sm" value={messageFlow} onChange={(e) => setMessageFlow(e.target.value)} placeholder="Digital: Customer opt in via the following LINK which they get to via (describe path)." />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Keywords</h4>
                      <div className="grid grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label>Opt in keywords <span className="text-red-500">*</span></Label>
                          <Input value={optInKeywords} onChange={(e) => setOptInKeywords(e.target.value)} placeholder="START,YES" />
                        </div>
                        <div className="space-y-2">
                          <Label>Opt out keywords <span className="text-red-500">*</span></Label>
                          <Input value={optOutKeywords} onChange={(e) => setOptOutKeywords(e.target.value)} placeholder="STOP,UNSUBSCRIBE" />
                        </div>
                        <div className="space-y-2">
                          <Label>Help keywords <span className="text-red-500">*</span></Label>
                          <Input value={helpKeywords} onChange={(e) => setHelpKeywords(e.target.value)} placeholder="HELP" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Auto-responses</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Opt in message <span className="text-red-500">*</span></Label>
                          <textarea className="w-full min-h-[80px] p-3 border rounded-md text-sm" value={optInMessage} onChange={(e) => setOptInMessage(e.target.value)} placeholder="[Brand name]: Thanks for subscribing! Reply HELP for help. Msg&data rates may apply. Reply STOP to opt out." />
                        </div>
                        <div className="space-y-2">
                          <Label>Opt out message <span className="text-red-500">*</span></Label>
                          <textarea className="w-full min-h-[80px] p-3 border rounded-md text-sm" value={optOutMessage} onChange={(e) => setOptOutMessage(e.target.value)} placeholder="[Brand Name]: You are unsubscribed and will receive no further messages." />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Help message <span className="text-red-500">*</span></Label>
                        <textarea className="w-full min-h-[80px] p-3 border rounded-md text-sm" value={helpMessage} onChange={(e) => setHelpMessage(e.target.value)} placeholder="[Brand name]: Please reach out to us at [website/email/toll free number] for help." />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Sample messages</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Message 1 <span className="text-red-500">*</span></Label>
                          <textarea className="w-full min-h-[80px] p-3 border rounded-md text-sm" value={sampleMessage1} onChange={(e) => setSampleMessage1(e.target.value)} placeholder="Marketing: Thanks for subscribing! Use promo code: 20OFF for $20 off! Reply STOP to opt out." />
                        </div>
                        <div className="space-y-2">
                          <Label>Message 2 {(selectedUseCase === "MARKETING" || selectedUseCase === "MIXED") && <span className="text-red-500">*</span>}</Label>
                          <textarea className="w-full min-h-[80px] p-3 border rounded-md text-sm" value={sampleMessage2} onChange={(e) => setSampleMessage2(e.target.value)} placeholder="Account Notification: Your Password has been reset." />
                          {(selectedUseCase === "MARKETING" || selectedUseCase === "MIXED") && <p className="text-xs text-amber-600">Required for Marketing or Mixed campaigns</p>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Compliance links</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Privacy policy</Label>
                          <Input value={privacyPolicyLink} onChange={(e) => setPrivacyPolicyLink(e.target.value)} placeholder="Link to the campaign's privacy policy" />
                        </div>
                        <div className="space-y-2">
                          <Label>Terms and conditions</Label>
                          <Input value={termsAndConditionsLink} onChange={(e) => setTermsAndConditionsLink(e.target.value)} placeholder="Link to the campaign's terms and conditions" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Embedded link sample</Label>
                        <Input value={embeddedLinkSample} onChange={(e) => setEmbeddedLinkSample(e.target.value)} placeholder="Sample of a link that will be sent to subscribers" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Campaign and content attributes</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Embedded Link</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1"><input type="radio" checked={embeddedLink} onChange={() => setEmbeddedLink(true)} /> Yes</label>
                            <label className="flex items-center gap-1"><input type="radio" checked={!embeddedLink} onChange={() => setEmbeddedLink(false)} /> No</label>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Embedded Phone</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1"><input type="radio" checked={embeddedPhone} onChange={() => setEmbeddedPhone(true)} /> Yes</label>
                            <label className="flex items-center gap-1"><input type="radio" checked={!embeddedPhone} onChange={() => setEmbeddedPhone(false)} /> No</label>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Number Pooling</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1"><input type="radio" checked={numberPool} onChange={() => setNumberPool(true)} /> Yes</label>
                            <label className="flex items-center gap-1"><input type="radio" checked={!numberPool} onChange={() => setNumberPool(false)} /> No</label>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <span>Age-Gated Content</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1"><input type="radio" checked={ageGated} onChange={() => setAgeGated(true)} /> Yes</label>
                            <label className="flex items-center gap-1"><input type="radio" checked={!ageGated} onChange={() => setAgeGated(false)} /> No</label>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded col-span-2">
                          <span>Direct Lending or Loan Arrangement</span>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1"><input type="radio" checked={directLending} onChange={() => setDirectLending(true)} /> Yes</label>
                            <label className="flex items-center gap-1"><input type="radio" checked={!directLending} onChange={() => setDirectLending(false)} /> No</label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 border-b pb-2">Webhooks</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Webhook URL</Label>
                          <Input value={webhookURL} onChange={(e) => setWebhookURL(e.target.value)} placeholder="Where you will receive provisioning status updates" />
                        </div>
                        <div className="space-y-2">
                          <Label>Webhook Failover URL</Label>
                          <Input value={webhookFailoverURL} onChange={(e) => setWebhookFailoverURL(e.target.value)} placeholder="Failover webhook URL" />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-6">
                      <Button onClick={() => setCampaignStep(4)} disabled={!campaignDescription || !messageFlow || !optInMessage || !optOutMessage || !helpMessage || !sampleMessage1}>Next</Button>
                      <Button variant="outline" onClick={() => setCampaignStep(2)}>Back</Button>
                    </div>
                  </div>
                )}

                {campaignStep === 4 && (
                  <div className="space-y-6">
                    <h3 className="font-semibold text-lg">Payment and confirmation</h3>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border space-y-3">
                      <div className="flex justify-between"><span>Registration Fee (3 months):</span><span className="font-medium">{selectedUseCase === "LOW_VOLUME" || selectedUseCase === "UCAAS_LOW_VOLUME" ? "$6.00" : selectedUseCase === "CHARITY" ? "$15.00" : "$30.00"}</span></div>
                      <div className="flex justify-between"><span>Monthly Fee (after):</span><span className="font-medium">{selectedUseCase === "LOW_VOLUME" || selectedUseCase === "UCAAS_LOW_VOLUME" ? "$2.00/mo" : selectedUseCase === "CHARITY" ? "$5.00/mo" : "$10.00/mo"}</span></div>
                    </div>
                    <div className="p-4 border rounded-lg space-y-2">
                      <p className="font-medium">Campaign Summary</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Brand: {brands.find(b => b.brandId === selectedBrandForCampaign)?.displayName}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Use Case: {USE_CASES.find(uc => uc.value === selectedUseCase)?.label}</p>
                      {needsSubUseCases && <p className="text-sm text-slate-600 dark:text-slate-400">Sub Use Cases: {selectedSubUseCases.join(", ")}</p>}
                    </div>
                    <div className="flex gap-2 pt-6">
                      <Button onClick={() => createCampaignMutation.mutate()} disabled={createCampaignMutation.isPending || !campaignDescription || !sampleMessage1}>
                        {createCampaignMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : "Submit Campaign"}
                      </Button>
                      <Button variant="outline" onClick={() => setCampaignStep(3)}>Back</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step Sidebar */}
              <div className="w-56 border-l pl-6">
                <div className="space-y-3 text-sm sticky top-6">
                  <div className={`py-2 ${campaignStep === 1 ? "text-primary font-medium border-l-2 border-primary pl-3 -ml-[25px]" : "text-slate-500 pl-3"}`}>1. Campaign use case</div>
                  <div className={`py-2 ${campaignStep === 2 ? "text-primary font-medium border-l-2 border-primary pl-3 -ml-[25px]" : "text-slate-500 pl-3"}`}>2. Carrier terms preview</div>
                  <div className={`py-2 ${campaignStep === 3 ? "text-primary font-medium border-l-2 border-primary pl-3 -ml-[25px]" : "text-slate-500 pl-3"}`}>3. Campaign details</div>
                  <div className={`py-2 ${campaignStep === 4 ? "text-primary font-medium border-l-2 border-primary pl-3 -ml-[25px]" : "text-slate-500 pl-3"}`}>4. Payment and confirmation</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <Button size="sm" data-testid="btn-open-create-campaign" onClick={() => setShowCampaignWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />Create Campaign
            </Button>
          )}
        </div>

        {/* Campaign Fee Notice */}
        <div className="mx-6 mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Please note that campaigns are charged a $15 review fee by the carriers each time they are submitted for carrier compliance review. This includes resubmissions following carrier rejections.
          </p>
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
