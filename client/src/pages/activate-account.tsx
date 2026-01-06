import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowLeft, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth-shell";

export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (!tokenParam) {
      setErrorMessage("No activation token found in the URL");
      setIsValidating(false);
      return;
    }

    // Validate token first
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/validate-activation-token?token=${tokenParam}`, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          setToken(tokenParam);
        } else {
          const error = await response.json();
          setErrorMessage(error.message || "This activation link is invalid or has expired");
        }
      } catch (error) {
        setErrorMessage("An error occurred while validating your link");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setIsActivating(true);

    try {
      const response = await fetch("/api/auth/activate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        setIsSuccess(true);
        toast({
          title: "Account activated!",
          description: "You can now sign in to your workspace.",
          duration: 3000,
        });
      } else {
        const error = await response.json();
        setErrorMessage(error.message || "This activation link is invalid or has expired");
      }
    } catch (error) {
      setErrorMessage("An error occurred while activating your account");
    } finally {
      setIsActivating(false);
    }
  };

  if (isValidating) {
    return (
      <AuthShell
        title="Validating..."
        subtitle="Please wait while we verify your activation link"
        footer={<div />}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
          <p className="mt-4 text-[14px] text-gray-500">This will only take a moment</p>
        </div>
      </AuthShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthShell
        title="Account activated!"
        subtitle="Your workspace is ready. You can now sign in."
        footer={<div />}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <p className="text-center text-[14px] text-gray-500 mb-6 leading-relaxed max-w-sm">
            Thank you for setting up your password. Your account is now active and ready to use.
          </p>
          <Button
            onClick={() => setLocation("/auth")}
            className="w-full h-11 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150"
            data-testid="button-go-to-login"
          >
            Sign in to your workspace
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (errorMessage) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="This activation link is no longer valid."
        footer={
          <div className="text-center text-[13px] text-gray-500">
            <button
              type="button"
              onClick={() => setLocation("/auth")}
              className="text-gray-900 hover:text-gray-700 font-medium transition-colors inline-flex items-center gap-1.5"
              data-testid="link-back-to-login"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <p className="text-center text-[14px] text-gray-500 mb-4 leading-relaxed">
            {errorMessage}
          </p>
          <p className="text-center text-[13px] text-gray-400 mb-6">
            Please contact your administrator for a new invitation.
          </p>
          <Button
            onClick={() => setLocation("/auth")}
            variant="outline"
            className="w-full h-11 text-[13px] font-medium rounded-lg border-gray-200 hover:bg-gray-50"
            data-testid="button-back-to-login"
          >
            Back to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  // Show password setup form
  return (
    <AuthShell
      title="Set your password"
      subtitle="Create a password to complete your account activation"
      footer={
        <div className="text-center text-[13px] text-gray-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => setLocation("/auth")}
            className="text-gray-900 hover:text-gray-700 font-medium transition-colors"
            data-testid="link-sign-in"
          >
            Sign in
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-[13px] font-medium text-gray-700">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={8}
              className="h-11 pr-10"
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[12px] text-gray-400">Must be at least 8 characters</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-[13px] font-medium text-gray-700">
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              className="h-11 pr-10"
              data-testid="input-confirm-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="button-toggle-confirm-password"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full h-11 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150"
          disabled={isActivating}
          data-testid="button-activate"
        >
          {isActivating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Activating...
            </>
          ) : (
            "Activate Account"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
