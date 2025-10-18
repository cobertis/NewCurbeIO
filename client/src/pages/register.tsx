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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  UserPlus,
  CheckCircle,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { BusinessAutocomplete } from "@/components/business-autocomplete";
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
  // Remove all non-numeric characters
  const cleaned = input.replace(/\D/g, '');
  
  // Apply formatting based on length
  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else {
    // Include country code
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

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

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
      
      // Redirect to login after 2 seconds
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
      {/* Logo in top left */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <img 
          src={logo} 
          alt="Curbe.io" 
          className="h-8 sm:h-10 w-auto object-contain"
        />
      </div>

      {/* Registration Card */}
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {currentStep === 1 ? "Create your account" : "Admin information"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentStep === 1 
                ? "Start with your business information" 
                : "Who will manage this account?"}
            </p>
            
            {/* Progress indicator */}
            <div className="flex justify-center gap-2 mt-4">
              <div className={`h-1 w-12 rounded-full transition-all ${
                currentStep >= 1 ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
              <div className={`h-1 w-12 rounded-full transition-all ${
                currentStep >= 2 ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
            </div>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {currentStep === 1 ? (
                <>
                  {/* Step 1: Company Info */}
                  <BusinessAutocomplete
                    value={form.watch("company.name")}
                    label=""
                    placeholder="Search for your business..."
                    onChange={(value) => {
                      form.setValue("company.name", value);
                      const generatedSlug = generateSlug(value);
                      form.setValue("company.slug", generatedSlug);
                    }}
                    onBusinessSelect={(business) => {
                      form.setValue("company.name", business.name);
                      form.setValue("company.phone", business.phone);
                      form.setValue("company.website", business.website);
                      form.setValue("company.address", business.address);
                      form.setValue("company.city", business.city);
                      form.setValue("company.state", business.state);
                      form.setValue("company.postalCode", business.postalCode);
                      form.setValue("company.country", business.country);
                      const generatedSlug = generateSlug(business.name);
                      form.setValue("company.slug", generatedSlug);
                    }}
                    testId="input-business-search"
                  />

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
                            placeholder="Company phone"
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

                  <AddressAutocomplete
                    value={form.watch("company.address")}
                    onChange={(value) => form.setValue("company.address", value)}
                    onAddressSelect={(address) => {
                      form.setValue("company.address", address.street);
                      form.setValue("company.city", address.city);
                      form.setValue("company.state", address.state);
                      form.setValue("company.postalCode", address.postalCode);
                      form.setValue("company.country", address.country);
                    }}
                    label=""
                    placeholder="Street address"
                    testId="input-company-address"
                    error={form.formState.errors.company?.address?.message}
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
                              placeholder="State"
                              className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                              {...field}
                              value={field.value ?? ""}
                              data-testid="input-company-state"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="company.postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="ZIP Code"
                              className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                              {...field}
                              value={field.value ?? ""}
                              data-testid="input-company-zip"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="company.country"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger 
                                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                                data-testid="select-company-country"
                              >
                                <SelectValue placeholder="Country" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="United States">United States</SelectItem>
                                <SelectItem value="Canada">Canada</SelectItem>
                                <SelectItem value="Mexico">Mexico</SelectItem>
                                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleNext}
                    className="w-full h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                    data-testid="button-next"
                  >
                    Next
                  </Button>
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

                  {/* What happens next */}
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">What happens next?</p>
                    <div className="space-y-1">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          We'll send you an activation email to verify your account
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          After activation, you'll select your plan and start your free trial
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          No credit card required for the first 7 days
                        </p>
                      </div>
                    </div>
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
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>

          {/* Sign In Link */}
          {currentStep === 1 && (
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
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
          )}
        </div>
      </div>
    </div>
  );
}