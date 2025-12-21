import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Check, ArrowLeft, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { StepIndicator } from "@/components/compliance/step-indicator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import type { ComplianceApplication } from "@shared/schema";

const steps = [
  { id: "number", label: "Number" },
  { id: "info", label: "Info" },
  { id: "brand", label: "Brand" },
  { id: "campaign", label: "Campaign" },
  { id: "review", label: "Review" },
];

const legalFormOptions = [
  { value: "GOVERNMENT", label: "Government or State Organisation" },
  { value: "PUBLIC_PROFIT", label: "Public Utility" },
  { value: "PRIVATE_PROFIT", label: "Registered Corporation" },
  { value: "SOLE_PROPRIETOR", label: "Sole Proprietor" },
  { value: "NON_PROFIT", label: "Non-Profit Organization" },
];

const verticalOptions = [
  { value: "AGRICULTURE", label: "Agriculture" },
  { value: "COMMUNICATION", label: "Communication and mass media" },
  { value: "CONSTRUCTION", label: "Construction and materials" },
  { value: "EDUCATION", label: "Education" },
  { value: "ENERGY", label: "Energy and utilities" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "GAMBLING", label: "Gambling" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "HOSPITALITY", label: "Hospitality" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "NGO", label: "NGO" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "RETAIL", label: "Retail" },
  { value: "TECHNOLOGY", label: "Technology" },
];

const usStates = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const countryOptions = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

const stateNameToCode: Record<string, string> = Object.fromEntries(
  usStates.map(s => [s.label.toLowerCase(), s.value])
);

function normalizeStateCode(stateValue: string): string {
  if (!stateValue) return "";
  if (stateValue.length === 2 && usStates.some(s => s.value === stateValue.toUpperCase())) {
    return stateValue.toUpperCase();
  }
  return stateNameToCode[stateValue.toLowerCase()] || stateValue;
}

function normalizeCountryCode(countryValue: string): string {
  if (!countryValue) return "US";
  const lower = countryValue.toLowerCase();
  if (lower === "us" || lower === "united states" || lower === "usa") return "US";
  if (lower === "ca" || lower === "canada") return "CA";
  return countryValue;
}

const brandFormSchema = z.object({
  legalName: z.string().min(1, "Legal name is required"),
  brandName: z.string().optional(),
  legalForm: z.string().min(1, "Legal form is required"),
  website: z.string().url("Please enter a valid URL").min(1, "Website is required"),
  vertical: z.string().min(1, "Industry is required"),
  ein: z.string().optional(),
  street: z.string().min(1, "Address is required"),
  streetLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Zip code is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Please enter a valid email").min(1, "Email is required"),
});

type BrandFormData = z.infer<typeof brandFormSchema>;

