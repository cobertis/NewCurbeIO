import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  UserPlus,
  Search,
  Building2,
  MapPin,
  Phone,
  Globe,
  Check,
  Edit2
} from "lucide-react";
import logo from "@assets/logo no fondo_1760457183587.png";

// Schema matching exactly what dashboard uses
const createCompanyWithAdminSchema = z.object({
  company: z.object({
    name: z.string().min(1, "Company name is required"),
    slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
    phone: z.string().min(1, "Company phone is required"),
    website: z.string().url().optional().or(z.literal("")),
    address: z.string().min(1, "Address is required"),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default("United States"),
  }),
  admin: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
  }),
});

type CreateCompanyForm = z.infer<typeof createCompanyWithAdminSchema>;

// Helper function to format phone number
const formatPhoneInput = (input: string): string => {
  const cleaned = input.replace(/\D/g, '');
  
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else {
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
  }
};

// Generate slug from company name
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
  type: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [businessSearch, setBusinessSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BusinessResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const form = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanyWithAdminSchema),
    defaultValues: {
      company: {
        name: "",
        slug: "",
        phone: "",
        website: "",
        address: "",
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

  const searchBusinesses = async () => {
    if (!businessSearch.trim() || businessSearch.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/google-places/search-business?q=${encodeURIComponent(businessSearch)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        console.error("Failed to fetch business suggestions");
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Failed to fetch business suggestions:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectBusiness = (business: BusinessResult) => {
    setSelectedBusiness(business);
    setSearchResults([]);
    
    // Populate form with business data
    form.setValue("company.name", business.name);
    form.setValue("company.phone", business.phone);
    form.setValue("company.website", business.website);
    form.setValue("company.address", business.address.street);
    form.setValue("company.city", business.address.city);
    form.setValue("company.state", business.address.state);
    form.setValue("company.postalCode", business.address.postalCode);
    form.setValue("company.country", business.address.country);
    
    // Generate slug
    const generatedSlug = generateSlug(business.name);
    form.setValue("company.slug", generatedSlug);
  };

  const clearBusinessSelection = () => {
    setSelectedBusiness(null);
    setBusinessSearch("");
    setShowManualEntry(false);
  };

  const onSubmit = async (data: CreateCompanyForm) => {
    setIsLoading(true);
    
    try {
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
        title: "Success!",
        description: "Your account has been created. Please check your email for activation instructions.",
      });
      
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    const companyValid = await form.trigger([
      "company.name",
      "company.slug",
      "company.phone",
      "company.address",
    ]);
    
    if (companyValid) {
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
      {/* Logo in top left - identical to login */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <img 
          src={logo} 
          alt="Curbe.io" 
          className="h-8 sm:h-10 w-auto object-contain"
        />
      </div>

      {/* Registration Card - same style as login */}
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10">
          {/* Icon - same style as login */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
          </div>

          {/* Title - same style as login */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {currentStep === 1 ? "Create your account" : "Admin information"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentStep === 1 
                ? "Search for your business or enter details manually" 
                : "Who will manage this account?"}
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentStep === 1 ? (
                <>
                  {/* Step 1: Company Info */}
                  
                  {/* Smart Search Section */}
                  {!selectedBusiness && !showManualEntry && (
                    <>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Search for your business..."
                          value={businessSearch}
                          onChange={(e) => setBusinessSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              searchBusinesses();
                            }
                          }}
                          className="h-12 pl-12 pr-4 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                          data-testid="input-business-search"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Button
                          type="button"
                          onClick={searchBusinesses}
                          disabled={isSearching || businessSearch.length < 2}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-3 text-xs"
                          data-testid="button-search"
                        >
                          {isSearching ? "Searching..." : "Search"}
                        </Button>
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                          {searchResults.map((business) => (
                            <button
                              key={business.id}
                              type="button"
                              onClick={() => selectBusiness(business)}
                              className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              data-testid={`business-result-${business.id}`}
                            >
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {business.name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {business.shortFormattedAddress || business.formattedAddress}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Not Listed Checkbox */}
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="not-listed" 
                          checked={notListed}
                          onCheckedChange={(checked) => {
                            setNotListed(checked as boolean);
                            if (checked) {
                              setShowManualEntry(true);
                              setSearchResults([]);
                            } else {
                              setShowManualEntry(false);
                            }
                          }}
                          data-testid="checkbox-not-listed"
                        />
                        <label 
                          htmlFor="not-listed" 
                          className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
                        >
                          My business is not listed
                        </label>
                      </div>
                    </>
                  )}

                  {/* Selected Business Summary */}
                  {selectedBusiness && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 relative">
                      <button
                        type="button"
                        onClick={clearBusinessSelection}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        data-testid="button-edit-business"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">
                            {selectedBusiness.name}
                          </h3>
                          <div className="mt-2 space-y-1">
                            {selectedBusiness.address.street && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{selectedBusiness.shortFormattedAddress || selectedBusiness.formattedAddress}</span>
                              </div>
                            )}
                            {selectedBusiness.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Phone className="h-3.5 w-3.5" />
                                <span>{selectedBusiness.phone}</span>
                              </div>
                            )}
                            {selectedBusiness.website && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Globe className="h-3.5 w-3.5" />
                                <span>Website available</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-3 text-xs text-green-600 dark:text-green-400">
                            <Check className="h-3.5 w-3.5" />
                            <span>Business information auto-filled</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Manual Entry Fields */}
                  {(showManualEntry && !selectedBusiness) && (
                    <>
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
                                  const generatedSlug = generateSlug(e.target.value);
                                  form.setValue('company.slug', generatedSlug);
                                }}
                                data-testid="input-company-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="company.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Phone number"
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                onChange={(e) => {
                                  const formatted = formatPhoneInput(e.target.value);
                                  field.onChange(formatted);
                                }}
                                data-testid="input-company-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                                data-testid="input-company-website"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

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
                                data-testid="input-company-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
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
                                  data-testid="input-company-city"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="company.state"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="State / ZIP"
                                  className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Check if it looks like a ZIP code
                                    if (/^\d/.test(value)) {
                                      form.setValue('company.postalCode', value);
                                    } else {
                                      field.onChange(value);
                                    }
                                  }}
                                  data-testid="input-company-state"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}

                  {/* Next Button */}
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="w-full h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    data-testid="button-next"
                  >
                    Continue
                  </Button>

                  {/* Sign In Link - same style as login */}
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      data-testid="link-login"
                    >
                      Sign in
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Admin Info */}
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
                              data-testid="input-admin-first-name"
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
                              data-testid="input-admin-last-name"
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
                            data-testid="input-admin-email"
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
                            placeholder="Phone number (optional)"
                            className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const formatted = formatPhoneInput(e.target.value);
                              field.onChange(formatted);
                            }}
                            data-testid="input-admin-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Simple info */}
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 py-2">
                    <p>• We'll send you an activation email</p>
                    <p>• 7-day free trial, no credit card required</p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={handleBack}
                      variant="outline"
                      className="flex-1 h-12 text-base font-medium rounded-lg"
                      data-testid="button-back"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                      data-testid="button-register"
                    >
                      {isLoading ? "Creating..." : "Create Account"}
                    </Button>
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