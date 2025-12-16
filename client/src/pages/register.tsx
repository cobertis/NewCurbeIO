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

          <h1 className="text-[2.25rem] md:text-[2.75rem] font-semibold text-gray-900 leading-[1.08] tracking-[-0.02em] mb-2">
            Create your workspace
          </h1>
          <p className="text-gray-500 text-[15px] mb-8">
            Get started in under 2 minutes.
          </p>

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
                <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Workspace name</label>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Acme Inc."
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
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label className="text-[13px] text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                        I agree to the{" "}
                        <a href="/terms" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                        {" "}and{" "}
                        <a href="/privacy" className="text-gray-700 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                      </label>
                      <FormMessage />
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
                Verify your email to activate. Takes ~2 minutes.
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
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <span className="text-white/90 text-[13px] font-medium">Unified journey</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
