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
import { formatPhoneInput } from "@shared/phone";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/mountain_road_background.png";

const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required").refine(
    (val) => {
      const digits = val.replace(/\D/g, '');
      return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
    },
    "Valid phone number is required"
  ),
  password: z.string().min(6, "Password must be at least 6 characters"),
  smsConsent: z.boolean().refine(val => val === true, "You must agree to receive SMS messages"),
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
      username: "",
      email: "",
      phone: "",
      password: "",
      smsConsent: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
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
      <div className="w-full max-w-[1100px] bg-white rounded-[2rem] shadow-2xl flex flex-col lg:flex-row relative">
        <div className="w-full lg:w-[50%] p-10 md:p-12 relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <img src={logo} alt="Curbe" className="h-8 w-auto" />
          </div>

          <h1 className="text-[1.75rem] md:text-[2.25rem] font-bold text-gray-900 leading-tight mb-3">
            This is where incredible experiences start.
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            More than Thousand Locations for customized just for you. You can start now for start your journey.
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-xs text-gray-400 mb-1 ml-1">Username</label>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="Jahan"
                          className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          {...field}
                          autoComplete="username"
                          data-testid="input-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                            placeholder="••••••••••"
                            className="h-11 px-4 pr-10 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            {...field}
                            autoComplete="new-password"
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
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
                  <FormItem className="flex items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-sms-consent"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <p className="text-[10px] text-gray-500 leading-relaxed">
                        By providing your phone number, you agree to receive SMS promotional offers and marketing updates from Curbe.io. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for help. We will not share mobile information with third parties for promotional or marketing purposes.
                      </p>
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
                  "Start Journey"
                )}
              </Button>

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

        <div className="hidden lg:block w-[50%] relative m-4 ml-0">
          <div 
            className="absolute inset-0 bg-cover bg-center rounded-[1.5rem]"
            style={{ 
              backgroundImage: `url(${backgroundImage})`,
              clipPath: 'polygon(0 0, calc(100% - 180px) 0, calc(100% - 180px) 30px, calc(100% - 30px) 30px, calc(100% - 30px) 220px, 100% 220px, 100% 100%, 0 100%)',
            }}
          />
          <div 
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent rounded-[1.5rem]"
            style={{ 
              clipPath: 'polygon(0 0, calc(100% - 180px) 0, calc(100% - 180px) 30px, calc(100% - 30px) 30px, calc(100% - 30px) 220px, 100% 220px, 100% 100%, 0 100%)',
            }}
          />
          
          <div className="absolute top-[30px] right-0 w-[180px] bg-white rounded-bl-[30px] p-5 z-20">
            <div 
              className="absolute left-0 bottom-[-30px] w-[30px] h-[30px] bg-transparent"
              style={{
                borderTopRightRadius: '30px',
                boxShadow: '15px -15px 0 0 white',
              }}
            />
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
            <h2 className="text-2xl font-bold text-white mb-2">
              We are a Family
            </h2>
            <p className="text-white/70 text-xs max-w-sm mx-auto mb-5">
              In camp we have a lot people with different life story that help you feel more better in trip
            </p>
            
            <div className="flex flex-nowrap justify-center gap-3 overflow-hidden">
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-orange-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap"># Curbe_Trip</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap"># Be_happy</span>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shrink-0">
                <div className="w-3 h-3 rounded-full bg-pink-400" />
                <span className="text-white text-sm font-medium whitespace-nowrap"># Be_happy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
