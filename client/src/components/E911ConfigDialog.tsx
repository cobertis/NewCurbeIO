import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import { useToast } from "@/hooks/use-toast";
import { MapPin, AlertTriangle, Loader2, CheckCircle, Building2, User } from "lucide-react";

const US_STATES = [
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
  { value: "DC", label: "Washington D.C." },
];

const e911FormSchema = z.object({
  callerName: z.string().min(2, "Name must be at least 2 characters"),
  streetAddress: z.string().min(5, "Street address is required"),
  extendedAddress: z.string().optional(),
  locality: z.string().min(2, "City is required"),
  administrativeArea: z.string().length(2, "Select a state"),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
});

type E911FormValues = z.infer<typeof e911FormSchema>;

interface BusinessResult {
  id: string;
  name: string;
  formattedAddress: string;
  shortFormattedAddress: string;
  address: {
    street: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

interface E911ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  phoneNumberId: string;
  onSuccess?: () => void;
}

export function E911ConfigDialog({
  open,
  onOpenChange,
  phoneNumber,
  phoneNumberId,
  onSuccess,
}: E911ConfigDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"form" | "success">("form");
  const [usePersonalName, setUsePersonalName] = useState(false);
  const [businessSuggestions, setBusinessSuggestions] = useState<BusinessResult[]>([]);
  const [showBusinessSuggestions, setShowBusinessSuggestions] = useState(false);
  const [isSearchingBusiness, setIsSearchingBusiness] = useState(false);
  const [hasPrefilledFromCompany, setHasPrefilledFromCompany] = useState(false);
  const debounceTimer = { current: null as NodeJS.Timeout | null };

  const { data: companyData } = useQuery<{ company: any }>({
    queryKey: ["/api/settings/company"],
    enabled: open,
  });

  const form = useForm<E911FormValues>({
    resolver: zodResolver(e911FormSchema),
    defaultValues: {
      callerName: "",
      streetAddress: "",
      extendedAddress: "",
      locality: "",
      administrativeArea: "",
      postalCode: "",
    },
  });

  useEffect(() => {
    if (open && companyData?.company && !hasPrefilledFromCompany) {
      const company = companyData.company;
      if (company.address && company.city && company.state && company.postalCode) {
        form.setValue("callerName", company.name || "");
        form.setValue("streetAddress", company.address || "");
        form.setValue("extendedAddress", company.addressLine2 || "");
        form.setValue("locality", company.city || "");
        form.setValue("administrativeArea", company.state || "");
        form.setValue("postalCode", company.postalCode || "");
        setHasPrefilledFromCompany(true);
      }
    }
  }, [open, companyData, form, hasPrefilledFromCompany]);

  useEffect(() => {
    if (!open) {
      setHasPrefilledFromCompany(false);
      setUsePersonalName(false);
      setBusinessSuggestions([]);
      setShowBusinessSuggestions(false);
      setStep("form");
      form.reset();
    }
  }, [open, form]);

  const registerMutation = useMutation({
    mutationFn: async (data: E911FormValues) => {
      const response = await apiRequest("POST", "/api/e911/register", {
        phoneNumberId,
        streetAddress: data.streetAddress,
        extendedAddress: data.extendedAddress || "",
        locality: data.locality,
        administrativeArea: data.administrativeArea,
        postalCode: data.postalCode,
        countryCode: "US",
        callerName: data.callerName,
      });
      return response;
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      toast({
        title: "E911 Configured",
        description: "Emergency address has been registered for this number.",
      });
      setTimeout(() => {
        onOpenChange(false);
        setStep("form");
        form.reset();
        onSuccess?.();
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.message || "Failed to register emergency address",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: E911FormValues) => {
    registerMutation.mutate(data);
  };

  const handleAddressSelect = (address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  }) => {
    form.setValue("streetAddress", address.street);
    form.setValue("locality", address.city);
    form.setValue("administrativeArea", address.state);
    form.setValue("postalCode", address.postalCode);
  };

  const searchBusinesses = async (query: string) => {
    if (query.length < 3 || usePersonalName) {
      setBusinessSuggestions([]);
      setShowBusinessSuggestions(false);
      return;
    }

    setIsSearchingBusiness(true);
    try {
      const response = await fetch(
        `/api/google-places/search-business?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setBusinessSuggestions(data.results || []);
        setShowBusinessSuggestions((data.results || []).length > 0);
      }
    } catch (error) {
      console.error("Business search error:", error);
    } finally {
      setIsSearchingBusiness(false);
    }
  };

  const handleCallerNameChange = (value: string) => {
    form.setValue("callerName", value);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!usePersonalName && value.length >= 3) {
      debounceTimer.current = setTimeout(() => {
        searchBusinesses(value);
      }, 400);
    } else {
      setBusinessSuggestions([]);
      setShowBusinessSuggestions(false);
    }
  };

  const handleBusinessSelect = (business: BusinessResult) => {
    form.setValue("callerName", business.name);
    form.setValue("streetAddress", business.address.street);
    form.setValue("extendedAddress", business.address.addressLine2 || "");
    form.setValue("locality", business.address.city);
    form.setValue("administrativeArea", business.address.state);
    form.setValue("postalCode", business.address.postalCode);
    setBusinessSuggestions([]);
    setShowBusinessSuggestions(false);
  };

  const handleUsePersonalNameChange = (checked: boolean) => {
    setUsePersonalName(checked);
    setBusinessSuggestions([]);
    setShowBusinessSuggestions(false);
    if (checked) {
      form.setValue("callerName", "");
      form.setValue("streetAddress", "");
      form.setValue("extendedAddress", "");
      form.setValue("locality", "");
      form.setValue("administrativeArea", "");
      form.setValue("postalCode", "");
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-500" />
            E911 Emergency Address
          </DialogTitle>
          <DialogDescription>
            Configure the emergency address for {formatPhoneDisplay(phoneNumber)}. This address will be used by emergency services if you dial 911.
          </DialogDescription>
        </DialogHeader>

        {step === "success" ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-foreground mb-2">
              E911 Configured Successfully
            </h3>
            <p className="text-sm text-slate-500 dark:text-muted-foreground text-center">
              Your phone number is now ready for emergency calls.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Important - FCC Requirement</p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                  Enter the physical address where you will use this phone number. Emergency responders will be dispatched to this location if you call 911.
                </p>
                <p className="text-red-600 dark:text-red-400 text-xs mt-2 font-medium">
                  Calling 911 without a registered E911 address may result in fines up to $100 per occurrence, as required by the FCC for VoIP services.
                </p>
              </div>
            </div>

            {hasPrefilledFromCompany && !usePersonalName && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 mb-4 text-sm">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300">Pre-filled with your company address</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="relative">
                  <FormField
                    control={form.control}
                    name="callerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          {usePersonalName ? (
                            <><User className="h-4 w-4" /> Personal Name</>
                          ) : (
                            <><Building2 className="h-4 w-4" /> Business Name</>
                          )}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder={usePersonalName ? "John Doe" : "Search for your business..."}
                              value={field.value}
                              onChange={(e) => handleCallerNameChange(e.target.value)}
                              data-testid="input-e911-caller-name"
                              autoComplete="off"
                            />
                            {isSearchingBusiness && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showBusinessSuggestions && businessSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {businessSuggestions.map((business) => (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => handleBusinessSelect(business)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          data-testid={`business-suggestion-${business.id}`}
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {business.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {business.shortFormattedAddress || business.formattedAddress}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="use-personal-name" 
                    checked={usePersonalName}
                    onCheckedChange={handleUsePersonalNameChange}
                    data-testid="checkbox-use-personal-name"
                  />
                  <label 
                    htmlFor="use-personal-name" 
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Use personal name instead of business
                  </label>
                </div>

                <FormField
                  control={form.control}
                  name="streetAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <GooglePlacesAddressAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          onAddressSelect={handleAddressSelect}
                          label=""
                          placeholder="Start typing your address..."
                          testId="input-e911-street"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="extendedAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apt / Suite / Floor (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Apt 4B" 
                          {...field}
                          data-testid="input-e911-extended"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="locality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Miami" 
                            {...field}
                            data-testid="input-e911-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="administrativeArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-e911-state">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            {US_STATES.map((state) => (
                              <SelectItem key={state.value} value={state.value}>
                                {state.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="33101" 
                          maxLength={10}
                          {...field}
                          data-testid="input-e911-zip"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={registerMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    data-testid="button-save-e911"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Emergency Address"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
