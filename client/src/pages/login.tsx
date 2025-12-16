import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff, MessageSquare, Zap } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";

export default function Login() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      if (data.requiresOtp) {
        setLocation(`/verify-otp?email=${encodeURIComponent(email)}&type=login`);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
        duration: 3000,
      });

      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
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

  const TrustBlock = (
    <div className="space-y-2.5 pt-2">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <MessageSquare className="w-3 h-3 text-gray-500" />
        </div>
        <span className="text-[13px] text-gray-500">Unified inbox for SMS, iMessage, WhatsApp</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <Zap className="w-3 h-3 text-gray-500" />
        </div>
        <span className="text-[13px] text-gray-500">Automations that follow up instantly</span>
      </div>
    </div>
  );

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Pick up where you left off."
      ssoEnabled={true}
      onGoogleSSO={handleGoogleSSO}
      trustBlock={TrustBlock}
      footer={
        <div className="text-center text-[13px] text-gray-500">
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
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Work email</label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[52px] px-4 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
            required
            autoComplete="email"
            data-testid="input-email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] text-gray-500 font-medium ml-0.5">Password</label>
            <button
              type="button"
              onClick={() => setLocation("/forgot-password")}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors duration-150"
              data-testid="link-forgot-password"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-[52px] px-4 pr-12 bg-gray-50/50 border border-gray-900/[0.06] rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400/70 focus:bg-white focus:border-blue-500/30 focus:ring-[3px] focus:ring-blue-500/[0.08] transition-all duration-150 outline-none"
              required
              autoComplete="current-password"
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
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-[50px] text-[14px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-full mt-2 transition-all duration-200 focus:ring-2 focus:ring-gray-900/20 focus:ring-offset-2 focus:outline-none"
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

        <p className="text-center text-[11px] text-gray-400">
          Secure sign-in. Verify email on first login.
        </p>
      </form>
    </AuthLayout>
  );
}
