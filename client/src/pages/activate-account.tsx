import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import logo from "@assets/logo no fondo_1760457183587.png";

// Password strength validation
interface PasswordStrength {
  score: number; // 0-4
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
  if (score <= 3) return { score, label: "Good", color: "text-yellow-500" };
  return { score, label: "Strong", color: "text-green-500" };
};

const validatePasswordRequirements = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^a-zA-Z0-9]/.test(password),
  };
};

export default function ActivateAccount() {
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
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    
    if (!tokenParam) {
      toast({
        title: "Invalid Link",
        description: "No activation token found in the URL",
        variant: "destructive",
      });
      setIsValidating(false);
      return;
    }

    setToken(tokenParam);

    // Validate token
    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/validate-activation-token?token=${tokenParam}`, {
          credentials: "include",
        });

        if (response.ok) {
          setIsValidToken(true);
        } else {
          const error = await response.json();
          toast({
            title: "Invalid or Expired Link",
            description: error.message || "This activation link is invalid or has expired",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to validate activation link",
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
    
    // Validate all password requirements
    if (!requirements.minLength) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (!requirements.hasUpperCase) {
      toast({
        title: "Password Missing Uppercase",
        description: "Password must contain at least one uppercase letter",
        variant: "destructive",
      });
      return;
    }

    if (!requirements.hasLowerCase) {
      toast({
        title: "Password Missing Lowercase",
        description: "Password must contain at least one lowercase letter",
        variant: "destructive",
      });
      return;
    }

    if (!requirements.hasNumber) {
      toast({
        title: "Password Missing Number",
        description: "Password must contain at least one number",
        variant: "destructive",
      });
      return;
    }

    if (!requirements.hasSpecialChar) {
      toast({
        title: "Password Missing Special Character",
        description: "Password must contain at least one special character (!@#$%^&*)",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/activate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password,
        }),
      });

      if (response.ok) {
        toast({
          title: "Account Activated!",
          description: "Your account has been activated successfully. You can now log in.",
        });
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          setLocation("/login");
        }, 2000);
      } else {
        const error = await response.json();
        toast({
          title: "Activation Failed",
          description: error.message || "Failed to activate account",
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Validating...</CardTitle>
            <CardDescription>Please wait while we validate your activation link</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
            <CardDescription>
              This activation link is invalid or has expired. Please contact your administrator for a new activation link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setLocation("/login")}
              className="w-full"
              variant="outline"
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="Curbe Logo" className="h-16 w-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl">Activate Your Account</CardTitle>
            <CardDescription>Set your password to complete account activation</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Password strength:</span>
                    <span className={`text-sm font-medium ${checkPasswordStrength(password).color}`}>
                      {checkPasswordStrength(password).label}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < checkPasswordStrength(password).score 
                            ? checkPasswordStrength(password).score <= 1 
                              ? 'bg-red-500' 
                              : checkPasswordStrength(password).score <= 2 
                              ? 'bg-orange-500' 
                              : checkPasswordStrength(password).score <= 3 
                              ? 'bg-yellow-500' 
                              : 'bg-green-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Requirements */}
              {password && (
                <div className="space-y-1 mt-3 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Password must contain:</p>
                  {Object.entries({
                    minLength: "At least 8 characters",
                    hasUpperCase: "One uppercase letter (A-Z)",
                    hasLowerCase: "One lowercase letter (a-z)",
                    hasNumber: "One number (0-9)",
                    hasSpecialChar: "One special character (!@#$%^&*)",
                  }).map(([key, label]) => {
                    const requirements = validatePasswordRequirements(password);
                    const isValid = requirements[key as keyof typeof requirements];
                    return (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        {isValid ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={isValid ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-activate-account"
            >
              {isLoading ? (
                "Activating..."
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Activate Account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
