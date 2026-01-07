import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, MessageCircle, Clock, ExternalLink, QrCode, ChevronRight } from "lucide-react";
import { SiInstagram, SiFacebook } from "react-icons/si";
import { SettingsLayout } from "@/components/settings-layout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import type { ChannelConnection } from "@shared/schema";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
      login: (callback: (response: FBLoginResponse) => void, options?: { scope?: string; return_scopes?: boolean; config_id?: string; response_type?: string; override_default_response_type?: boolean; extras?: object }) => void;
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

const FB_SDK_VERSION = "v24.0";

export default function InstagramFlowPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [fbSdkLoaded, setFbSdkLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: metaConfig } = useQuery<{ appId: string; configId: string; instagramConfigId: string }>({
    queryKey: ["/api/integrations/meta/config"],
  });

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/instagram/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";

  useEffect(() => {
    if (isConnected) {
      setCurrentStep(2);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!metaConfig?.appId) return;
    
    const initFbSdk = () => {
      if (window.FB) {
        window.FB.init({
          appId: metaConfig.appId,
          cookie: true,
          xfbml: true,
          version: FB_SDK_VERSION,
        });
        setFbSdkLoaded(true);
        return true;
      }
      return false;
    };

    if (document.getElementById("facebook-jssdk")) {
      if (initFbSdk()) return;
      const checkInterval = setInterval(() => {
        if (window.FB) {
          initFbSdk();
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    window.fbAsyncInit = function() {
      initFbSdk();
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [metaConfig?.appId]);

  const exchangeCodeMutation = useMutation({
    mutationFn: async (data: { code: string }) => {
      return apiRequest("POST", "/api/integrations/meta/instagram/exchange-code", data);
    },
    onSuccess: () => {
      setIsConnecting(false);
      toast({
        title: "Instagram Connected",
        description: "Your Instagram account has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/instagram/status"] });
      setCurrentStep(2);
    },
    onError: (error: any) => {
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message || "We couldn't connect your Instagram account. Please try again.",
      });
    },
  });

  const handleLoginWithInstagram = useCallback(() => {
    if (!fbSdkLoaded || !window.FB) {
      toast({
        variant: "destructive",
        title: "Loading...",
        description: "Facebook SDK is still loading. Please try again in a moment.",
      });
      return;
    }

    if (!metaConfig?.appId) {
      toast({
        variant: "destructive",
        title: "Configuration missing",
        description: "Facebook App ID is not configured. Please contact support.",
      });
      return;
    }

    setIsConnecting(true);

    window.FB.login(
      (response: FBLoginResponse) => {
        console.log("[Instagram Flow] FB.login response:", JSON.stringify(response, null, 2));
        
        if (response.authResponse?.accessToken) {
          console.log("[Instagram Flow] Got access token, exchanging...");
          exchangeCodeMutation.mutate({ code: response.authResponse.accessToken });
        } else {
          setIsConnecting(false);
          console.log("[Instagram Flow] No token, status:", response.status);
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
        scope: "instagram_basic,instagram_manage_messages,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
        return_scopes: true,
      }
    );
  }, [fbSdkLoaded, toast, exchangeCodeMutation, metaConfig]);

  const handleDiscard = () => {
    setLocation("/settings/instagram");
  };

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

  if (isLoading) {
    return (
      <SettingsLayout activeSection="instagram">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="instagram">
      <div className="space-y-6" data-testid="page-instagram-flow">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-instagram-setup">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Instagram Setup</span>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]/10">
                  <SiInstagram className="h-8 w-8 text-[#E4405F]" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Connect Instagram account
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
                        Connect Instagram Business Account
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Follow these steps to connect your Instagram Business account and start receiving Instagram conversations directly in Curbe.
                      </p>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <SiFacebook className="h-5 w-5 text-[#1877F2] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Log in with Facebook</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Your Instagram Business account must be linked to a Facebook Page.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <SiInstagram className="h-5 w-5 text-[#E4405F] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Connect Instagram Business</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Select the Instagram Business account you want to connect.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <MessageCircle className="h-5 w-5 text-[#E4405F] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Receive direct messages</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Receive DMs from users who contact your account and respond directly from Curbe.</p>
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
                      
                      <Button 
                        className="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 text-white gap-2"
                        onClick={handleLoginWithInstagram}
                        disabled={isConnecting || exchangeCodeMutation.isPending}
                        data-testid="button-login-instagram"
                      >
                        <SiFacebook className="h-4 w-4" />
                        {isConnecting || exchangeCodeMutation.isPending ? "Connecting..." : "Login with Facebook"}
                      </Button>
                    </>
                  ) : (
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Connect Instagram account
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Instagram account: {connection?.displayName || "Connected"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <StepIndicator step={2} status={getStepStatus(2)} />
                </div>
                <div className="flex-1">
                  {currentStep >= 2 ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          Instagram account connected
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          You have successfully connected your Instagram account and can now manage your Instagram conversations in Curbe.
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Your Instagram Account
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                              <SiInstagram className="h-5 w-5 text-[#E4405F]" />
                            </div>
                            <a 
                              href={`https://instagram.com/${connection?.igUsername || ""}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 flex items-center gap-1"
                            >
                              @{connection?.igUsername || connection?.displayName || "Instagram"}
                              <ExternalLink className="h-3 w-3" />
                            </a>
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
                                <DialogTitle>Instagram DM Link</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Share this link with customers to start a conversation:
                                </p>
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <code className="text-sm break-all">
                                    https://ig.me/m/{connection?.igUsername || ""}
                                  </code>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        To test connection, <span className="font-medium">scan the QR code</span> or <span className="font-medium">click the chat link</span> to send a message to your Instagram account. The message you send will appear in{" "}
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
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={() => setLocation("/settings/instagram")}
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
                          Go to Curbe Messenger
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-base font-medium text-[#E4405F] dark:text-[#E4405F]">
                        Instagram account
                      </h3>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Select the Instagram Business account you want to connect after logging in.
                      </p>
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
