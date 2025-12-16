import { useState, useEffect, useCallback } from "react";
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
import { Building2, Loader2, MapPin, Check, ChevronLeft, ChevronRight, Shield, Users, Zap } from "lucide-react";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/generated_images/modern_cityscape_sunset_background.png";
import { formatForDisplay, formatPhoneInput } from "@shared/phone";

const registerSchema = z.object({
  company: z.object({
    name: z.string().min(1, "Company name is required"),
    slug: z.string().min(1),
    phone: z.string().min(1, "Phone number is required").refine(
      (val) => {
        const digits = val.replace(/\D/g, '');
        return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
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
        return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
      },
      "Valid phone number is required"
    ),
    smsConsent: z.boolean().refine(val => val === true, "You must agree to receive SMS messages"),
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
        smsConsent: false,
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
    setSelectedBusiness(null);
    
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    const timer = setTimeout(() => {
      searchBusinesses(value);
    }, 300);
    
    setSearchTimer(timer);
  };

  const selectBusiness = (business: BusinessResult) => {
    setSelectedBusiness(business);
    setSearchQuery(business.name);
    setShowResults(false);
    
    form.setValue("company.name", business.name);
    form.setValue("company.slug", generateSlug(business.name));
    form.setValue("company.phone", business.phone ? formatForDisplay(business.phone) : "");
    form.setValue("company.website", business.website || "");
    form.setValue("company.address", business.address?.street || "");
    form.setValue("company.addressLine2", business.address?.addressLine2 || "");
    form.setValue("company.city", business.address?.city || "");
    form.setValue("company.state", business.address?.state || "");
    form.setValue("company.postalCode", business.address?.postalCode || "");
    form.setValue("company.country", business.address?.country || "United States");
  };

  const handleNextStep = async () => {
    const companyValid = await form.trigger("company");
    if (companyValid) {
      setCurrentStep(2);
    }
  };

  const handleBackStep = () => {
    setCurrentStep(1);
  };

  const onSubmit = async (data: RegisterForm) => {
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
        title: "Registration successful!",
        description: "Please check your email to activate your account.",
        duration: 3000,
      });

      setLocation("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
    };
  }, [searchTimer]);

  const companyName = form.watch("company.name");
  useEffect(() => {
    if (companyName && !selectedBusiness) {
      form.setValue("company.slug", generateSlug(companyName));
    }
  }, [companyName, selectedBusiness, form]);

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Curbe" className="h-10 w-auto" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">Curbe</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Start your journey with us
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Create your account and transform how you manage your business.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              currentStep > 1 ? 'bg-blue-600' : 'bg-gray-200'
            }`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {currentStep === 1 && (
                <>
                  <div className="relative">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        placeholder="Search for your business..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-12 pl-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500"
                        data-testid="input-business-search"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg max-h-64 overflow-auto">
                        {searchResults.map((business) => (
                          <button
                            key={business.id}
                            type="button"
                            onClick={() => selectBusiness(business)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors"
                            data-testid={`result-business-${business.id}`}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{business.name}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {business.shortFormattedAddress}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedBusiness && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{selectedBusiness.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{selectedBusiness.formattedAddress}</p>
                          {selectedBusiness.phone && (
                            <p className="text-sm text-gray-500 mt-1">{formatForDisplay(selectedBusiness.phone)}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBusiness(null);
                            setSearchQuery("");
                            form.reset();
                          }}
                          className="text-gray-400 hover:text-gray-600 text-sm"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}

                  {!selectedBusiness && searchQuery.length > 0 && !showResults && !isSearching && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">Can't find your business? Enter details manually:</p>
                      
                      <FormField
                        control={form.control}
                        name="company.name"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Company name"
                                className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                                {...field}
                                data-testid="input-company-name"
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
                                placeholder="Business address"
                                className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                                {...field}
                                data-testid="input-address"
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
                                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                                  {...field}
                                  data-testid="input-city"
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
                                  placeholder="State"
                                  className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                                  {...field}
                                  data-testid="input-state"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="company.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Business phone"
                                className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
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
                    </div>
                  )}

                  {selectedBusiness && (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 rounded-xl"
                      data-testid="button-next-step"
                    >
                      Continue
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}

                  {!selectedBusiness && searchQuery.length > 0 && !showResults && !isSearching && (
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 rounded-xl"
                      data-testid="button-next-step"
                    >
                      Continue
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}

                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                      data-testid="link-login"
                    >
                      Sign in
                    </button>
                  </div>
                </>
              )}

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
                              className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                              {...field}
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
                              className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                              {...field}
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
                            className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                            {...field}
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
                            placeholder="Your phone number"
                            className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 rounded-xl"
                            {...field}
                            onChange={(e) => {
                              const formatted = formatPhoneInput(e.target.value);
                              field.onChange(formatted);
                            }}
                            autoComplete="tel"
                            data-testid="input-admin-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="admin.smsConsent"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-sms-consent"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            I agree to receive SMS messages for account verification and important updates.
                          </p>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={handleBackStep}
                      variant="outline"
                      className="h-12 px-6 rounded-xl"
                      data-testid="button-back-step"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 rounded-xl"
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

                  <p className="text-center text-xs text-gray-500">
                    You'll receive an activation email to get started
                  </p>

                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                      data-testid="link-login"
                    >
                      Sign in
                    </button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </div>
      </div>

      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="space-y-6 max-w-lg">
            <h2 className="text-4xl font-bold leading-tight">
              We are a Family
            </h2>
            <p className="text-lg text-white/80">
              Join thousands of insurance professionals who trust Curbe to streamline their operations and grow their business.
            </p>
            
            <div className="flex flex-wrap gap-3 pt-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Secure Platform</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <Users className="w-4 h-4" />
                <span className="text-sm">Team Collaboration</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Fast & Efficient</span>
              </div>
            </div>
          </div>

          <div className="absolute top-8 right-8 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
            <div className="text-3xl font-bold">+89%</div>
            <div className="text-sm text-white/80">Positive response<br/>from users</div>
            <Button 
              size="sm" 
              className="mt-3 bg-white text-gray-900 hover:bg-white/90 rounded-lg w-full"
              onClick={() => setLocation("/login")}
            >
              Start Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
