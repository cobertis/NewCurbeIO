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
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(1, "Workspace name is required"),
  termsAccepted: z.boolean().refine((val) => val === true, "You must accept the Terms of Service and Privacy Policy"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      companyName: "",
      termsAccepted: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const slug = data.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const payload = {
        company: {
          name: data.companyName,
          slug: slug,
        },
        admin: {
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

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 relative"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 50%, #0C1829 0%, #070F1E 50%, #050B14 100%)',
      }}
      data-testid="register-page"
    >
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="w-full max-w-[1200px] flex flex-col lg:flex-row gap-0 relative z-10">
        <div 
          className="w-full lg:w-[42%] p-12 md:p-14 relative z-10 lg:rounded-l-[2rem] lg:rounded-r-none rounded-[2rem] overflow-hidden"
          style={{
            background: '#F6F8FB',
            boxShadow: '0 25px 80px -12px rgba(0,0,0,0.08), 0 4px 20px -4px rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.03)',
          }}
        >
          <div 
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="flex items-center gap-2 mb-10">
            <img src={logo} alt="Curbe" className="h-9 w-auto" />
          </div>

          <h1 className="text-[1.875rem] md:text-[2.25rem] font-semibold text-gray-900 leading-[1.1] tracking-[-0.02em] mb-2">
            Create workspace
          </h1>
          <p className="text-gray-500 text-[15px] mb-6">
            Get started in under 2 minutes.
          </p>

          <button
            type="button"
            className="w-full h-[50px] flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl text-[14px] font-medium text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-150"
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
            }}
            data-testid="button-google-sso"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-900/[0.06]"></div>
            <span className="text-[10px] text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-900/[0.06]"></div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Work email</label>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@company.com"
                          className="h-[50px] px-4 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
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

              <div className="space-y-1.5">
                <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Password</label>
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
                            className="h-[50px] px-4 pr-12 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
                            {...field}
                            autoComplete="new-password"
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400/60 hover:text-gray-500 transition-colors duration-150"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? (
                              <EyeOff className="h-[18px] w-[18px]" />
                            ) : (
                              <Eye className="h-[18px] w-[18px]" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Company / workspace name</label>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Acme Insurance"
                          className="h-[50px] px-4 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
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

              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-3 pb-1">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="h-[18px] w-[18px] border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="leading-none">
                      <label className="text-[13px] text-gray-600 leading-snug cursor-pointer" onClick={() => field.onChange(!field.value)}>
                        I agree to the{" "}
                        <a href="/terms" className="text-gray-800 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                        {" "}and{" "}
                        <a href="/privacy" className="text-gray-800 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                      </label>
                      <FormMessage className="mt-1" />
                    </div>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-[50px] text-[15px] font-semibold bg-gray-900 hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-md text-white rounded-full mt-4 transition-all duration-200 focus:ring-2 focus:ring-gray-900/25 focus:ring-offset-2 focus:outline-none shadow-sm"
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating workspace...
                  </>
                ) : (
                  "Create workspace"
                )}
              </Button>

              <p className="text-center text-[11px] text-gray-400 pt-2">
                Verify your email to activate.
              </p>

              <div className="text-center text-[13px] text-gray-500 pt-1">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-gray-900 hover:text-gray-700 font-medium transition-colors duration-150"
                  data-testid="link-login"
                >
                  Sign in
                </button>
              </div>
            </form>
          </Form>
        </div>

        <div className="hidden lg:block w-[58%] relative rounded-r-[2rem] overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
            }}
          />
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 60%)',
            }}
          />
          <div 
            className="absolute bottom-0 left-0 right-0 p-10"
            style={{
              backdropFilter: 'blur(8px)',
              background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
            }}
          >
            <h2 className="text-[1.75rem] font-semibold text-white mb-2 tracking-tight">
              Turn every interaction into progress.
            </h2>
            <p className="text-white/60 text-sm max-w-md mb-6">
              From first hello to loyal customer—without the chaos.
            </p>
            
            <div className="flex gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-white/90 text-[13px] font-medium">Automation</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
