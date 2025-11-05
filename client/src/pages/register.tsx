import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Building2, Loader2, MapPin, Phone, Globe, Check, ChevronLeft } from "lucide-react";
import logo from "@assets/logo no fondo_1760457183587.png";
import { formatForDisplay, formatPhoneInput } from "@shared/phone";

const registerSchema = z.object({
  company: z.object({
    name: z.string().min(1, "Company name is required"),
    slug: z.string().min(1),
    phone: z.string().min(1, "Phone number is required").refine(
      (val) => {
        const digits = val.replace(/\D/g, '');
        return digits.length === 11 && digits.startsWith('1');
      },
      "Valid phone number is required"
    ),
    website: z.string().optional().or(z.literal("")),
    address: z.string().min(1, "Address is required"),
    addressLine2: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    state: z.string().optional().or(z.literal("")),
    postalCode: z.string().optional().or(z.literal("")),
    country: z.string().default("United States"),
  }),
  admin: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(1, "Phone number is required").refine(
      (val) => {
        const digits = val.replace(/\D/g, '');
        return digits.length === 11 && digits.startsWith('1');
      },
      "Valid phone number is required"
    ),
  }),
});

type RegisterForm = z.infer<typeof registerSchema>;

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
};


interface BusinessResult {
  id: string;
  name: string;
  formattedAddress: string;
  shortFormattedAddress: string;
  phone: string;
  website: string;
  address: {
    street: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BusinessResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      company: {
        name: "",
        slug: "",
        phone: "",
        website: "",
        address: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "United States",
      },
      admin: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
      },
    },
  });

  const searchBusinesses = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/google-places/search-business?q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
        setShowResults(data.results && data.results.length > 0);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    const timer = setTimeout(() => {
      searchBusinesses(value);
    }, 400);
    
    setSearchTimer(timer);
  };

  const selectBusiness = (business: BusinessResult) => {
    setSelectedBusiness(business);
    setShowResults(false);
    setSearchResults([]);
    setSearchQuery(business.name);
    
    // Format phone number if it exists using system standard
    const formattedPhone = business.phone ? formatForDisplay(business.phone) : "";
    
    form.setValue("company.name", business.name);
    form.setValue("company.slug", generateSlug(business.name));
    form.setValue("company.phone", formattedPhone);
    form.setValue("company.website", business.website || "");
    form.setValue("company.address", business.address.street || "");
    form.setValue("company.addressLine2", business.address.addressLine2 || "");
    form.setValue("company.city", business.address.city || "");
    form.setValue("company.state", business.address.state || "");
    form.setValue("company.postalCode", business.address.postalCode || "");
    form.setValue("company.country", business.address.country || "United States");
  };

  const enterManually = () => {
    const name = searchQuery.trim() || "";
    
    setSelectedBusiness({ 
      id: 'manual',
      name: name || 'Manual Entry',
      formattedAddress: '',
      shortFormattedAddress: '',
      phone: '',
      website: '',
      address: {
        street: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'United States'
      }
    } as BusinessResult);
    
    // Set initial values but allow editing
    form.setValue("company.name", name);
    form.setValue("company.slug", name ? generateSlug(name) : "");
    form.setValue("company.phone", "");
    form.setValue("company.website", "");
    form.setValue("company.address", "");
    form.setValue("company.addressLine2", "");
    form.setValue("company.city", "");
    form.setValue("company.state", "");
    form.setValue("company.postalCode", "");
    form.setValue("company.country", "United States");
    
    setShowResults(false);
    setSearchResults([]);
  };

  const handleNextStep = async () => {
    // Validate step 1 fields
    const companyValid = await form.trigger([
      "company.name",
      "company.phone",
      "company.address"
    ]);
    
    if (companyValid) {
      setCurrentStep(2);
    }
  };

  const handleBackStep = () => {
    setCurrentStep(1);
  };

  useEffect(() => {
    return () => {
      if (searchTimer) clearTimeout(searchTimer);
    };
  }, [searchTimer]);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    
    try {
      console.log("Submitting registration:", data);
      
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Registration failed");
      }

      toast({
        title: "Account created!",
        description: "Check your email for activation instructions.",
      });
      
      setTimeout(() => setLocation("/login"), 2000);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Link href="/">
          <img src={logo} alt="Curbe.io" className="h-8 sm:h-10 w-auto object-contain cursor-pointer" />
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-10">
          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-3">
              {/* Step 1 */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep === 1 
                    ? 'bg-primary text-primary-foreground' 
                    : currentStep > 1 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
                </div>
                <span className="text-xs mt-2 font-medium text-gray-600 dark:text-gray-400">Company</span>
              </div>
              
              {/* Progress Line */}
              <div className="w-16 sm:w-20 h-0.5 bg-gray-200 dark:bg-gray-700 relative overflow-hidden rounded-full">
                <div className={`h-full bg-primary transition-all duration-300 ${
                  currentStep > 1 ? 'w-full' : 'w-0'
                }`} />
              </div>
              
              {/* Step 2 */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep === 2 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  2
                </div>
                <span className="text-xs mt-2 font-medium text-gray-600 dark:text-gray-400">Admin</span>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              {currentStep === 1 ? (
                <Building2 className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              ) : (
                <UserPlus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              )}
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {currentStep === 1 ? "Find your business" : "Create your account"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentStep === 1 
                ? "Search or enter your company details" 
                : "Enter your admin account information"}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* STEP 1: Company Information */}
              {currentStep === 1 && (
                <>
                  {!selectedBusiness ? (
                    <>
                      {/* Search for business */}
                      <div className="relative">
                        <div className="relative">
                          <Input
                            placeholder="Search your business..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg pr-10"
                            data-testid="input-business-search"
                          />
                          {isSearching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        {/* Results dropdown */}
                        {showResults && searchResults.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchResults.slice(0, 5).map((business) => (
                              <button
                                key={business.id}
                                type="button"
                                onClick={() => selectBusiness(business)}
                                className="w-full text-left p-3 hover-elevate border-b border-gray-100 dark:border-gray-700 last:border-0 rounded-lg"
                                data-testid={`business-result-${business.id}`}
                              >
                                <div className="flex items-start gap-2">
                                  <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                      {business.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {business.shortFormattedAddress || business.formattedAddress}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Manual entry option */}
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={enterManually}
                          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                          data-testid="button-manual-entry"
                        >
                          My business is not listed
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Business Summary Card - Only show for Google Places selection */}
                      {selectedBusiness.id !== 'manual' && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                  {selectedBusiness.name}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Company Information
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBusiness(null);
                                setSearchQuery("");
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                              data-testid="button-change-business"
                            >
                              Change
                            </button>
                          </div>

                          {/* Company Details */}
                          <div className="space-y-2.5">
                            {(selectedBusiness.address.street || selectedBusiness.address.city || selectedBusiness.address.state) && (
                              <div className="flex items-start gap-2.5">
                                <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  {selectedBusiness.address.street && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                      {selectedBusiness.address.street}
                                    </p>
                                  )}
                                  {selectedBusiness.address.addressLine2 && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {selectedBusiness.address.addressLine2}
                                    </p>
                                  )}
                                  {(selectedBusiness.address.city || selectedBusiness.address.state || selectedBusiness.address.postalCode || selectedBusiness.address.country) && (
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {[
                                        selectedBusiness.address.city,
                                        selectedBusiness.address.state,
                                        selectedBusiness.address.postalCode,
                                        selectedBusiness.address.country
                                      ].filter(Boolean).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {selectedBusiness.phone && (
                              <div className="flex items-center gap-2.5">
                                <Phone className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {selectedBusiness.phone}
                                </p>
                              </div>
                            )}
                            
                            {selectedBusiness.website && (
                              <div className="flex items-center gap-2.5">
                                <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                <a 
                                  href={selectedBusiness.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate"
                                >
                                  {selectedBusiness.website.replace(/^https?:\/\//, '')}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Manual Entry Header - Show only for manual entry */}
                      {selectedBusiness.id === 'manual' && (
                        <div className="space-y-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBusiness(null);
                              setSearchQuery("");
                            }}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                            data-testid="button-back-to-search"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Back to search
                          </button>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Enter Company Information
                          </h3>
                        </div>
                      )}

                      {/* Editable Company Fields */}
                      {/* For manual entry, show ALL fields. For Google Places, show only fields that can be edited */}
                      {selectedBusiness.id === 'manual' && (
                        <FormField
                          control={form.control}
                          name="company.name"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Company name"
                                  className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    // Auto-update slug when name changes
                                    form.setValue("company.slug", generateSlug(e.target.value));
                                  }}
                                  name="organization"
                                  autoComplete="organization"
                                  data-testid="input-company-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="company.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="+1 (456) 789-1234"
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                onChange={(e) => {
                                  const formatted = formatPhoneInput(e.target.value);
                                  field.onChange(formatted);
                                }}
                                name="tel"
                                autoComplete="tel"
                                data-testid="input-company-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedBusiness.id === 'manual' && (
                        <FormField
                          control={form.control}
                          name="company.website"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Website (optional)"
                                  className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                  {...field}
                                  value={field.value ?? ""}
                                  name="url"
                                  autoComplete="url"
                                  data-testid="input-company-website"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="company.address"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Street address"
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                name="address-line1"
                                autoComplete="address-line1"
                                data-testid="input-company-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="company.addressLine2"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Suite, Apt, Unit (optional)"
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                value={field.value ?? ""}
                                name="address-line2"
                                autoComplete="address-line2"
                                data-testid="input-company-address-line2"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="company.city"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="City"
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                value={field.value ?? ""}
                                name="address-level2"
                                autoComplete="address-level2"
                                data-testid="input-company-city"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="company.state"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="State"
                                  className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                  {...field}
                                  value={field.value ?? ""}
                                  name="address-level1"
                                  autoComplete="address-level1"
                                  data-testid="input-company-state"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="company.postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="ZIP code"
                                  className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                  {...field}
                                  value={field.value ?? ""}
                                  name="postal-code"
                                  autoComplete="postal-code"
                                  data-testid="input-company-postal-code"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Next Step Button */}
                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="w-full h-12 text-base font-medium"
                        data-testid="button-next-step"
                      >
                        Continue to Admin Account
                      </Button>
                    </>
                  )}

                  {!selectedBusiness && (
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setLocation("/login")}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                        data-testid="link-login"
                      >
                        Sign in here
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* STEP 2: Admin Information */}
              {currentStep === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="admin.firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="First name"
                              className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                              {...field}
                              name="given-name"
                              autoComplete="given-name"
                              data-testid="input-first-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="admin.lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Last name"
                              className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                              {...field}
                              name="family-name"
                              autoComplete="family-name"
                              data-testid="input-last-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="admin.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Email address"
                            className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                            {...field}
                            name="email"
                            autoComplete="email"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="admin.phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="+1 (456) 789-1234"
                            className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const formatted = formatPhoneInput(e.target.value);
                              field.onChange(formatted);
                            }}
                            name="tel-admin"
                            autoComplete="tel"
                            data-testid="input-admin-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={handleBackStep}
                      variant="outline"
                      className="h-12 text-base font-medium"
                      data-testid="button-back-step"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 text-base font-medium"
                      data-testid="button-register"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </div>

                  <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                    You'll receive an activation email to get started
                  </div>

                  <div className="text-center text-sm text-gray-600 dark:text-gray-400 pt-2">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                      data-testid="link-login"
                    >
                      Sign in here
                    </button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
