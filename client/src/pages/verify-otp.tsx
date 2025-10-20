import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Shield, Mail, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@assets/logo no fondo_1760457183587.png";

export default function VerifyOTP() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("userId");
  const userEmail = params.get("email");
  const userPhone = params.get("phone");
  const email2FAEnabled = params.get("email2FA") === "true";
  const sms2FAEnabled = params.get("sms2FA") === "true";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  // Set default method to the first enabled 2FA method
  const [method, setMethod] = useState<"email" | "sms">(email2FAEnabled ? "email" : "sms");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiryTime, setExpiryTime] = useState(300); // 5 minutes in seconds

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Mask email: h***@example.com
  const maskEmail = (email: string | null) => {
    if (!email) return "";
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return email;
    const maskedLocal = localPart.charAt(0) + "***";
    return `${maskedLocal}@${domain}`;
  };

  // Mask phone: XXX-XXX-2522
  const maskPhone = (phone: string | null) => {
    if (!phone) return "";
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    // Get last 4 digits
    const lastFour = digits.slice(-4);
    return `XXX-XXX-${lastFour}`;
  };

  const maskedEmail = maskEmail(userEmail);
  const maskedPhone = maskPhone(userPhone);
  const hasPhone = !!userPhone;

  // If both 2FA methods are disabled, redirect to dashboard
  // This is a defensive check in case user lands here without proper 2FA setup
  useEffect(() => {
    if (!email2FAEnabled && !sms2FAEnabled) {
      console.warn('[VERIFY-OTP] No 2FA methods enabled, redirecting to dashboard');
      setLocation("/dashboard");
    }
  }, [email2FAEnabled, sms2FAEnabled, setLocation]);

  // No longer auto-send on mount - user must click "Send Code" button

  // Countdown timer for code expiry
  useEffect(() => {
    if (expiryTime > 0) {
      const timer = setTimeout(() => setExpiryTime(expiryTime - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [expiryTime]);

  // Countdown timer for resend cooldown
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
        setResendCooldown(60); // 1 minute cooldown
        setExpiryTime(300); // Reset to 5 minutes
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
    if (value.length > 1) {
      value = value.slice(-1);
    }

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
        setLocation("/dashboard");
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

      {/* OTP Card */}
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10">
          {/* Back to Login */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6 transition-colors"
            data-testid="button-back-to-login"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Shield className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              {otpSent ? "Enter Verification Code" : "Two-Factor Authentication"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {otpSent 
                ? `We've sent a 6-digit code to your ${method === "email" ? "email" : "phone"}. Please enter it below to continue.`
                : "Choose how you'd like to receive your verification code"
              }
            </p>
          </div>

          {!otpSent ? (
            // Step 1: Method Selection (before sending code)
            <>
              <div className="mb-6">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                  Choose verification method:
                </Label>
                <RadioGroup 
                  value={method} 
                  onValueChange={(value) => setMethod(value as "email" | "sms")}
                  className="space-y-3"
                  data-testid="radio-group-method"
                >
                  {/* Email Option - Only show if email 2FA is enabled */}
                  {email2FAEnabled && (
                    <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                      method === "email" 
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" 
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}>
                      <RadioGroupItem value="email" id="email-method" data-testid="radio-email" />
                      <Label 
                        htmlFor="email-method" 
                        className="flex items-center justify-between flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">Email</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{maskedEmail}</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  )}

                  {/* SMS Option - Only show if SMS 2FA is enabled */}
                  {sms2FAEnabled && (
                    <div className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-all ${
                      !hasPhone 
                        ? "opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-700" 
                        : method === "sms" 
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}>
                      <RadioGroupItem 
                        value="sms" 
                        id="sms-method" 
                        disabled={!hasPhone}
                        data-testid="radio-sms" 
                      />
                      <Label 
                        htmlFor="sms-method" 
                        className={`flex items-center justify-between flex-1 ${hasPhone ? "cursor-pointer" : "cursor-not-allowed"}`}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">SMS</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {hasPhone ? maskedPhone : "No phone number on file"}
                            </div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              <Button
                onClick={sendOTP}
                className="w-full h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                disabled={isLoading}
                data-testid="button-send-code"
              >
                {isLoading ? "Sending..." : "Send Code"}
              </Button>
            </>
          ) : (
            // Step 2: OTP Input (after code is sent)
            <>
              {/* OTP Input Fields */}
              <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
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
                    className="w-12 h-14 text-center text-2xl font-semibold bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 rounded-lg"
                    data-testid={`input-otp-${index}`}
                  />
                ))}
              </div>

              {/* Remember Device */}
              <div className="flex items-center space-x-2 mb-6">
                <Checkbox
                  id="remember"
                  checked={rememberDevice}
                  onCheckedChange={(checked) => setRememberDevice(checked as boolean)}
                  data-testid="checkbox-remember-device"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
                >
                  Remember this device for 30 days
                </Label>
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerify}
                className="w-full h-12 text-base font-medium bg-gray-600 hover:bg-gray-700 text-white rounded-lg mb-4"
                disabled={isLoading || otp.join("").length !== 6}
                data-testid="button-verify"
              >
                {isLoading ? "Verifying..." : "Verify & Continue"}
              </Button>

              {/* Expiry and Resend */}
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Code expires in <span className="font-semibold">{formatTime(expiryTime)}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Didn't receive the code?{" "}
                  <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className={`font-medium ${
                      resendCooldown > 0
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    }`}
                    data-testid="button-resend"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
