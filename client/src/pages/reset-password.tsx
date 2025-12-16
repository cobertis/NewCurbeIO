import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Check, X, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout } from "@/components/auth-layout";

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 1) return { score, label: "Weak", color: "text-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "text-orange-500" };
  if (score <= 3) return { score, label: "Good", color: "text-yellow-600" };
  return { score, label: "Strong", color: "text-green-600" };
};

const validatePasswordRequirements = (password: string) => ({
  minLength: password.length >= 8,
  hasUpperCase: /[A-Z]/.test(password),
  hasLowerCase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecialChar: /[^a-zA-Z0-9]/.test(password),
});

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (!tokenParam) {
      toast({
        title: "Invalid Link",
        description: "No reset token found in the URL",
        variant: "destructive",
      });
      setIsValidating(false);
      return;
    }

    setToken(tokenParam);

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/validate-password-reset-token?token=${tokenParam}`, {
          credentials: "include",
        });

        if (response.ok) {
          setIsValidToken(true);
        } else {
          const error = await response.json();
          toast({
            title: "Invalid or Expired Link",
            description: error.message || "This password reset link is invalid or has expired",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to validate reset link",
          variant: "destructive",
        });
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const requirements = validatePasswordRequirements(password);
    
    if (!requirements.minLength) {
      toast({ title: "Password Too Short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (!requirements.hasUpperCase) {
      toast({ title: "Missing Uppercase", description: "Password must contain at least one uppercase letter", variant: "destructive" });
      return;
    }
    if (!requirements.hasLowerCase) {
      toast({ title: "Missing Lowercase", description: "Password must contain at least one lowercase letter", variant: "destructive" });
      return;
    }
    if (!requirements.hasNumber) {
      toast({ title: "Missing Number", description: "Password must contain at least one number", variant: "destructive" });
      return;
    }
    if (!requirements.hasSpecialChar) {
      toast({ title: "Missing Special Character", description: "Password must contain at least one special character", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords Don't Match", description: "Please make sure both passwords match", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        toast({
          title: "Password Reset Successfully!",
          description: "Your password has been reset. You can now log in.",
        });
        setTimeout(() => setLocation("/login"), 2000);
      } else {
        const error = await response.json();
        toast({
          title: "Reset Failed",
          description: error.message || "Failed to reset password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <AuthLayout
        title="Validating..."
        subtitle="Please wait while we validate your reset link"
        footer={<div />}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (!isValidToken) {
    return (
      <AuthLayout
        title="Link expired"
        subtitle="This password reset link is no longer valid."
        footer={
          <div className="text-center text-[13px] text-gray-500">
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="text-gray-900 hover:text-gray-700 font-medium transition-colors inline-flex items-center gap-1.5"
              data-testid="link-back-to-login"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <Button
            onClick={() => setLocation("/forgot-password")}
            className="w-full h-12 text-[14px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow-md"
            data-testid="button-request-new-link"
          >
            Request new link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const requirements = validatePasswordRequirements(password);

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Choose a strong password you'll remember."
      footer={
        <div className="text-center text-[13px] text-gray-500">
          <button
            type="button"
            onClick={() => setLocation("/login")}
            className="text-gray-900 hover:text-gray-700 font-medium transition-colors inline-flex items-center gap-1.5"
            data-testid="link-back-to-login"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
            New password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 px-4 pr-12 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
              required
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {password && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-gray-500">Strength:</span>
              <span className={`text-[12px] font-medium ${checkPasswordStrength(password).color}`}>
                {checkPasswordStrength(password).label}
              </span>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < checkPasswordStrength(password).score 
                      ? checkPasswordStrength(password).score <= 1 ? 'bg-red-500' 
                        : checkPasswordStrength(password).score <= 2 ? 'bg-orange-500' 
                        : checkPasswordStrength(password).score <= 3 ? 'bg-yellow-500' 
                        : 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="block text-[12px] text-gray-500 font-medium tracking-wide">
            Confirm password
          </label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 px-4 pr-12 bg-white border border-gray-200 rounded-lg text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0 transition-all outline-none"
              required
              data-testid="input-confirm-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="button-toggle-confirm-password"
            >
              {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {password && (
          <div className="space-y-1.5 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">Requirements</p>
            {Object.entries({
              minLength: "At least 8 characters",
              hasUpperCase: "One uppercase letter",
              hasLowerCase: "One lowercase letter",
              hasNumber: "One number",
              hasSpecialChar: "One special character",
            }).map(([key, label]) => {
              const isValid = requirements[key as keyof typeof requirements];
              return (
                <div key={key} className="flex items-center gap-2 text-[12px]">
                  {isValid ? <Check className="h-3 w-3 text-green-600" /> : <X className="h-3 w-3 text-gray-400" />}
                  <span className={isValid ? "text-green-700" : "text-gray-500"}>{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 text-[14px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-70"
          disabled={isLoading}
          data-testid="button-reset-password"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
