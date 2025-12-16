import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
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

      if (data.requiresOnboarding) {
        setLocation("/onboarding");
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
    window.location.href = "/api/auth/google";
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace"
      ssoEnabled={true}
      onGoogleSSO={handleGoogleSSO}
      footer={
        <div className="text-center text-[13px] text-gray-500">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => setLocation("/register")}
            className="text-gray-900 hover:text-gray-700 font-medium transition-colors"
            data-testid="link-register"
          >
            Create workspace
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
            Work email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 px-4 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
            required
            autoComplete="email"
            data-testid="input-email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
              Password
            </label>
            <button
              type="button"
              onClick={() => setLocation("/forgot-password")}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
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
              className="h-12 px-4 pr-12 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
              required
              autoComplete="current-password"
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
          className="w-full h-12 text-[14px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-70"
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
      </form>
    </AuthLayout>
  );
}
