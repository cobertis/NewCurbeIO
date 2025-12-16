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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { SiGoogle, SiX, SiTwitch } from "react-icons/si";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/generated_images/mountain_road_scenic_background.png";

const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
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
      password: "",
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
      <div className="w-full max-w-[1100px] flex flex-col lg:flex-row relative">
        <div className="absolute -top-0 -right-0 lg:right-[55%] lg:-top-0 z-20 hidden lg:block">
        </div>

        <div className="w-full lg:w-[45%] bg-white rounded-l-[2rem] lg:rounded-r-none rounded-r-[2rem] lg:rounded-l-[2rem] p-8 md:p-10 relative z-10 shadow-2xl">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full border-[3px] border-blue-500 border-t-transparent" style={{ animation: 'spin 3s linear infinite' }} />
            <span className="text-xl font-semibold text-blue-600">Curbe.</span>
          </div>

          <h1 className="text-[1.75rem] md:text-[2.25rem] font-bold text-gray-900 leading-tight mb-3">
            This is where incredible experiences start.
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            More than Thousand Locations for customized just for you. You can start now for start your journey.
          </p>

          <div className="flex items-center justify-center gap-4 mb-5">
            <button className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <SiX className="w-4 h-4 text-gray-700" />
            </button>
            <button className="w-11 h-11 rounded-full bg-[#4285F4] flex items-center justify-center hover:bg-[#3b78dc] transition-colors">
              <SiGoogle className="w-4 h-4 text-white" />
            </button>
            <button className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
              <SiTwitch className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-400 text-sm">Or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg mt-2"
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

        <div className="hidden lg:block w-[55%] relative overflow-hidden rounded-r-[2rem]">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute -top-0 -right-0 bg-white rounded-bl-[1.5rem] p-5 shadow-xl min-w-[170px] z-30">
            <div className="text-2xl font-bold text-gray-900">+89%</div>
            <div className="text-xs text-gray-500 mt-1">Positive respond from<br/>people</div>
            <Button 
              size="sm" 
              className="mt-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg w-full py-2 text-sm"
              onClick={() => setLocation("/login")}
            >
              Start Now
            </Button>
          </div>

          <div className="absolute top-5 right-[190px] flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
            <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent" />
            <span className="text-white text-xs font-medium">Curbe.</span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              We are a Family
            </h2>
            <p className="text-white/70 text-xs max-w-sm mx-auto mb-5">
              In camp we have a lot people with different life story that help you feel more better in trip
            </p>
            
            <div className="flex flex-nowrap justify-center gap-2 overflow-hidden">
              <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                <span className="text-white text-xs whitespace-nowrap"># Curbe_Trip</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-white text-xs whitespace-nowrap"># Curbe.</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-white text-xs whitespace-nowrap"># Be_happy</span>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                <span className="text-white text-xs whitespace-nowrap"># Be_happy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
