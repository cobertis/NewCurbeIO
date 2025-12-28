import { useState, useEffect } from "react";
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

export default function FacebookFlowPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);

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
    const urlParams = new URLSearchParams(window.location.search);
    const facebookStatus = urlParams.get("facebook");

    if (facebookStatus === "connected") {
      toast({
        title: "Facebook Connected",
        description: "Your Facebook page has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
      setCurrentStep(2);
      urlParams.delete("facebook");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (facebookStatus === "error") {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "We couldn't connect your Facebook page. Please try again.",
      });
      urlParams.delete("facebook");
      urlParams.delete("reason");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);

  const oauthStartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/meta/facebook/start");
    },
    onSuccess: (data: { authUrl: string; state: string }) => {
      if (data.authUrl) {
        window.open(data.authUrl, "_blank");
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message || "We couldn't start the connection process. Please try again.",
      });
    },
  });

  const handleLoginWithFacebook = () => {
    oauthStartMutation.mutate();
  };

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
                        disabled={oauthStartMutation.isPending}
                        data-testid="button-login-facebook"
                      >
                        <SiFacebook className="h-4 w-4" />
                        {oauthStartMutation.isPending ? "Connecting..." : "Login with Facebook"}
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
                          Facebook page connected 🎉
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
