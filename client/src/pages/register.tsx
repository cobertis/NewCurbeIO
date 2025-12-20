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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
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

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      workspaceName: "",
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
      termsAccepted: true,
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
                        placeholder="Min. 8 characters"
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
                    I agree to the{" "}
                    <a href="https://curbe.io/terms" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms</a>
                    {" "}and{" "}
                    <a href="https://curbe.io/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
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
