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
import { Loader2, Eye, EyeOff, ChevronDown } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const COUNTRIES = [
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸" },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", dialCode: "+351", flag: "🇵🇹" },
  { code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", dialCode: "+54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dialCode: "+56", flag: "🇨🇱" },
  { code: "CO", name: "Colombia", dialCode: "+57", flag: "🇨🇴" },
  { code: "PE", name: "Peru", dialCode: "+51", flag: "🇵🇪" },
  { code: "VE", name: "Venezuela", dialCode: "+58", flag: "🇻🇪" },
  { code: "EC", name: "Ecuador", dialCode: "+593", flag: "🇪🇨" },
  { code: "UY", name: "Uruguay", dialCode: "+598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay", dialCode: "+595", flag: "🇵🇾" },
  { code: "BO", name: "Bolivia", dialCode: "+591", flag: "🇧🇴" },
  { code: "CR", name: "Costa Rica", dialCode: "+506", flag: "🇨🇷" },
  { code: "PA", name: "Panama", dialCode: "+507", flag: "🇵🇦" },
  { code: "GT", name: "Guatemala", dialCode: "+502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", dialCode: "+504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", dialCode: "+503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", dialCode: "+505", flag: "🇳🇮" },
  { code: "DO", name: "Dominican Republic", dialCode: "+1", flag: "🇩🇴" },
  { code: "PR", name: "Puerto Rico", dialCode: "+1", flag: "🇵🇷" },
  { code: "CU", name: "Cuba", dialCode: "+53", flag: "🇨🇺" },
  { code: "JM", name: "Jamaica", dialCode: "+1", flag: "🇯🇲" },
  { code: "TT", name: "Trinidad and Tobago", dialCode: "+1", flag: "🇹🇹" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", dialCode: "+64", flag: "🇳🇿" },
  { code: "JP", name: "Japan", dialCode: "+81", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", dialCode: "+82", flag: "🇰🇷" },
  { code: "CN", name: "China", dialCode: "+86", flag: "🇨🇳" },
  { code: "HK", name: "Hong Kong", dialCode: "+852", flag: "🇭🇰" },
  { code: "TW", name: "Taiwan", dialCode: "+886", flag: "🇹🇼" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "MY", name: "Malaysia", dialCode: "+60", flag: "🇲🇾" },
  { code: "TH", name: "Thailand", dialCode: "+66", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", dialCode: "+84", flag: "🇻🇳" },
  { code: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
  { code: "ID", name: "Indonesia", dialCode: "+62", flag: "🇮🇩" },
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", dialCode: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dialCode: "+880", flag: "🇧🇩" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦" },
  { code: "IL", name: "Israel", dialCode: "+972", flag: "🇮🇱" },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷" },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬" },
  { code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦" },
  { code: "RU", name: "Russia", dialCode: "+7", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", dialCode: "+380", flag: "🇺🇦" },
  { code: "PL", name: "Poland", dialCode: "+48", flag: "🇵🇱" },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭" },
  { code: "AT", name: "Austria", dialCode: "+43", flag: "🇦🇹" },
  { code: "SE", name: "Sweden", dialCode: "+46", flag: "🇸🇪" },
  { code: "NO", name: "Norway", dialCode: "+47", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", dialCode: "+45", flag: "🇩🇰" },
  { code: "FI", name: "Finland", dialCode: "+358", flag: "🇫🇮" },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪" },
  { code: "CZ", name: "Czech Republic", dialCode: "+420", flag: "🇨🇿" },
  { code: "RO", name: "Romania", dialCode: "+40", flag: "🇷🇴" },
  { code: "HU", name: "Hungary", dialCode: "+36", flag: "🇭🇺" },
  { code: "GR", name: "Greece", dialCode: "+30", flag: "🇬🇷" },
];

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Only numbers allowed"),
  email: z.string().email("Invalid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character (!@#$%...)"),
  termsAccepted: z.boolean().refine((val) => val === true, "Required"),
});

const googleSSOSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters"),
  termsAccepted: z.boolean().refine((val) => val === true, "Required"),
});

type RegisterForm = z.infer<typeof registerSchema>;
type GoogleSSOForm = z.infer<typeof googleSSOSchema>;

