import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth-shell";

export default function ActivateAccount() {
  const [, setLocation] = useLocation();
  const [isActivating, setIsActivating] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
      setErrorMessage("No activation token found in the URL");
      setIsActivating(false);
      return;
    }

    const activateAccount = async () => {
      try {
        const response = await fetch("/api/auth/activate-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
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

    activateAccount();
  }, [toast]);

  if (isActivating) {
    return (
      <AuthShell
        title="Activating..."
        subtitle="Please wait while we activate your account"
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
            Thank you for verifying your email. Your account is now active and ready to use.
          </p>
          <Button
            onClick={() => setLocation("/login")}
            className="w-full h-11 text-[13px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150"
            data-testid="button-go-to-login"
          >
            Sign in to your workspace
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Link expired"
      subtitle="This activation link is no longer valid."
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
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10 text-red-600" />
        </div>
        <p className="text-center text-[14px] text-gray-500 mb-4 leading-relaxed">
          {errorMessage || "This activation link has expired or has already been used."}
        </p>
        <p className="text-center text-[13px] text-gray-400 mb-6">
          Please contact support if you need a new activation link.
        </p>
        <Button
          onClick={() => setLocation("/login")}
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
