import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Mail, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthLayout } from "@/components/auth-layout";

export default function VerifyOTP() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("userId");
  const userEmail = params.get("email");
  const userPhone = params.get("phone");
  const email2FAEnabled = params.get("email2FA") === "true";
  const sms2FAEnabled = params.get("sms2FA") === "true";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [method, setMethod] = useState<"email" | "sms">(email2FAEnabled ? "email" : "sms");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiryTime, setExpiryTime] = useState(300);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const maskEmail = (email: string | null) => {
    if (!email) return "";
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return email;
    const maskedLocal = localPart.charAt(0) + "***";
    return `${maskedLocal}@${domain}`;
  };

  const maskPhone = (phone: string | null) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    const lastFour = digits.slice(-4);
    return `XXX-XXX-${lastFour}`;
  };

  const maskedEmail = maskEmail(userEmail);
  const maskedPhone = maskPhone(userPhone);
  const hasPhone = !!userPhone;

  useEffect(() => {
    if (!email2FAEnabled && !sms2FAEnabled) {
      setLocation("/dashboard");
    }
  }, [email2FAEnabled, sms2FAEnabled, setLocation]);

  useEffect(() => {
    if (expiryTime > 0) {
      const timer = setTimeout(() => setExpiryTime(expiryTime - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [expiryTime]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendOTP = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ method }),
      });

      if (response.ok) {
        setOtpSent(true);
        setResendCooldown(60);
        setExpiryTime(300);
        toast({
          title: "Code sent",
          description: `Verification code sent via ${method === "email" ? "email" : "SMS"}`,
        });
      } else {
        const data = await response.json();
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to send verification code",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send verification code",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);

    const nextEmptyIndex = newOtp.findIndex((val) => !val);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid code",
        description: "Please enter all 6 digits",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, code, rememberDevice }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: "You have been logged in successfully",
        });
        if (data.requiresOnboarding) {
          setLocation("/onboarding");
        } else {
          setLocation("/dashboard");
        }
      } else {
        toast({
          variant: "destructive",
          title: "Verification failed",
          description: data.message || "Invalid or expired code",
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

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, method }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendCooldown(60);
        setExpiryTime(300);
        setOtp(["", "", "", "", "", ""]);
        toast({
          title: "Code resent",
          description: `New verification code sent via ${method === "email" ? "email" : "SMS"}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to resend code",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred. Please try again.",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AuthLayout
      title={otpSent ? "Enter verification code" : "Two-factor authentication"}
      subtitle={
        otpSent 
          ? `We sent a 6-digit code to ${method === "email" ? maskedEmail : maskedPhone}`
          : "Choose how you'd like to receive your code"
      }
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
      {!otpSent ? (
        <div className="space-y-5">
          <div>
            <Label className="text-[12px] font-medium text-gray-500 tracking-wide mb-3 block">
              Verification method
            </Label>
            <RadioGroup 
              value={method} 
              onValueChange={(value) => setMethod(value as "email" | "sms")}
              className="space-y-2.5"
              data-testid="radio-group-method"
            >
              {email2FAEnabled && (
                <div className={`flex items-center space-x-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
                  method === "email" 
                    ? "border-gray-900 bg-gray-50" 
                    : "border-gray-200 hover:border-gray-300"
                }`}>
                  <RadioGroupItem value="email" id="email-method" data-testid="radio-email" />
                  <Label htmlFor="email-method" className="flex items-center flex-1 cursor-pointer">
                    <Mail className="h-5 w-5 text-gray-500 mr-3" />
                    <div>
                      <div className="text-[14px] font-medium text-gray-900">Email</div>
                      <div className="text-[12px] text-gray-500">{maskedEmail}</div>
                    </div>
                  </Label>
                </div>
              )}

              {sms2FAEnabled && (
                <div className={`flex items-center space-x-3 p-3.5 rounded-lg border transition-all ${
                  !hasPhone 
                    ? "opacity-50 cursor-not-allowed border-gray-200" 
                    : method === "sms" 
                      ? "border-gray-900 bg-gray-50 cursor-pointer" 
                      : "border-gray-200 hover:border-gray-300 cursor-pointer"
                }`}>
                  <RadioGroupItem value="sms" id="sms-method" disabled={!hasPhone} data-testid="radio-sms" />
                  <Label htmlFor="sms-method" className={`flex items-center flex-1 ${hasPhone ? "cursor-pointer" : "cursor-not-allowed"}`}>
                    <MessageSquare className="h-5 w-5 text-gray-500 mr-3" />
                    <div>
                      <div className="text-[14px] font-medium text-gray-900">SMS</div>
                      <div className="text-[12px] text-gray-500">
                        {hasPhone ? maskedPhone : "No phone number on file"}
                      </div>
                    </div>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          <Button
            onClick={sendOTP}
            className="w-full h-12 text-[14px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-70"
            disabled={isLoading}
            data-testid="button-send-code"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send code"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* OTP Input Grid */}
          <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-11 h-12 text-center text-lg font-semibold bg-white border-gray-200 rounded-lg focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:ring-offset-0"
                data-testid={`input-otp-${index}`}
              />
            ))}
          </div>

          {/* Remember device */}
          <div className="flex items-center space-x-2.5">
            <Checkbox
              id="remember"
              checked={rememberDevice}
              onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
              className="h-4 w-4 border-gray-300 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 rounded"
              data-testid="checkbox-remember-device"
            />
            <Label htmlFor="remember" className="text-[13px] text-gray-600 cursor-pointer">
              Remember this device for 30 days
            </Label>
          </div>

          <Button
            onClick={handleVerify}
            className="w-full h-12 text-[14px] font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-70"
            disabled={isLoading || otp.join("").length !== 6}
            data-testid="button-verify"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>

          {/* Expiry and resend */}
          <div className="text-center space-y-1.5">
            <p className="text-[12px] text-gray-500">
              Code expires in <span className="font-medium text-gray-700">{formatTime(expiryTime)}</span>
            </p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={`text-[13px] font-medium transition-colors ${
                resendCooldown > 0
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-900 hover:text-gray-700"
              }`}
              data-testid="button-resend"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
