import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/logo no fondo_1760457183587.png";
import backgroundImage from "@assets/Curbe_SaaS_Brand_Illustration_1765854893427.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deactivated") === "true") {
      toast({
        variant: "destructive",
        title: "Account Deactivated",
        description: "Your account has been deactivated. Please contact support for assistance.",
        duration: 8000,
      });
      window.history.replaceState({}, "", "/login");
    }
  }, [toast]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/session", {
          credentials: "include",
        });

        if (response.ok) {
          setLocation("/dashboard");
        }
      } catch (error) {
      }
    };

    checkAuth();
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.skipOTP) {
          toast({
            title: "Welcome back!",
            description: "Logged in from trusted device",
          });
          setLocation("/dashboard");
        } else {
          const phoneParam = data.user.phone ? `&phone=${encodeURIComponent(data.user.phone)}` : '';
          const email2FAParam = data.user.twoFactorEmailEnabled ? '&email2FA=true' : '';
          const sms2FAParam = data.user.twoFactorSmsEnabled ? '&sms2FA=true' : '';
          setLocation(`/verify-otp?userId=${data.user.id}&email=${encodeURIComponent(email)}${phoneParam}${email2FAParam}${sms2FAParam}`);
        }
      } else {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: data.message || "Invalid credentials",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred. Please try again.",
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
      data-testid="login-page"
    >
      <div className="w-full max-w-[1300px] bg-white rounded-[2rem] shadow-2xl flex flex-col lg:flex-row relative">
        <div className="w-full lg:w-[45%] p-10 md:p-14 relative z-10">
          <div className="flex items-center gap-2 mb-8">
            <img src={logo} alt="Curbe" className="h-12 w-auto" />
          </div>

          <h1 className="text-[1.75rem] md:text-[2.25rem] font-bold text-gray-900 leading-tight mb-3">Welcome back to Curbe</h1>
          <p className="text-gray-500 text-sm mb-6">
            Sign in to continue managing your customer relationships and grow your business.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="example@curbe.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 px-4 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                autoComplete="email"
                data-testid="input-email"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 ml-1">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 px-4 pr-10 bg-white border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  autoComplete="current-password"
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
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-sm text-gray-500 hover:text-gray-700"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-xl mt-3"
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="text-center text-sm text-gray-600 pt-4">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-blue-600 hover:text-blue-700 font-medium"
                data-testid="link-register"
              >
                Register here
              </button>
            </div>
          </form>
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
