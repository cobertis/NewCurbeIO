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
import { AuthLayout } from "@/components/auth-layout";

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

  const handleGoogleSSO = () => {
    toast({
      title: "Coming soon",
      description: "Google SSO will be available shortly.",
      duration: 3000,
    });
  };

  return (
    <AuthLayout
      title="Create workspace"
      subtitle="Get started in under 2 minutes."
      ssoEnabled={true}
      onGoogleSSO={handleGoogleSSO}
      footer={
        <div className="text-center text-[13px] text-gray-500">
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
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-[11px] text-gray-500 font-medium ml-0.5">Work email</label>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      className="h-[46px] px-4 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[14px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
                      {...field}
                      autoComplete="email"
                      data-testid="input-email"
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
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
                        className="h-[46px] px-4 pr-12 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
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
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Company / workspace name</label>
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Acme Insurance"
                      className="h-[46px] px-4 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
                      {...field}
                      autoComplete="organization"
                      data-testid="input-company"
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-1">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="h-[16px] w-[16px] border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
                    data-testid="checkbox-terms"
                  />
                </FormControl>
                <div className="leading-none">
                  <label className="text-[12px] text-gray-600 leading-snug cursor-pointer" onClick={() => field.onChange(!field.value)}>
                    I agree to the{" "}
                    <a href="https://curbe.io/terms" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Terms</a>
                    {" "}and{" "}
                    <a href="https://curbe.io/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-gray-900 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>Privacy Policy</a>
                  </label>
                  <FormMessage className="text-[10px] mt-0.5" />
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-[46px] text-[15px] font-semibold bg-gray-900 hover:bg-gray-800 hover:-translate-y-0.5 hover:shadow-md text-white rounded-full mt-2 transition-all duration-200 focus:ring-2 focus:ring-gray-900/25 focus:ring-offset-2 focus:outline-none shadow-sm"
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
        </form>
      </Form>
    </AuthLayout>
  );
}