export default function ComplianceBrand() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/compliance/brand/:id");
  const applicationId = params?.id;
  const { toast } = useToast();
  
  const [openStep, setOpenStep] = useState<number>(1);
  const [step1Complete, setStep1Complete] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);
  const [step3Complete, setStep3Complete] = useState(false);
  const [brandNameManuallyEdited, setBrandNameManuallyEdited] = useState(false);
  
  const { data: application, isLoading } = useQuery<ComplianceApplication>({
    queryKey: [`/api/compliance/applications/${applicationId}`],
    enabled: !!applicationId,
  });

  const currentStep = 2;
  const isTollFree = application?.numberType === "toll_free";
  
  const title = isTollFree 
    ? "Register toll-free texting brand" 
    : "Register 10DLC texting brand";

  const form = useForm<BrandFormData>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      legalName: "",
      brandName: "",
      legalForm: "",
      website: "",
      vertical: "",
      ein: "",
      street: "",
      streetLine2: "",
      city: "",
      postalCode: "",
      state: "",
      country: "US",
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    },
  });

  const legalNameValue = form.watch("legalName");
  
  useEffect(() => {
    if (!brandNameManuallyEdited && legalNameValue) {
      form.setValue("brandName", legalNameValue);
    }
  }, [legalNameValue, brandNameManuallyEdited, form]);

  // Load saved data from application
  useEffect(() => {
    if (application) {
      // Step 1 fields
      if (application.businessName) form.setValue("legalName", application.businessName);
      if (application.brandDisplayName) form.setValue("brandName", application.brandDisplayName);
      if (application.businessType) form.setValue("legalForm", application.businessType);
      if (application.website) form.setValue("website", application.website);
      if (application.businessVertical) form.setValue("vertical", application.businessVertical);
      if (application.ein) form.setValue("ein", application.ein);
      
      // Step 2 fields
      if (application.businessAddress) form.setValue("street", application.businessAddress);
      if (application.businessAddressLine2) form.setValue("streetLine2", application.businessAddressLine2);
      if (application.businessCity) form.setValue("city", application.businessCity);
      if (application.businessState) form.setValue("state", application.businessState);
      if (application.businessZip) form.setValue("postalCode", application.businessZip);
      if (application.country) form.setValue("country", application.country);
      
      // Step 3 fields
      if (application.contactFirstName) form.setValue("firstName", application.contactFirstName);
      if (application.contactLastName) form.setValue("lastName", application.contactLastName);
      if (application.contactPhone) form.setValue("phone", application.contactPhone);
      if (application.contactEmail) form.setValue("email", application.contactEmail);
      
      // Check step completion based on saved data
      const hasStep1 = application.businessName && application.businessType && application.website && application.businessVertical;
      const hasStep2 = application.businessAddress && application.businessCity && application.businessState && application.businessZip && application.country;
      const hasStep3 = application.contactFirstName && application.contactLastName && application.contactPhone && application.contactEmail;
      
      if (hasStep1) setStep1Complete(true);
      if (hasStep2) setStep2Complete(true);
      if (hasStep3) setStep3Complete(true);
      
      // Set open step based on progress
      if (hasStep3) setOpenStep(3);
      else if (hasStep2) setOpenStep(3);
      else if (hasStep1) setOpenStep(2);
    }
  }, [application, form]);

  const createBrandMutation = useMutation({
    mutationFn: async (data: BrandFormData) => {
      const payload = {
        entityType: data.legalForm,
        displayName: data.brandName || data.legalName,
        companyName: data.legalName,
        country: data.country,
        email: data.email,
        vertical: data.vertical,
        ein: data.ein,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        street: data.street,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        website: data.website,
      };
      return apiRequest("POST", "/api/phone-system/brands", payload);
    },
    onSuccess: async (result) => {
      await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
        brandId: result.id,
        currentStep: 4,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
      toast({
        title: "Brand registered successfully",
        description: "Your brand has been submitted for verification.",
      });
      setLocation(`/compliance/campaign/${applicationId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error registering brand",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleStep1Save = async () => {
    const { legalName, brandName, legalForm, website, vertical, ein } = form.getValues();
    if (legalName && legalForm && website && vertical) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          businessName: legalName,
          brandDisplayName: brandName || legalName,
          businessType: legalForm,
          website: website,
          businessVertical: vertical,
          ein: ein,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        setStep1Complete(true);
        setOpenStep(0);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } else {
      form.trigger(["legalName", "legalForm", "website", "vertical"]);
    }
  };

  const handleStep2Save = async () => {
    const { street, streetLine2, city, postalCode, state, country } = form.getValues();
    if (street && city && postalCode && state && country) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          businessAddress: street,
          businessAddressLine2: streetLine2,
          businessCity: city,
          businessState: state,
          businessZip: postalCode,
          country: country,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        setStep2Complete(true);
        setOpenStep(0);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } else {
      form.trigger(["street", "city", "postalCode", "state", "country"]);
    }
  };

  const handleStep3Save = async () => {
    const { firstName, lastName, phone, email } = form.getValues();
    if (firstName && lastName && phone && email) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          contactFirstName: firstName,
          contactLastName: lastName,
          contactPhone: phone,
          contactEmail: email,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        setStep3Complete(true);
        setOpenStep(0);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } else {
      form.trigger(["firstName", "lastName", "phone", "email"]);
    }
  };

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      try {
        const data = form.getValues();
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          businessName: data.legalName,
          brandDisplayName: data.brandName || data.legalName,
          businessType: data.legalForm,
          website: data.website,
          businessVertical: data.vertical,
          ein: data.ein,
          businessAddress: data.street,
          businessAddressLine2: data.streetLine2,
          businessCity: data.city,
          businessState: data.state,
          businessZip: data.postalCode,
          country: data.country,
          contactFirstName: data.firstName,
          contactLastName: data.lastName,
          contactPhone: data.phone,
          contactEmail: data.email,
          currentStep: 4,
          status: "step_3_complete",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        toast({
          title: "Brand info saved",
          description: "Continuing to campaign registration.",
        });
        setLocation(`/compliance/campaign/${applicationId}`);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    }
  };

  // Auto-save current step data silently when switching steps
  const autoSaveCurrentStep = async (currentOpenStep: number) => {
    const values = form.getValues();
    try {
      if (currentOpenStep === 1) {
        const { legalName, brandName, legalForm, website, vertical, ein } = values;
        if (legalName || legalForm || website || vertical || ein) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            businessName: legalName,
            brandDisplayName: brandName || legalName,
            businessType: legalForm,
            website: website,
            businessVertical: vertical,
            ein: ein,
          });
        }
      } else if (currentOpenStep === 2) {
        const { street, streetLine2, city, postalCode, state, country } = values;
        if (street || city || postalCode || state) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            businessAddress: street,
            businessAddressLine2: streetLine2,
            businessCity: city,
            businessState: state,
            businessZip: postalCode,
            country: country,
          });
        }
      } else if (currentOpenStep === 3) {
        const { firstName, lastName, phone, email } = values;
        if (firstName || lastName || phone || email) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            contactFirstName: firstName,
            contactLastName: lastName,
            contactPhone: phone,
            contactEmail: email,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
    } catch (error) {
      // Silent save - don't show error toast
      console.log("[AutoSave] Error saving step data:", error);
    }
  };

  const handleStepChange = async (targetStep: number) => {
    // Save current step before switching
    if (openStep !== 0 && openStep !== targetStep) {
      await autoSaveCurrentStep(openStep);
    }
    setOpenStep(openStep === targetStep ? 0 : targetStep);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3" data-testid="text-page-title">
            {title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            For more information about filling out this form, watch our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-video-guide">
              video guide
            </a>
            {" "}or read our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-support-article">
              support article
            </a>.
          </p>
        </div>

        <StepIndicator currentStep={2} />

        <Card className="bg-white dark:bg-gray-900 shadow-sm">
          <CardContent className="p-0">
            <Collapsible open={openStep === 1} onOpenChange={() => handleStepChange(1)}>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Step 1: Organization details
                </span>
                <div className="flex items-center gap-2">
                  {step1Complete && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openStep === 1 && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Legal name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Enter organization name"
                      className="mt-1.5"
                      {...form.register("legalName")}
                      data-testid="input-legal-name"
                    />
                    {form.formState.errors.legalName && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.legalName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Brand name (if different)
                    </Label>
                    <Input
                      placeholder="Enter brand name"
                      className="mt-1.5"
                      {...form.register("brandName", {
                        onChange: () => setBrandNameManuallyEdited(true)
                      })}
                      data-testid="input-brand-name"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Legal form <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("legalForm")}
                      onValueChange={(value) => form.setValue("legalForm", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-legal-form">
                        <SelectValue placeholder="- Select form of the organization -" />
                      </SelectTrigger>
                      <SelectContent>
                        {legalFormOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.legalForm && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.legalForm.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Website <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="https://www.company.com"
                      className="mt-1.5"
                      {...form.register("website")}
                      data-testid="input-website"
                    />
                    {form.formState.errors.website && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.website.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Vertical / Industry <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("vertical")}
                      onValueChange={(value) => form.setValue("vertical", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-vertical">
                        <SelectValue placeholder="- Select vertical type -" />
                      </SelectTrigger>
                      <SelectContent>
                        {verticalOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-gray-500 text-xs mt-1">Select the option closest to your industry.</p>
                    {form.formState.errors.vertical && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.vertical.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Business registration number (EIN) <span className="text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      placeholder="XX-XXXXXXX"
                      className="mt-1.5"
                      maxLength={10}
                      {...form.register("ein", {
                        onChange: (e) => {
                          let value = e.target.value.replace(/[^0-9]/g, '');
                          if (value.length > 2) {
                            value = value.slice(0, 2) + '-' + value.slice(2, 9);
                          }
                          form.setValue("ein", value);
                        }
                      })}
                      data-testid="input-ein"
                    />
                    <p className="text-gray-500 text-xs mt-1">Correct EIN format: XX-XXXXXXX</p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-6 bg-blue-600 hover:bg-blue-700"
                  onClick={handleStep1Save}
                  data-testid="button-save-step1"
                >
                  Save and continue
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            <Collapsible open={openStep === 2} onOpenChange={() => handleStepChange(2)}>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Step 2: Organization address
                </span>
                <div className="flex items-center gap-2">
                  {step2Complete && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openStep === 2 && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <p className="text-gray-500 text-sm mb-4">Enter the address exactly as shown on your IRS documents.</p>
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <Label className="text-gray-700 dark:text-gray-300">
                      Address Line 1 <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-1.5">
                      <GooglePlacesAddressAutocomplete
                        value={form.watch("street")}
                        onChange={(value) => form.setValue("street", value)}
                        onAddressSelect={(address) => {
                          form.setValue("street", address.street);
                          form.setValue("city", address.city);
                          form.setValue("postalCode", address.postalCode);
                          form.setValue("state", normalizeStateCode(address.state));
                          form.setValue("country", normalizeCountryCode(address.country));
                        }}
                        label=""
                        placeholder="Start typing your address..."
                        testId="input-street"
                      />
                    </div>
                    {form.formState.errors.street && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.street.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Address Line 2
                    </Label>
                    <Input
                      placeholder="Apt, Suite, Unit"
                      className="mt-1.5"
                      {...form.register("streetLine2")}
                      data-testid="input-street-line2"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Enter city"
                      className="mt-1.5"
                      {...form.register("city")}
                      data-testid="input-city"
                    />
                    {form.formState.errors.city && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.city.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Zip code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="00000"
                      className="mt-1.5"
                      {...form.register("postalCode")}
                      data-testid="input-zip"
                    />
                    {form.formState.errors.postalCode && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.postalCode.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      State / Region <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("state")}
                      onValueChange={(value) => form.setValue("state", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-state">
                        <SelectValue placeholder="- Select state -" />
                      </SelectTrigger>
                      <SelectContent>
                        {usStates.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.state && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.state.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("country")}
                      onValueChange={(value) => form.setValue("country", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-country">
                        <SelectValue placeholder="- Select country -" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.country && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.country.message}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-6 bg-blue-600 hover:bg-blue-700"
                  onClick={handleStep2Save}
                  data-testid="button-save-step2"
                >
                  Save and continue
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            <Collapsible open={openStep === 3} onOpenChange={() => handleStepChange(3)}>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Step 3: Point of contact
                </span>
                <div className="flex items-center gap-2">
                  {step3Complete && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openStep === 3 && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      First name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Enter first name"
                      className="mt-1.5"
                      {...form.register("firstName")}
                      data-testid="input-first-name"
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Last name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="Enter last name"
                      className="mt-1.5"
                      {...form.register("lastName")}
                      data-testid="input-last-name"
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Phone number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="(XXX) XXX-XXXX"
                      className="mt-1.5"
                      maxLength={14}
                      {...form.register("phone", {
                        onChange: (e) => {
                          let value = e.target.value.replace(/[^0-9]/g, '');
                          if (value.length > 0) {
                            if (value.length <= 3) {
                              value = '(' + value;
                            } else if (value.length <= 6) {
                              value = '(' + value.slice(0, 3) + ') ' + value.slice(3);
                            } else {
                              value = '(' + value.slice(0, 3) + ') ' + value.slice(3, 6) + '-' + value.slice(6, 10);
                            }
                          }
                          form.setValue("phone", value);
                        }
                      })}
                      data-testid="input-phone"
                    />
                    {form.formState.errors.phone && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.phone.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Business e-mail address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="email@example.com"
                      className="mt-1.5"
                      {...form.register("email")}
                      data-testid="input-email"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Email must be associated with your brand by domain or prefix. Examples:{" "}
                      <span className="text-blue-600">yourname@company.com</span> or{" "}
                      <span className="text-blue-600">company@gmail.com</span>.
                    </p>
                    {form.formState.errors.email && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-6 bg-blue-600 hover:bg-blue-700"
                  onClick={handleStep3Save}
                  data-testid="button-save-step3"
                >
                  Save and continue
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-8">
          <Link href={`/compliance/info/${applicationId}`}>
            <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium cursor-pointer flex items-center gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </span>
          </Link>
          <Button
            className="bg-blue-600 hover:bg-blue-700 px-6"
            onClick={handleSubmit}
            disabled={createBrandMutation.isPending}
            data-testid="button-submit"
          >
            {createBrandMutation.isPending ? "Submitting..." : "Save and continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
