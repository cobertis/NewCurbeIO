import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, MessageCircle, Clock, ExternalLink, QrCode, ChevronRight } from "lucide-react";
import { SiFacebook } from "react-icons/si";
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

const FB_APP_ID = import.meta.env.VITE_META_APP_ID || "";
const FB_FACEBOOK_CONFIG_ID = import.meta.env.VITE_META_FACEBOOK_CONFIG_ID || "";
const FB_SDK_VERSION = "v24.0";

export default function FacebookFlowPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [fbSdkLoaded, setFbSdkLoaded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/facebook/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";

  useEffect(() => {
    if (isConnected) {
      setCurrentStep(2);
    }
  }, [isConnected]);

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

  const exchangeCodeMutation = useMutation({
    mutationFn: async (data: { code: string }) => {
      return apiRequest("POST", "/api/integrations/meta/facebook/exchange-code", data);
    },
    onSuccess: () => {
      setIsConnecting(false);
      toast({
        title: "Facebook Connected",
        description: "Your Facebook page has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
      setCurrentStep(2);
    },
    onError: (error: any) => {
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message || "We couldn't connect your Facebook page. Please try again.",
      });
    },
  });

  const handleLoginWithFacebook = useCallback(() => {
    if (!fbSdkLoaded || !window.FB) {
      toast({
        variant: "destructive",
        title: "Loading...",
        description: "Facebook SDK is still loading. Please try again in a moment.",
      });
      return;
    }

    if (!FB_FACEBOOK_CONFIG_ID) {
      toast({
        variant: "destructive",
        title: "Configuration missing",
        description: "Facebook Login configuration is not set up. Please contact support.",
      });
      return;
    }

    setIsConnecting(true);

    window.FB.login(
      (response: FBLoginResponse) => {
        console.log("[Facebook Flow] FB.login response:", JSON.stringify(response, null, 2));
        
        if (response.authResponse?.code) {
          console.log("[Facebook Flow] Got authorization code, exchanging...");
          exchangeCodeMutation.mutate({ code: response.authResponse.code });
        } else if (response.authResponse?.accessToken) {
          console.log("[Facebook Flow] Got access token directly, exchanging...");
          exchangeCodeMutation.mutate({ code: response.authResponse.accessToken });
        } else {
          setIsConnecting(false);
          console.log("[Facebook Flow] No code or token, status:", response.status);
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
        config_id: FB_FACEBOOK_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          version: "v2",
        },
      }
    );
  }, [fbSdkLoaded, toast, exchangeCodeMutation]);

  const handleDiscard = () => {
    setLocation("/settings/facebook");
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
      <SettingsLayout activeSection="facebook">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="facebook">
      <div className="space-y-6" data-testid="page-facebook-flow">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-facebook-setup">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Facebook Setup</span>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[#1877F2]/10">
                  <SiFacebook className="h-8 w-8 text-[#1877F2]" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Connect Facebook page
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
                        Connect Facebook account
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Follow these steps to connect your Facebook pages and start receiving Facebook conversations directly in Curbe.
                      </p>
                      
                      <div className="space-y-3 mb-4">
                        <div className="flex items-start gap-3">
                          <SiFacebook className="h-5 w-5 text-[#1877F2] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Connect your Facebook page</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">To connect a Facebook page, you <span className="font-semibold">must be an admin</span> of the page. If you don't have one, you can create it during setup.</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <MessageCircle className="h-5 w-5 text-[#1877F2] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">Receive direct messages</span>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Receive chats from users who contact your page and respond to them directly from Curbe.</p>
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
                        className="bg-[#1877F2] hover:bg-[#166FE5] text-white gap-2"
                        onClick={handleLoginWithFacebook}
                        disabled={isConnecting || exchangeCodeMutation.isPending}
                        data-testid="button-login-facebook"
                      >
                        <SiFacebook className="h-4 w-4" />
                        {isConnecting || exchangeCodeMutation.isPending ? "Connecting..." : "Login with Facebook"}
                      </Button>
                    </>
                  ) : (
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        Connect Facebook account
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Facebook account: {connection?.displayName || "Connected"}
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
                          Facebook page connected
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          You have successfully connected your Facebook page and can now manage your Messenger conversations in Curbe.
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                          Your Facebook Page
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                              <SiFacebook className="h-5 w-5 text-[#1877F2]" />
                            </div>
                            <a 
                              href={`https://facebook.com/${connection?.pageId || ""}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 flex items-center gap-1"
                            >
                              {connection?.displayName || "Facebook Page"}
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
                                <DialogTitle>Facebook Messenger Link</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Share this link with customers to start a conversation:
                                </p>
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <code className="text-sm break-all">
                                    https://m.me/{connection?.pageId || ""}
                                  </code>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        To test connection, <span className="font-medium">scan the QR code</span> or <span className="font-medium">click the chat link</span> to send a message to this Facebook page. The message you send will appear in{" "}
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
                          onClick={() => setLocation("/settings/facebook")}
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
                      <h3 className="text-base font-medium text-blue-600 dark:text-blue-400">
                        Facebook page
                      </h3>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        Select the Facebook page you want to connect after logging in.
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
