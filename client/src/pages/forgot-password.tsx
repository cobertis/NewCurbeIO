import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout } from "@/components/auth-layout";

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
        description: "Please enter your email",
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
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a password reset link"
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
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <p className="text-center text-gray-500 text-[14px] max-w-[280px]">
            If an account exists with <span className="font-medium text-gray-700">{identifier}</span>, you'll receive a password reset link shortly.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure code."
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
          <label className="block text-[13px] text-gray-600 font-medium">Email</label>
          <Input
            id="identifier"
            type="email"
            placeholder="you@company.com"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="h-[48px] px-4 bg-white border border-gray-200 rounded-xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all outline-none"
            required
            autoComplete="email"
            data-testid="input-identifier"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-[48px] text-[14px] font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-xl transition-colors"
          disabled={isLoading}
          data-testid="button-send-reset-link"
        >
          {isLoading ? "Sending..." : "Send code"}
        </Button>
      </form>
    </AuthLayout>
  );
}
