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
import { UserPlus, Building2, Loader2, MapPin, Phone, Globe } from "lucide-react";
import logo from "@assets/logo no fondo_1760457183587.png";

const registerSchema = z.object({
  company: z.object({
    name: z.string().min(1, "Company name is required"),
    slug: z.string().min(1),
    phone: z.string().min(1, "Phone is required"),
    website: z.string().optional().or(z.literal("")),
    address: z.string().min(1, "Address is required"),
    city: z.string().optional().or(z.literal("")),
    state: z.string().optional().or(z.literal("")),
    postalCode: z.string().optional().or(z.literal("")),
    country: z.string().default("United States"),
  }),
  admin: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional().or(z.literal("")),
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
    
    // Auto-fill company data with proper defaults
    form.setValue("company.name", business.name);
    form.setValue("company.slug", generateSlug(business.name));
    form.setValue("company.phone", business.phone || "");
    form.setValue("company.website", business.website || "");
    form.setValue("company.address", business.address.street || "");
    form.setValue("company.city", business.address.city || "");
    form.setValue("company.state", business.address.state || "");
    form.setValue("company.postalCode", business.address.postalCode || "");
    form.setValue("company.country", business.address.country || "United States");
  };

  const enterManually = () => {
    const name = searchQuery.trim() || "My Company";
    
    setSelectedBusiness({ 
      id: 'manual',
      name,
      formattedAddress: '',
      shortFormattedAddress: '',
      phone: '',
      website: '',
      address: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'United States'
      }
    } as BusinessResult);
    
    form.setValue("company.name", name);
    form.setValue("company.slug", generateSlug(name));
    form.setValue("company.phone", "");
    form.setValue("company.website", "");
    form.setValue("company.address", "");
    form.setValue("company.city", "");
    form.setValue("company.state", "");
    form.setValue("company.postalCode", "");
    form.setValue("company.country", "United States");
    
    setShowResults(false);
    setSearchResults([]);
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Create your account
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {!selectedBusiness ? "Search for your business" : "Enter your details"}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
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

                  {/* Always show manual entry option */}
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
                  {/* Show selected business - Company Summary */}
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
                      {selectedBusiness.address.street && (
                        <div className="flex items-start gap-2.5">
                          <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {selectedBusiness.address.street}
                            </p>
                            {(selectedBusiness.address.city || selectedBusiness.address.state || selectedBusiness.address.postalCode) && (
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {selectedBusiness.address.city}
                                {selectedBusiness.address.state && `${selectedBusiness.address.city ? ', ' : ''}${selectedBusiness.address.state}`}
                                {selectedBusiness.address.postalCode && ` ${selectedBusiness.address.postalCode}`}
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

                      {selectedBusiness.id === 'manual' && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                            Manual entry - Please fill in the details below
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company details - only if entered manually */}
                  {selectedBusiness.id === 'manual' && (
                    <>
                      <FormField
                        control={form.control}
                        name="company.phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Company phone"
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                data-testid="input-company-phone"
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
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                {...field}
                                data-testid="input-company-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {/* User details */}
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
                            placeholder="Phone number"
                            className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-admin-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    data-testid="button-register"
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>

                  <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                    You'll receive an activation email
                  </div>
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
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}