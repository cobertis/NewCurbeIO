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

  const handleGoogleSSO = () => {
    window.location.href = "/api/auth/google";
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 md:p-8"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0f1a2e 0%, #050B14 50%, #020408 100%)',
      }}
      data-testid="login-page"
    >
      <div className="w-full max-w-[1200px] flex flex-col lg:flex-row gap-6 lg:gap-0">
        <div 
          className="w-full lg:w-[42%] p-10 md:p-14 relative z-10 lg:rounded-l-[2rem] lg:rounded-r-none rounded-[2rem]"
          style={{
            background: 'rgba(250, 250, 252, 0.97)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 32px 64px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.03)',
          }}
        >
          <div className="flex items-center gap-2 mb-12">
            <img src={logo} alt="Curbe" className="h-10 w-auto" />
          </div>

          <h1 className="text-[2rem] md:text-[2.5rem] font-semibold text-gray-900 leading-[1.1] tracking-tight mb-3">
            Welcome back.
          </h1>
          <p className="text-gray-500 text-[15px] mb-10">
            Pick up where you left off.
          </p>

          <button
            type="button"
            onClick={handleGoogleSSO}
            className="w-full h-[52px] flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-full text-[15px] font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 mb-6"
            style={{
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            data-testid="button-google-sso"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-[13px] text-gray-500 font-medium ml-1">Work email</label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[52px] px-5 bg-white/80 border-gray-200 rounded-xl text-[15px] placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all duration-200"
                required
                autoComplete="email"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] text-gray-500 font-medium ml-1">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[52px] px-5 pr-12 bg-white/80 border-gray-200 rounded-xl text-[15px] placeholder:text-gray-400 focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all duration-200"
                  required
                  autoComplete="current-password"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-150"
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

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors duration-150"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] text-[15px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-full mt-2 transition-all duration-200"
              style={{
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              }}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <p className="text-center text-[12px] text-gray-400 pt-3">
              Secure sign-in. Verify email on first login.
            </p>

            <div className="text-center text-[14px] text-gray-500 pt-2">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-gray-900 hover:text-gray-700 font-medium transition-colors duration-150"
                data-testid="link-register"
              >
                Create a workspace
              </button>
            </div>
          </form>
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
