import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/logo no fondo_1760457183587.png";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      toast({
        title: "Field Required",
        description: "Please enter your email or username",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier }),
      });

      if (response.ok) {
        setEmailSent(true);
        toast({
          title: "Check Your Email",
          description: "If an account exists, you'll receive a password reset link shortly.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to send reset email",
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

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
        {/* Logo in top left */}
        <div className="absolute top-6 left-6">
          <Link href="/">
            <img 
              src={logo} 
              alt="Curbe.io" 
              className="h-10 w-auto object-contain cursor-pointer"
            />
          </Link>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Check Your Email
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If an account exists with that email or username, we've sent you a password reset link. Please check your inbox and follow the instructions.
              </p>
            </div>
            
            <Button
              onClick={() => setLocation("/login")}
              variant="outline"
              className="w-full h-12 text-base font-medium rounded-lg"
              data-testid="button-back-to-login"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 flex items-center justify-center">
      {/* Logo in top left */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Link href="/">
          <img 
            src={logo} 
            alt="Curbe.io" 
            className="h-8 sm:h-10 w-auto object-contain cursor-pointer"
          />
        </Link>
      </div>

      {/* Forgot Password Card */}
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Mail className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Forgot Password?
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email or username and we'll send you a link to reset your password
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email/Username Input */}
            <div>
              <Input
                id="identifier"
                type="text"
                placeholder="Email or Username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                required
                data-testid="input-identifier"
              />
            </div>

            {/* Send Reset Link Button */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              disabled={isLoading}
              data-testid="button-send-reset-link"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>

            {/* Back to Login Link */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium inline-flex items-center"
                data-testid="link-back-to-login"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
