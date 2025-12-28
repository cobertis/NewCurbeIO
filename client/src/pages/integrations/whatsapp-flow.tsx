import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SiWhatsapp, SiFacebook } from "react-icons/si";
import { CheckCircle2, Clock, AlertCircle, ChevronLeft, Info, RefreshCw, ExternalLink, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SettingsLayout } from "@/components/settings-layout";
import type { ChannelConnection } from "@shared/schema";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: FBLoginResponse) => void, options: { config_id: string; response_type: string; override_default_response_type: boolean; extras: object }) => void;
    };
  }
}

interface FBLoginResponse {
  authResponse?: {
    code?: string;
    accessToken?: string;
    userID?: string;
    expiresIn?: number;
    signedRequest?: string;
    graphDomain?: string;
    data_access_expiration_time?: number;
  };
  status: string;
}

const FB_APP_ID = import.meta.env.VITE_META_APP_ID || "775292408902612";
const FB_CONFIG_ID = import.meta.env.VITE_META_BUSINESS_LOGIN_CONFIG_ID || "1379775110076042";
const FB_SDK_VERSION = "v24.0";

// Store embedded signup data from postMessage event
interface EmbeddedSignupData {
  wabaId: string;
  phoneNumberId: string;
}

export default function WhatsAppFlow() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [fbSdkLoaded, setFbSdkLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [embeddedSignupData, setEmbeddedSignupData] = useState<EmbeddedSignupData | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  
  // Refs to prevent race conditions in OAuth code exchange
  const codeExchangedRef = useRef(false);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/whatsapp/status"],
  });

  // Get real phone registration status from Meta API
  const { data: phoneStatusData, isLoading: isLoadingPhoneStatus } = useQuery<{ 
    status?: string; 
    codeVerificationStatus?: string;
    qualityRating?: string;
    verifiedName?: string;
    needsRegistration?: boolean;
  }>({
    queryKey: ["/api/integrations/whatsapp/phone-status"],
    enabled: !!connectionData?.connection,
    retry: false,
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";
  const isPending = connection?.status === "pending";
  // Phone is fully registered when status is CONNECTED and doesn't need registration
  const isPhoneRegistered = phoneStatusData?.status === "CONNECTED" && 
                            phoneStatusData?.needsRegistration === false;

  useEffect(() => {
    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) {
        setFbSdkLoaded(true);
      }
      return;
    }

    window.fbAsyncInit = function() {
      window.FB.init({
        appId: FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: FB_SDK_VERSION,
      });
      setFbSdkLoaded(true);
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      const existingScript = document.getElementById("facebook-jssdk");
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Listen for WhatsApp Embedded Signup postMessage events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only process messages from Facebook domain
      if (!event.origin.includes('facebook.com')) return;
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        console.log("[WhatsApp Flow] postMessage received:", JSON.stringify(data, null, 2));
        
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log("[WhatsApp Flow] WA_EMBEDDED_SIGNUP event:", data.event);
          
          if (data.event === 'FINISH' || data.event === 'SUBMIT') {
            const wabaId = data.data?.waba_id;
            const phoneNumberId = data.data?.phone_number_id;
            
            console.log("[WhatsApp Flow] Embedded signup data - WABA ID:", wabaId, "Phone Number ID:", phoneNumberId);
            
            if (wabaId && phoneNumberId) {
              setEmbeddedSignupData({ wabaId, phoneNumberId });
            }
          } else if (data.event === 'CANCEL') {
            console.log("[WhatsApp Flow] User cancelled embedded signup");
            setIsConnecting(false);
          } else if (data.event === 'ERROR') {
            console.error("[WhatsApp Flow] Embedded signup error:", data.data);
            setIsConnecting(false);
            toast({
              variant: "destructive",
              title: "Setup error",
              description: data.data?.error_message || "An error occurred during WhatsApp setup.",
            });
          }
        }
      } catch (e) {
        // Non-JSON message, ignore
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  useEffect(() => {
    if (isConnected && isPhoneRegistered) {
      // Only go to step 3 if phone is fully registered (PIN was entered)
      setCurrentStep(3);
    } else if (isConnected && !isPhoneRegistered) {
      // Connected but phone not registered yet - show PIN step
      setCurrentStep(2);
    } else if (isPending) {
      setCurrentStep(2);
    }
  }, [isConnected, isPending, isPhoneRegistered]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const whatsappStatus = urlParams.get("whatsapp");

    if (whatsappStatus === "connected") {
      toast({
        title: "WhatsApp Connected",
        description: "Now enter your 6-digit PIN to complete the phone number registration.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      // Go to step 2 for PIN registration instead of step 3
      setCurrentStep(2);
      urlParams.delete("whatsapp");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (whatsappStatus === "error") {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "We couldn't connect your WhatsApp account. Please try again.",
      });
      urlParams.delete("whatsapp");
      urlParams.delete("reason");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);

  const exchangeCodeMutation = useMutation({
    mutationFn: async (data: { code: string; wabaId?: string; phoneNumberId?: string }) => {
      return apiRequest("POST", "/api/integrations/meta/whatsapp/exchange-code", data);
    },
    onSuccess: () => {
      toast({
        title: "WhatsApp Connected",
        description: "Now enter your 6-digit PIN to complete the phone number registration.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      // Go to step 2 for PIN registration instead of step 3
      setCurrentStep(2);
      setIsConnecting(false);
      setPendingCode(null);
      setEmbeddedSignupData(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message || "We couldn't complete the connection. Please try again.",
      });
      setIsConnecting(false);
      setPendingCode(null);
      setEmbeddedSignupData(null);
    },
  });

  // Register phone number with Meta API using 6-digit PIN
  const registerMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      return apiRequest("POST", "/api/integrations/whatsapp/register", { pin: pinCode });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      if (response.isFullyActivated) {
        setCurrentStep(3);
        toast({
          title: "Phone number activated",
          description: "Your WhatsApp number is now ready to use.",
        });
      } else {
        toast({
          title: "Registration submitted",
          description: "Your phone number registration has been submitted. Status: " + (response.currentStatus || "Processing"),
        });
        setCurrentStep(3);
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error.message || "Failed to register phone number. Please check your PIN and try again.",
      });
    },
  });

  // Effect to process when we have both code and embedded signup data
  useEffect(() => {
    if (pendingCode && embeddedSignupData && !exchangeCodeMutation.isPending && !codeExchangedRef.current) {
      console.log("[WhatsApp Flow] Both code and embedded signup data available, exchanging...");
      // Mark as exchanged to prevent duplicate calls
      codeExchangedRef.current = true;
      // Cancel the fallback timeout since we have embedded data
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      exchangeCodeMutation.mutate({
        code: pendingCode,
        wabaId: embeddedSignupData.wabaId,
        phoneNumberId: embeddedSignupData.phoneNumberId,
      });
    }
    
    // Cleanup fallback timeout on unmount
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
    };
  }, [pendingCode, embeddedSignupData, exchangeCodeMutation]);

  const handleLoginWithFacebook = useCallback(() => {
    if (!fbSdkLoaded || !window.FB) {
      toast({
        variant: "destructive",
        title: "Loading...",
        description: "Facebook SDK is still loading. Please try again in a moment.",
      });
      return;
    }

    setIsConnecting(true);
    // Reset any previous state and refs
    setPendingCode(null);
    setEmbeddedSignupData(null);
    codeExchangedRef.current = false;
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }

    window.FB.login(
      (response: FBLoginResponse) => {
        console.log("[WhatsApp Flow] FB.login full response:", JSON.stringify(response, null, 2));
        
        if (response.authResponse?.code) {
          console.log("[WhatsApp Flow] Got authorization code, waiting for embedded signup data...");
          setPendingCode(response.authResponse.code);
          // The useEffect will trigger the mutation when embeddedSignupData is also available
          // Set a fallback timeout in case embedded signup data doesn't come
          fallbackTimeoutRef.current = setTimeout(() => {
            // Only proceed if code hasn't been exchanged yet
            if (!codeExchangedRef.current) {
              console.log("[WhatsApp Flow] No embedded signup data received, proceeding with code only");
              codeExchangedRef.current = true;
              exchangeCodeMutation.mutate({ code: response.authResponse!.code! });
            }
          }, 3000);
        } else if (response.authResponse?.accessToken) {
          console.log("[WhatsApp Flow] Got access token directly (no code), sending...");
          codeExchangedRef.current = true;
          exchangeCodeMutation.mutate({ code: response.authResponse.accessToken });
        } else {
          setIsConnecting(false);
          console.log("[WhatsApp Flow] No code or token in response, status:", response.status);
          if (response.status === "unknown") {
            toast({
              variant: "destructive",
              title: "Connection cancelled",
              description: "You closed the login window without completing the setup.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Connection failed",
              description: "Could not get authorization from Facebook. Please try again.",
            });
          }
        }
      },
      {
        config_id: FB_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          version: "v3",
        },
      }
    );
  }, [fbSdkLoaded, toast, exchangeCodeMutation]);

  const handleDiscard = () => {
    setLocation("/settings/whatsapp");
  };

  if (isLoading) {
    return (
      <SettingsLayout activeSection="whatsapp">
        <LoadingSpinner fullScreen={true} message="Loading..." />
      </SettingsLayout>
    );
  }

  const getStepStatus = (step: number) => {
    if (step < currentStep) return "completed";
    if (step === currentStep) return "current";
    return "pending";
  };

  const StepIndicator = ({ step, status }: { step: number; status: "completed" | "current" | "pending" }) => {
    if (status === "completed") {
      return (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-medium ${
        status === "current" 
          ? "bg-blue-500 text-white" 
          : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
      }`}>
        {step}
      </div>
    );
  };

  return (
    <SettingsLayout activeSection="whatsapp">
      <div className="space-y-6" data-testid="page-whatsapp-flow">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/settings" className="hover:text-slate-700 dark:hover:text-slate-300">
            Settings
          </Link>
          <span>&gt;</span>
          <Link href="/settings/whatsapp" className="hover:text-slate-700 dark:hover:text-slate-300">
            WhatsApp
          </Link>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[#25D366]/10">
                  <SiWhatsapp className="h-8 w-8 text-[#25D366]" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Connect WhatsApp number
                </h1>
              </div>
              <Button 
                variant="outline" 
                onClick={handleDiscard}
                data-testid="button-discard"
              >
                Discard
              </Button>
            </div>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={1} status={getStepStatus(1)} />
                  <div className={`w-0.5 flex-1 mt-2 ${currentStep > 1 ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                </div>
                <div className="flex-1 pb-8">
                  {currentStep === 1 ? (
                    <>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Connect WhatsApp Business Account
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Follow these steps to connect your WhatsApp Business account and start receiving{" "}
                        <span className="text-blue-600 dark:text-blue-400">customer-initiated conversations</span> in Curbe.
                      </p>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <SiFacebook className="h-5 w-5 text-[#1877F2] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Log in with your Facebook account</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">You need to have a Facebook account to connect WhatsApp to Curbe.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <SiWhatsapp className="h-5 w-5 text-[#25D366] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Connect WhatsApp Business</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Follow the Meta setup to connect your WhatsApp Business number or register a new one. You need access to this number to receive a verification code.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Reply window</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">You will have 24 hours to respond to messages received from customers.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Note:</span> If you're not redirected to the second step of the flow after completing Meta setup, restart the process by clicking the <span className="font-medium">Login with Facebook</span> button.
                          </p>
                        </div>
                      </div>
                      
                      <Button 
                        className="bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2"
                        onClick={handleLoginWithFacebook}
                        disabled={isConnecting || !fbSdkLoaded}
                        data-testid="button-login-facebook"
                      >
                        <SiFacebook className="h-4 w-4" />
                        {isConnecting ? "Connecting..." : !fbSdkLoaded ? "Loading..." : "Login with Facebook"}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          Connect WhatsApp Business Account
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          WhatsApp Business Account: (WABA ID: {connection?.wabaId || "Connected"})
                        </p>
                      </div>
                      <Button 
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleLoginWithFacebook}
                        data-testid="button-start-over"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Start over
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={2} status={getStepStatus(2)} />
                  <div className={`w-0.5 flex-1 mt-2 ${currentStep > 2 ? "bg-green-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                </div>
                <div className="flex-1 pb-8">
                  {currentStep > 2 ? (
                    <>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Two-factor authentication
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Completed
                      </p>
                    </>
                  ) : (
                    <>
                      <h3 className={`text-base font-semibold mb-1 ${currentStep >= 2 ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>
                        Two-factor authentication
                      </h3>
                      <p className={`text-sm ${currentStep >= 2 ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>
                        Set up a 6-digit PIN to keep your number secure, or enter your existing PIN if it's already enabled.
                      </p>
                      <p className={`text-sm mt-1 ${currentStep >= 2 ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>
                        You can check the two-factor authentication status in <span className="font-medium">Number settings</span> under your{" "}
                        <a 
                          href="https://business.facebook.com/settings/whatsapp-business-accounts" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          WhatsApp Business Account
                        </a>.
                      </p>
                      
                      {currentStep === 2 && (
                        <div className="mt-4 space-y-4">
                          <div className="flex items-center gap-2" role="group" aria-label="6-digit PIN entry">
                            {pin.slice(0, 3).map((digit, index) => (
                              <Input
                                key={index}
                                type="password"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                autoComplete="one-time-code"
                                aria-label={`PIN digit ${index + 1} of 6`}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  const newPin = [...pin];
                                  newPin[index] = val;
                                  setPin(newPin);
                                  if (val && index < 5) {
                                    const nextInput = document.getElementById(`pin-${index + 1}`);
                                    nextInput?.focus();
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Backspace" && !digit && index > 0) {
                                    const prevInput = document.getElementById(`pin-${index - 1}`);
                                    prevInput?.focus();
                                  }
                                }}
                                id={`pin-${index}`}
                                className="w-12 h-12 text-center text-lg font-medium"
                                data-testid={`input-pin-${index}`}
                              />
                            ))}
                            <span className="text-slate-400 text-lg" aria-hidden="true">-</span>
                            {pin.slice(3).map((digit, index) => (
                              <Input
                                key={index + 3}
                                type="password"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                autoComplete="one-time-code"
                                aria-label={`PIN digit ${index + 4} of 6`}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "");
                                  const newPin = [...pin];
                                  newPin[index + 3] = val;
                                  setPin(newPin);
                                  if (val && index + 3 < 5) {
                                    const nextInput = document.getElementById(`pin-${index + 4}`);
                                    nextInput?.focus();
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Backspace" && !digit && index + 3 > 0) {
                                    const prevInput = document.getElementById(`pin-${index + 2}`);
                                    prevInput?.focus();
                                  }
                                }}
                                id={`pin-${index + 3}`}
                                className="w-12 h-12 text-center text-lg font-medium"
                                data-testid={`input-pin-${index + 3}`}
                              />
                            ))}
                          </div>
                          
                          <Button 
                            onClick={() => {
                              const pinCode = pin.join("");
                              if (pinCode.length === 6) {
                                registerMutation.mutate(pinCode);
                              } else {
                                toast({
                                  variant: "destructive",
                                  title: "Invalid PIN",
                                  description: "Please enter a 6-digit PIN.",
                                });
                              }
                            }}
                            disabled={registerMutation.isPending}
                            data-testid="button-continue"
                          >
                            {registerMutation.isPending ? (
                              <>
                                <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />
                                Registering...
                              </>
                            ) : (
                              "Continue"
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={3} status={getStepStatus(3)} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-base font-semibold mb-1 ${currentStep >= 3 ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>
                    WhatsApp Business number connected 🎉
                  </h3>
                  <p className={`text-sm ${currentStep >= 3 ? "text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"}`}>
                    You have successfully connected your WhatsApp number and can now manage your conversations in Curbe.
                  </p>
                  
                  {currentStep === 3 && (
                    <div className="mt-6 space-y-6">
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Your WhatsApp Number
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-[#25D366]/10">
                              <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
                            </div>
                            <span className="text-base font-medium text-slate-900 dark:text-slate-100">
                              {connection?.phoneNumberE164 || connection?.phoneNumberId || "+1 555 813 4421"}
                            </span>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2" data-testid="button-qr-code">
                                <QrCode className="h-4 w-4" />
                                QR code & chat link
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>WhatsApp Chat Link</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Share this link with customers to start a conversation:
                                </p>
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <code className="text-sm break-all">
                                    https://wa.me/{(connection?.phoneNumberE164 || connection?.phoneNumberId || "+15558134421").replace(/\D/g, "")}
                                  </code>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        To test connection, <span className="font-medium">scan the QR code</span> or <span className="font-medium">click the chat link</span> to send a message to this number. The message you send will appear in{" "}
                        <a href="/messenger" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                          Curbe Messenger
                        </a>. For more information, please read{" "}
                        <a 
                          href="#" 
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          our support article
                        </a>.
                      </p>
                      
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Curbe currently supports only customer-initiated conversations. You can reply to chats initiated by your contacts within 24 hours but cannot start new chats or send bulk messages.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={() => setLocation("/settings/whatsapp")}
                          data-testid="button-finish"
                        >
                          Finish
                        </Button>
                        <Button 
                          variant="outline"
                          className="gap-2"
                          onClick={() => setLocation("/messenger")}
                          data-testid="button-go-to-messenger"
                        >
                          Go to Messenger
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
