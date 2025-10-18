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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Mail, 
  Phone,
  Globe,
  MapPin,
  User,
  Sparkles,
  ArrowRight,
  CheckCircle 
} from "lucide-react";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { BusinessAutocomplete } from "@/components/business-autocomplete";

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

// Helper functions
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
};

const formatPhoneInput = (value: string) => {
  const cleaned = value.replace(/\D/g, "");
  const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  }
  return value;
};

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      const result = await response.json();
      
      toast({
        title: "Success!",
        description: "Company registered successfully. Check your email for activation instructions.",
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        {/* Modern Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl"></div>
              <Sparkles className="h-12 w-12 text-primary relative" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
            Start Your Free Trial
          </h1>
          <p className="text-muted-foreground">
            7 days free • No credit card required • Cancel anytime
          </p>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all
              ${currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-medium">Company</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all
              ${currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">Admin</span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="border-0 shadow-xl bg-card/95 backdrop-blur">
          <CardContent className="p-6 sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {currentStep === 1 ? (
                  <>
                    {/* Step 1: Company Info */}
                    <div className="space-y-4">
                      {/* Business Search Section */}
                      <div className="mb-4">
                        <BusinessAutocomplete
                          value={form.watch("company.name")}
                          onChange={(value) => {
                            form.setValue("company.name", value);
                            if (!slugManuallyEdited) {
                              const generatedSlug = generateSlug(value);
                              form.setValue("company.slug", generatedSlug);
                            }
                          }}
                          onBusinessSelect={(business) => {
                            // Populate all company fields with the selected business data
                            form.setValue("company.name", business.name);
                            form.setValue("company.phone", business.phone);
                            form.setValue("company.website", business.website);
                            form.setValue("company.address", business.address);
                            form.setValue("company.city", business.city);
                            form.setValue("company.state", business.state);
                            form.setValue("company.postalCode", business.postalCode);
                            form.setValue("company.country", business.country);
                            
                            // Auto-generate slug from business name
                            if (!slugManuallyEdited) {
                              const generatedSlug = generateSlug(business.name);
                              form.setValue("company.slug", generatedSlug);
                            }
                          }}
                          testId="input-business-search"
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Can't find your business? Enter the details manually below.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="company.name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Acme Inc."
                                    className="pl-10"
                                    {...field}
                                    onChange={(e) => {
                                      field.onChange(e);
                                      if (!slugManuallyEdited) {
                                        const generatedSlug = generateSlug(e.target.value);
                                        form.setValue('company.slug', generatedSlug);
                                      }
                                    }}
                                    data-testid="input-company-name"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="company.slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Slug (auto-generated)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="acme-inc"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(e);
                                    setSlugManuallyEdited(true);
                                  }}
                                  data-testid="input-company-slug"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="company.phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Phone</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="+1 (555) 123-4567"
                                    className="pl-10"
                                    {...field}
                                    onChange={(e) => {
                                      const formatted = formatPhoneInput(e.target.value);
                                      field.onChange(formatted);
                                    }}
                                    data-testid="input-company-phone"
                                  />
                                </div>
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
                              <FormLabel>Website (optional)</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="https://example.com"
                                    className="pl-10"
                                    {...field}
                                    value={field.value ?? ""}
                                    data-testid="input-company-website"
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
                        name="company.address"
                        render={({ field }) => (
                          <div className="space-y-1">
                            <AddressAutocomplete
                              value={field.value}
                              onChange={field.onChange}
                              onAddressSelect={(address) => {
                                form.setValue("company.address", address.street);
                                form.setValue("company.city", address.city);
                                form.setValue("company.state", address.state);
                                form.setValue("company.postalCode", address.postalCode);
                                form.setValue("company.country", address.country);
                              }}
                              label="Company Address"
                              placeholder="Start typing an address..."
                              testId="input-company-address"
                              error={form.formState.errors.company?.address?.message}
                            />
                          </div>
                        )}
                      />

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="company.city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Miami"
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
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="FL"
                                  {...field}
                                  value={field.value ?? ""}
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
                              <FormLabel>ZIP</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="33185"
                                  {...field}
                                  value={field.value ?? ""}
                                  data-testid="input-company-postal"
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
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="United States"
                                  {...field}
                                  value={field.value ?? ""}
                                  data-testid="input-company-country"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleNext}
                      className="w-full"
                      size="lg"
                      data-testid="button-next-step"
                    >
                      Continue to Admin Setup
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Step 2: Admin Info */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="admin.firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="John"
                                  {...field}
                                  data-testid="input-admin-firstname"
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
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Doe"
                                  {...field}
                                  data-testid="input-admin-lastname"
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
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="email"
                                  placeholder="john@example.com"
                                  className="pl-10"
                                  {...field}
                                  data-testid="input-admin-email"
                                />
                              </div>
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
                            <FormLabel>Phone Number (optional)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="+1 (555) 123-4567"
                                  className="pl-10"
                                  {...field}
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const formatted = formatPhoneInput(e.target.value);
                                    field.onChange(formatted);
                                  }}
                                  data-testid="input-admin-phone"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* What happens next */}
                      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                        <p className="text-sm font-medium text-foreground">What happens next?</p>
                        <div className="space-y-1">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                            <p className="text-sm text-muted-foreground">
                              We'll send an activation email with your login credentials
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                            <p className="text-sm text-muted-foreground">
                              You'll be able to set up your account and start your free trial
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                            <p className="text-sm text-muted-foreground">
                              No credit card required for the first 7 days
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        onClick={handleBack}
                        variant="outline"
                        size="lg"
                        className="flex-1"
                        data-testid="button-back"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        size="lg"
                        className="flex-1"
                        data-testid="button-register"
                      >
                        {isLoading ? "Creating account..." : "Create Account"}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </Form>

            {/* Sign in link */}
            {currentStep === 1 && (
              <div className="text-center mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => setLocation("/login")}
                    className="text-primary hover:text-primary/80 font-medium transition-colors"
                    data-testid="link-login"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}