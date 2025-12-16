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
import { Building2, Loader2, MapPin, Check, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { SiGoogle, SiX, SiTwitch } from "react-icons/si";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/generated_images/mountain_road_scenic_background.png";
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
  const [showPassword, setShowPassword] = useState(false);

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
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      data-testid="register-page"
    >
      <div className="w-full max-w-[1100px] bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        <div className="w-full lg:w-[45%] p-8 md:p-12">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin-slow" />
            <span className="text-xl font-semibold text-blue-600">Curbe.</span>
          </div>

          <h1 className="text-[2rem] md:text-[2.5rem] font-bold text-gray-900 leading-tight mb-3">
            This is where incredible experiences start.
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            More than Thousand Locations for customized just for you. You can start now for start your journey.
          </p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <SiX className="w-5 h-5 text-gray-700" />
            </button>
            <button className="w-12 h-12 rounded-full bg-[#4285F4] flex items-center justify-center hover:bg-[#3b78dc] transition-colors">
              <SiGoogle className="w-5 h-5 text-white" />
            </button>
            <button className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <SiTwitch className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-sm">Or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentStep === 1 && (
                <>
                  <div className="relative">
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Business Name</label>
                    <div className="relative">
                      <Input
                        placeholder="Search for your business..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-12 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        data-testid="input-business-search"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                      )}
                    </div>

                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-auto">
                        {searchResults.map((business) => (
                          <button
                            key={business.id}
                            type="button"
                            onClick={() => selectBusiness(business)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
                            data-testid={`result-business-${business.id}`}
                          >
                            <div className="font-medium text-gray-900">{business.name}</div>
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
                    <>
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-600 rounded-lg">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{selectedBusiness.name}</h3>
                            <p className="text-sm text-gray-600 mt-0.5">{selectedBusiness.formattedAddress}</p>
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

                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="w-full h-12 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
                        data-testid="button-next-step"
                      >
                        Start Journey
                      </Button>
                    </>
                  )}

                  {!selectedBusiness && searchQuery.length > 0 && !showResults && !isSearching && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1 ml-1">Company Name</label>
                        <FormField
                          control={form.control}
                          name="company.name"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Enter company name"
                                  className="h-12 px-4 bg-white border-gray-200 rounded-lg"
                                  {...field}
                                  data-testid="input-company-name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1 ml-1">Address</label>
                        <FormField
                          control={form.control}
                          name="company.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Business address"
                                  className="h-12 px-4 bg-white border-gray-200 rounded-lg"
                                  {...field}
                                  data-testid="input-address"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1 ml-1">Phone</label>
                        <FormField
                          control={form.control}
                          name="company.phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  placeholder="Business phone"
                                  className="h-12 px-4 bg-white border-gray-200 rounded-lg"
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

                      <Button
                        type="button"
                        onClick={handleNextStep}
                        className="w-full h-12 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
                        data-testid="button-next-step"
                      >
                        Start Journey
                      </Button>
                    </>
                  )}

                  <div className="text-center text-sm text-gray-600 pt-2">
                    Have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                      data-testid="link-login"
                    >
                      Login now!
                    </button>
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 ml-1">First Name</label>
                      <FormField
                        control={form.control}
                        name="admin.firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="John"
                                className="h-12 px-4 bg-white border-gray-200 rounded-lg"
                                {...field}
                                autoComplete="given-name"
                                data-testid="input-first-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 ml-1">Last Name</label>
                      <FormField
                        control={form.control}
                        name="admin.lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Doe"
                                className="h-12 px-4 bg-white border-gray-200 rounded-lg"
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
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Email</label>
                    <FormField
                      control={form.control}
                      name="admin.email"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@company.com"
                              className="h-12 px-4 bg-white border-gray-200 rounded-lg"
                              {...field}
                              autoComplete="email"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1 ml-1">Phone</label>
                    <FormField
                      control={form.control}
                      name="admin.phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="(555) 123-4567"
                                className="h-12 px-4 bg-white border-gray-200 rounded-lg"
                                {...field}
                                onChange={(e) => {
                                  const formatted = formatPhoneInput(e.target.value);
                                  field.onChange(formatted);
                                }}
                                autoComplete="tel"
                                data-testid="input-admin-phone"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="admin.smsConsent"
                    render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 space-y-0 p-3 bg-gray-50 rounded-lg">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-sms-consent"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <p className="text-sm text-gray-600">
                            I agree to receive SMS messages for account verification.
                          </p>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={handleBackStep}
                      variant="outline"
                      className="h-12 px-6 rounded-lg border-gray-200"
                      data-testid="button-back-step"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
                      data-testid="button-register"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Start Journey"
                      )}
                    </Button>
                  </div>

                  <div className="text-center text-sm text-gray-600 pt-2">
                    Have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                      data-testid="link-login"
                    >
                      Login now!
                    </button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </div>

        <div className="hidden lg:block w-[55%] relative overflow-hidden rounded-r-[2rem]">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute top-6 right-6 bg-white rounded-2xl p-5 shadow-xl min-w-[180px]">
            <div className="text-3xl font-bold text-gray-900">+89%</div>
            <div className="text-sm text-gray-500 mt-1">Positive respond from<br/>people</div>
            <Button 
              size="sm" 
              className="mt-4 bg-gray-900 hover:bg-gray-800 text-white rounded-lg w-full py-2"
              onClick={() => setLocation("/login")}
            >
              Start Now
            </Button>
          </div>

          <div className="absolute top-6 right-[220px] flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
            <div className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent" />
            <span className="text-white text-sm font-medium">Curbe.</span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-3">
              We are a Family
            </h2>
            <p className="text-white/70 text-sm max-w-md mx-auto mb-6">
              In camp we have a lot people with different life story that help you feel more better in trip
            </p>
            
            <div className="flex flex-wrap justify-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-white text-sm"># Curbe_Trip</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-white text-sm"># Curbe.</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-white text-sm"># Be_happy</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                <div className="w-3 h-3 rounded-full bg-pink-400" />
                <span className="text-white text-sm"># Be_happy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