// Detect Google SSO params before component renders
function getGoogleSSOParams() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const sso = params.get('sso');
  const email = params.get('email');
  const name = params.get('name');
  const googleId = params.get('googleId');
  
  if (sso === 'google' && email && googleId) {
    return { email, name: name || '', googleId };
  }
  return null;
}

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Initialize Google SSO state from URL params
  const initialGoogleSSO = getGoogleSSOParams();
  const [googleSSO, setGoogleSSO] = useState<{
    email: string;
    name: string;
    googleId: string;
  } | null>(initialGoogleSSO);

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workspaceName: "",
      phone: "",
      email: "",
      password: "",
      termsAccepted: false,
    },
  });

  const googleForm = useForm<GoogleSSOForm>({
    resolver: zodResolver(googleSSOSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workspaceName: initialGoogleSSO?.name || "",
      termsAccepted: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const slug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const payload = {
        company: {
          name: data.workspaceName,
          slug: slug,
        },
        admin: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          phone: `${selectedCountry.dialCode}${data.phone}`,
        },
      };
      
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes from the backend
        if (result.error === "PASSWORD_EXPOSED") {
          throw new Error("This password appears in known data breaches. Please choose a different password.");
        }
        if (result.error === "PASSWORD_CHECK_UNAVAILABLE") {
          throw new Error("Password validation service temporarily unavailable. Please try again.");
        }
        throw new Error(result.message || "Registration failed");
      }

      toast({
        title: "Workspace created!",
        description: "Please check your email to verify your account.",
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

  const onGoogleSSOSubmit = async (data: GoogleSSOForm) => {
    if (!googleSSO) return;
    
    setIsLoading(true);
    try {
      const slug = data.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const payload = {
        company: {
          name: data.workspaceName,
          slug: slug,
        },
        admin: {
          email: googleSSO.email,
          googleId: googleSSO.googleId,
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
        title: "Workspace created!",
        description: "You can now sign in with Google.",
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

  const handleGoogleSSO = () => {
    window.location.href = "/api/auth/google";
  };

  if (googleSSO) {
    return (
      <AuthShell
        title="Complete your signup"
        subtitle={`Signing up as ${googleSSO.email}`}
        footer={
          <div className="text-center text-[13px] text-gray-500">
            Want to use a different account?{" "}
            <button
              type="button"
              onClick={() => {
                setGoogleSSO(null);
                window.history.replaceState({}, '', '/register');
              }}
              className="text-gray-900 hover:text-gray-700 font-medium transition-colors"
              data-testid="link-different-account"
            >
              Start over
            </button>
          </div>
        }
      >
        <Form {...googleForm}>
          <form onSubmit={googleForm.handleSubmit(onGoogleSSOSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
                Workspace name
              </label>
              <FormField
                control={googleForm.control}
                name="workspaceName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Your company or team name"
                        className="h-11 px-4 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="organization"
                        data-testid="input-workspace-name"
                      />
                    </FormControl>
                    <div className="h-4">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={googleForm.control}
              name="termsAccepted"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-2.5 space-y-0 pt-1">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-4 w-4 mt-0.5 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
                      data-testid="checkbox-terms"
                    />
                  </FormControl>
                  <div className="leading-none">
                    <label className="text-[12px] text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                      I agree to the{" "}
                      <a href="https://curbe.io/terms" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms</a>
                      {" "}and{" "}
                      <a href="https://curbe.io/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                    </label>
                    <div className="h-4">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow disabled:opacity-70"
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create workspace"
              )}
            </Button>
          </form>
        </Form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create workspace"
      subtitle="Get started in minutes"
      onGoogleSSO={handleGoogleSSO}
      footer={
        <div className="text-center text-[13px] text-gray-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-gray-900 hover:text-gray-700 font-medium transition-colors"
            data-testid="link-login"
          >
            Sign in
          </button>
        </div>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
                First name
              </label>
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="John"
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="given-name"
                        data-testid="input-first-name"
                      />
                    </FormControl>
                    <div className="h-3">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
                Last name
              </label>
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Doe"
                        className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="family-name"
                        data-testid="input-last-name"
                      />
                    </FormControl>
                    <div className="h-3">
                      <FormMessage className="text-[10px]" />
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Workspace name
            </label>
            <FormField
              control={form.control}
              name="workspaceName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="Your company or team name"
                      className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      {...field}
                      autoComplete="organization"
                      data-testid="input-workspace-name"
                    />
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Phone number
            </label>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex">
                      <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1 h-10 px-2 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg text-[14px] text-gray-700 hover:bg-gray-100 transition-colors min-w-[80px]"
                            data-testid="button-country-selector"
                          >
                            <span className="text-lg">{selectedCountry.flag}</span>
                            <span className="text-[13px] font-medium">{selectedCountry.dialCode}</span>
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <ScrollArea className="h-[300px]">
                            <div className="p-1">
                              {COUNTRIES.map((country) => (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCountry(country);
                                    setCountryOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] rounded hover:bg-gray-100 transition-colors ${
                                    selectedCountry.code === country.code ? "bg-gray-100" : ""
                                  }`}
                                  data-testid={`country-option-${country.code}`}
                                >
                                  <span className="text-lg">{country.flag}</span>
                                  <span className="flex-1 text-gray-900">{country.name}</span>
                                  <span className="text-gray-500">{country.dialCode}</span>
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        className="h-10 px-3 bg-white border border-gray-200 rounded-l-none rounded-r-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none flex-1"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                        autoComplete="tel-national"
                        data-testid="input-phone"
                      />
                    </div>
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Work email
            </label>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                      {...field}
                      autoComplete="email"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium tracking-wide uppercase">
              Password
            </label>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="8+ chars, uppercase, number, symbol"
                        className="h-10 px-3 pr-10 bg-white border border-gray-200 rounded-lg text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
                        {...field}
                        autoComplete="new-password"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="h-4 w-4 mt-0.5 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
                    data-testid="checkbox-terms"
                  />
                </FormControl>
                <div className="leading-none">
                  <label className="text-[11px] text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                    By signing up or otherwise using our services, you agree to be bound by our{" "}
                    <a href="https://curbe.io/terms" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms of use</a>
                    {" "}and{" "}
                    <a href="https://curbe.io/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy policy</a>.
                  </label>
                  <div className="h-3">
                    <FormMessage className="text-[10px]" />
                  </div>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow disabled:opacity-70"
            data-testid="button-register"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create workspace"
            )}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
