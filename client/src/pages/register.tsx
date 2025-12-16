import { useState, useId } from "react";
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
import { Loader2 } from "lucide-react";
import { formatPhoneInput } from "@shared/phone";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().min(1, "Company name is required"),
  address: z.string().min(1, "Address is required"),
  apt: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Valid ZIP code is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required").refine(
    (val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
    },
    "Valid phone number is required"
  ),
  smsConsent: z.boolean().refine((val) => val === true, "You must agree to receive SMS messages"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const clipId = useId();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      address: "",
      apt: "",
      city: "",
      state: "",
      zipCode: "",
      email: "",
      phone: "",
      smsConsent: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      // Generate slug from company name
      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      // Map form data to the expected backend format
      const payload = {
        company: {
          name: data.companyName,
          slug: slug,
          phone: data.phone,
          address: data.address,
          addressLine2: data.apt || null,
          city: data.city,
          state: data.state,
          postalCode: data.zipCode,
          country: "US",
        },
        admin: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          smsSubscribed: data.smsConsent,
        },
      };
      
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      <div className="w-full max-w-[1300px] bg-white rounded-[2rem] shadow-2xl flex flex-col lg:flex-row relative">
        <div className="w-full lg:w-[45%] p-10 md:p-14 relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <img src={logo} alt="Curbe" className="h-12 w-auto" />
          </div>

          <h1 className="text-[1.75rem] md:text-[2.25rem] font-bold text-gray-900 leading-tight mb-3">The next era of customer relationships starts here.
</h1>
          <p className="text-gray-500 text-sm mb-6">
            More than Thousand Locations for customized just for you. You can start now for start your journey.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">First Name</label>
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="John"
                            className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            autoComplete="given-name"
                            data-testid="input-firstname"
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
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Doe"
                            className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            autoComplete="family-name"
                            data-testid="input-lastname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">Company Name</label>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Acme Inc."
                          className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          {...field}
                          autoComplete="organization"
                          data-testid="input-company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Street Address</label>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <GooglePlacesAddressAutocomplete
                          value={field.value}
                          onChange={field.onChange}
                          onAddressSelect={(address) => {
                            form.setValue("address", address.street);
                            form.setValue("city", address.city);
                            form.setValue("state", address.state);
                            form.setValue("zipCode", address.postalCode);
                          }}
                          label=""
                          placeholder="Start typing your address..."
                          testId="input-address"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs text-gray-400 mb-1 ml-1">Apt/Suite</label>
                  <FormField
                    control={form.control}
                    name="apt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Apt 4B"
                            className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            data-testid="input-apt"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">City</label>
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Miami"
                            className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            autoComplete="address-level2"
                            data-testid="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">State</label>
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="FL"
                            className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            autoComplete="address-level1"
                            data-testid="input-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 ml-1">ZIP Code</label>
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="33101"
                            className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            autoComplete="postal-code"
                            data-testid="input-zipcode"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="example@curbe.io"
                          className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="(555) 123-4567"
                          className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          {...field}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            field.onChange(formatted);
                          }}
                          autoComplete="tel"
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="smsConsent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-sms-consent"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label className="text-xs text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                        By providing your phone number, you agree to receive SMS promotional offers and marketing updates from Curbe.io. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for help. We will not share mobile information with third parties for promotional or marketing purposes.
                      </label>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-xl mt-3"
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Register"
                )}
              </Button>

              <p className="text-center text-xs text-gray-400 pt-2">
                You'll receive an activation email to get started
              </p>

              <div className="text-center text-sm text-gray-600 pt-1">
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
            </form>
          </Form>
        </div>

        <div className="hidden lg:block w-[55%] relative m-4 ml-0">
          <div className="absolute inset-0 overflow-hidden rounded-[1.5rem]">
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${backgroundImage})`,
              }}
            />
            <div 
              className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
            />
            <div 
              className="absolute top-0 right-0 w-[200px] h-[180px] bg-[#f5f5f5]"
              style={{
                borderBottomLeftRadius: '50px',
              }}
            />
          </div>
          
          <div 
            className="absolute top-4 right-6 w-[170px] p-5 z-20 bg-white rounded-2xl"
            style={{
              boxShadow: '-4px 4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <div className="text-2xl font-bold text-gray-900">+89%</div>
            <div className="text-xs text-gray-500 mt-1">Positive respond from<br/>people</div>
            <Button 
              size="sm" 
              className="mt-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg w-full py-2 text-sm font-medium"
              onClick={() => setLocation("/login")}
            >
              Start Now
            </Button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 text-center z-10">
            <h2 className="text-2xl font-bold text-white mb-2">Turn every interaction into progress.</h2>
            <p className="text-white/70 text-xs max-w-sm mx-auto mb-5">From first hello to loyal customer—without the chaos.</p>
            
            <div className="flex flex-nowrap justify-center gap-3 overflow-hidden">
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap"># CustomerMomentum</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap"># Automation</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-pink-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap"># UnifiedJourney</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
