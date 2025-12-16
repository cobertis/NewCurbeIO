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
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8"
      style={{
        background: 'radial-gradient(ellipse at center, #0a1628 0%, #050B14 70%, #030810 100%)',
      }}
      data-testid="register-page"
    >
      <div 
        className="w-full max-w-[1300px] bg-white rounded-[2rem] flex flex-col lg:flex-row relative"
        style={{
          boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="w-full lg:w-[45%] p-12 md:p-16 relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <img src={logo} alt="Curbe" className="h-12 w-auto" />
          </div>

          <h1 className="text-[1.75rem] md:text-[2.25rem] font-bold text-gray-900 leading-tight mb-3">Create your workspace</h1>
          <p className="text-gray-500 text-sm mb-6">
            A smarter system that turns every touchpoint into momentum—automated, consistent, and measurable.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">Work Email</label>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@company.com"
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
                <label className="block text-xs text-gray-400 mb-1 ml-1">Password</label>
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
                            className="h-11 px-4 pr-10 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">Workspace Name</label>
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

              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <label className="text-xs text-gray-500 leading-relaxed cursor-pointer" onClick={() => field.onChange(!field.value)}>
                        I agree to the{" "}
                        <a href="/terms" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
                        {" "}and{" "}
                        <a href="/privacy" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>.
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
                    Creating workspace...
                  </>
                ) : (
                  "Create workspace"
                )}
              </Button>

              <p className="text-center text-xs text-gray-400 pt-2">
                Verify your email to activate. Takes ~2 minutes.
              </p>

              <div className="text-center text-sm text-gray-600 pt-1">
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
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 text-center z-10">
            <h2 className="text-2xl font-bold text-white mb-2">Turn every interaction into progress.</h2>
            <p className="text-white/70 text-xs max-w-sm mx-auto mb-5">From first hello to loyal customer—without the chaos.</p>
            
            <div className="flex flex-nowrap justify-center gap-3 overflow-hidden">
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap">Automation</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-pink-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap">Unified journey</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
