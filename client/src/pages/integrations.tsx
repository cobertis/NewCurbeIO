import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";
import { SiWhatsapp, SiInstagram, SiFacebook, SiTiktok, SiTelegram } from "react-icons/si";
import { CheckCircle, XCircle, Clock, AlertTriangle, Plus, Trash2, RefreshCw, ExternalLink, Settings, HelpCircle, ChevronDown, ChevronLeft, ChevronRight, Info, User as UserIcon, Users, Phone, Mail, Building, CreditCard, Plug, MessageSquare, Zap, Shield, Bell, UsersRound, Palette, PlayCircle, CheckCircle2 } from "lucide-react";
import type { ChannelConnection, User } from "@shared/schema";
import Billing from "@/pages/billing";
import SettingsPage from "@/pages/settings";
import SmsVoice, { SmsVoiceContent } from "@/pages/sms-voice";
import { WhiteLabelSettings } from "@/components/white-label-settings";
import EmailIntegration from "@/pages/email-integration";

type ChannelType = "whatsapp" | "instagram" | "facebook";

interface ConnectionStatus {
  connected: boolean;
  connection?: ChannelConnection;
}

function SettingsBreadcrumb({ pageName, action }: { pageName: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Settings</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{pageName}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function getStatusBadge(status: string | undefined) {
  switch (status) {
    case "active":
      return <Badge data-testid="badge-whatsapp-status-active" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    case "pending":
      return <Badge data-testid="badge-whatsapp-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "error":
      return <Badge data-testid="badge-whatsapp-status-error" className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Needs attention</Badge>;
    case "revoked":
      return <Badge data-testid="badge-whatsapp-status-revoked" className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
    default:
      return <Badge data-testid="badge-whatsapp-status-disconnected" variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>;
  }
}

function getErrorMessage(reason: string): { title: string; description: string } {
  switch (reason) {
    case "user_cancelled":
    case "missing_params":
      return {
        title: "Connection cancelled",
        description: "You cancelled the connection. Try again when you're ready."
      };
    case "permission_denied":
    case "insufficient_permissions":
      return {
        title: "Permission required",
        description: "You need to approve the permissions to connect."
      };
    case "number_already_connected":
      return {
        title: "This number is already connected",
        description: "This number is already connected to another workspace. Use a different number or disconnect it from the other workspace first."
      };
    case "number_not_eligible":
    case "no_phone_number":
      return {
        title: "Number not eligible",
        description: "No account/page was found on your account."
      };
    case "invalid_state":
    case "state_expired":
    case "state_reused":
    case "token_exchange_failed":
    case "server_config_error":
    case "unexpected_error":
    default:
      return {
        title: "Connection failed",
        description: "We couldn't connect your account. Please try again."
      };
  }
}

function getInstagramErrorMessage(reason: string): { title: string; description: string } {
  switch (reason) {
    case "connection_cancelled":
      return {
        title: "Connection cancelled",
        description: "You cancelled the connection. Try again when you're ready."
      };
    case "not_professional":
      return {
        title: "Professional account required",
        description: "This account is personal. Switch your Instagram to Business or Creator."
      };
    case "permission_denied":
      return {
        title: "Permission denied",
        description: "You need to approve the permissions to connect."
      };
    case "access_not_available":
      return {
        title: "Access not available",
        description: "No account/page was found on your account."
      };
    case "connection_failed":
    default:
      return {
        title: "Connection failed",
        description: "We couldn't connect your account. Please try again."
      };
  }
}

function getInstagramStatusBadge(status: string | undefined) {
  switch (status) {
    case "active":
      return <Badge data-testid="badge-instagram-status-active" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    case "pending":
      return <Badge data-testid="badge-instagram-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "error":
      return <Badge data-testid="badge-instagram-status-error" className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Needs attention</Badge>;
    case "revoked":
      return <Badge data-testid="badge-instagram-status-revoked" className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
    default:
      return <Badge data-testid="badge-instagram-status-disconnected" variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>;
  }
}

function getFacebookErrorMessage(reason: string): { title: string; description: string } {
  switch (reason) {
    case "connection_cancelled":
      return {
        title: "Connection cancelled",
        description: "You cancelled the connection. Try again when you're ready."
      };
    case "permission_required":
      return {
        title: "Permission required",
        description: "You need to approve the permissions to connect."
      };
    case "page_not_found":
      return {
        title: "Page not found",
        description: "No account/page was found on your account."
      };
    case "connection_failed":
    default:
      return {
        title: "Connection failed",
        description: "We couldn't connect your account. Please try again."
      };
  }
}

function getFacebookStatusBadge(status: string | undefined) {
  switch (status) {
    case "active":
      return <Badge data-testid="badge-facebook-status-active" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    case "pending":
      return <Badge data-testid="badge-facebook-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "error":
      return <Badge data-testid="badge-facebook-status-error" className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Needs attention</Badge>;
    case "revoked":
      return <Badge data-testid="badge-facebook-status-revoked" className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
    default:
      return <Badge data-testid="badge-facebook-status-disconnected" variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>;
  }
}

function getTiktokErrorMessage(reason: string): { title: string; description: string } {
  switch (reason) {
    case "connection_cancelled":
      return {
        title: "Connection cancelled",
        description: "You cancelled the connection. Try again when you're ready."
      };
    case "permission_denied":
      return {
        title: "Permission denied",
        description: "You need to approve the permissions to connect."
      };
    case "account_not_found":
      return {
        title: "Account not found",
        description: "No TikTok account was found."
      };
    case "connection_failed":
    default:
      return {
        title: "Connection failed",
        description: "We couldn't connect your account. Please try again."
      };
  }
}

function getTiktokStatusBadge(status: string | undefined) {
  switch (status) {
    case "active":
      return <Badge data-testid="badge-tiktok-status-active" className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    case "pending":
      return <Badge data-testid="badge-tiktok-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "error":
      return <Badge data-testid="badge-tiktok-status-error" className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Needs attention</Badge>;
    case "revoked":
      return <Badge data-testid="badge-tiktok-status-revoked" className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
    default:
      return <Badge data-testid="badge-tiktok-status-disconnected" variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>;
  }
}

function WhatsAppInfoPage({ onConnect, isConnecting }: { onConnect: () => void; isConnecting: boolean }) {
  return (
    <div className="space-y-8">
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Connect with customers on WhatsApp
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Handle customer-initiated conversations on WhatsApp channel. Respond faster, improve customer service, and keep all your chats in one place.
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Link your WhatsApp in minutes</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Send and receive messages instantly</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Share images, videos, and files easily</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
                  onClick={onConnect}
                  disabled={isConnecting}
                  data-testid="button-get-started-whatsapp"
                >
                  {isConnecting ? "Connecting..." : "Get started"}
                </Button>
                <Button 
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open("https://www.facebook.com/business/help/447934475640650", "_blank")}
                  data-testid="button-watch-tutorial"
                >
                  <PlayCircle className="h-4 w-4" />
                  Watch tutorial
                </Button>
              </div>
            </div>
            
            <div className="w-full md:w-80 shrink-0">
              <div className="relative bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4 shadow-lg">
                <div className="absolute -top-2 -right-2 bg-[#25D366] rounded-full p-2 shadow-md">
                  <SiWhatsapp className="h-5 w-5 text-white" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                      AW
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100">Adam Wells</div>
                      <div className="bg-white dark:bg-slate-700 rounded-lg p-2 mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Hello, I have an issue...
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 justify-end">
                    <div className="flex-1 text-right">
                      <div className="bg-[#DCF8C6] dark:bg-[#25D366]/30 rounded-lg p-2 inline-block text-xs text-slate-700 dark:text-slate-200">
                        Hi Adam! How can I assist you today?
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium shrink-0">
                      AW
                    </div>
                    <div className="flex-1">
                      <div className="bg-white dark:bg-slate-700 rounded-lg p-2 text-xs text-slate-600 dark:text-slate-300">
                        I have an issue with logging in to my account. Can you please assist me?
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">WhatsApp FAQ</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Haven't found what you were looking for?{" "}
            <a 
              href="https://support.curbe.io/contact" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
              data-testid="link-contact-us"
            >
              Contact us
            </a>
          </p>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
            <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-features">
              What WhatsApp Business Platform features are supported by Curbe?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
              Curbe supports receiving and sending WhatsApp messages, including text, images, videos, documents, and voice messages. You can manage all conversations from your Curbe inbox and respond to customers in real-time.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
            <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-24-hour">
              Why am I limited to 24-hour messaging sessions?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
              WhatsApp's business messaging policy requires that businesses respond to customer-initiated conversations within a 24-hour window. After this period, you can only send pre-approved template messages. This helps protect users from spam and ensures timely responses.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-3" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
            <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-connect">
              How do I connect my WhatsApp Business?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
              Click "Get started" and you'll be redirected to Meta's authentication page. Log in with your Facebook account that has access to your WhatsApp Business account, select your WhatsApp Business profile, and approve the required permissions. Your connection will be active immediately after.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-4" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
            <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-data-transfer">
              Will my WhatsApp data get transferred to the Curbe app?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
              No, existing conversation history is not transferred. Curbe will only receive new messages sent after the connection is established. Your previous WhatsApp conversations remain in your WhatsApp app.
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-5" className="border border-slate-200 dark:border-slate-800 rounded-lg px-4">
            <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-virtual-number">
              Can I use a Curbe virtual number with WhatsApp Business?
            </AccordionTrigger>
            <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
              No, WhatsApp Business requires its own verified phone number. You need to have a WhatsApp Business account with a verified phone number to connect with Curbe. Curbe virtual numbers are for SMS and voice calls only.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

function WhatsAppCard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [manualConnectDialogOpen, setManualConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [formData, setFormData] = useState({
    wabaId: "",
    phoneNumberId: "",
    phoneNumber: "",
    displayName: "",
    accessToken: "",
  });

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/whatsapp/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";
  const isPending = connection?.status === "pending";
  const hasError = connection?.status === "error";
  const isRevoked = connection?.status === "revoked";

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const whatsappStatus = urlParams.get("whatsapp");
    const reason = urlParams.get("reason");

    if (whatsappStatus === "connected") {
      toast({
        title: "WhatsApp Connected",
        description: "Your WhatsApp Business account has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      urlParams.delete("whatsapp");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (whatsappStatus === "error") {
      const errorMsg = getErrorMessage(reason || "unexpected_error");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: errorMsg.description,
      });
      urlParams.delete("whatsapp");
      urlParams.delete("reason");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);

  const oauthStartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/meta/whatsapp/start");
    },
    onSuccess: (data: { authUrl: string; state: string }) => {
      if (data.authUrl) {
        window.open(data.authUrl, "_blank");
      }
    },
    onError: (error: any) => {
      const errorMsg = getErrorMessage("unexpected_error");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: error.message || errorMsg.description,
      });
    },
  });

  const manualConnectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/integrations/whatsapp/connect", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      setManualConnectDialogOpen(false);
      setFormData({ wabaId: "", phoneNumberId: "", phoneNumber: "", displayName: "", accessToken: "" });
      toast({
        title: "WhatsApp Connected",
        description: "Your WhatsApp Business account has been connected successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.message || "We couldn't connect your account. Please try again.",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/whatsapp/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "WhatsApp Disconnected",
        description: "Your WhatsApp Business account has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect WhatsApp Business account.",
      });
    },
  });

  const handleManualConnect = () => {
    if (!formData.wabaId || !formData.phoneNumberId || !formData.accessToken) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in all required fields.",
      });
      return;
    }
    manualConnectMutation.mutate(formData);
  };

  const handleOAuthConnect = () => {
    oauthStartMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card data-testid="card-whatsapp-loading">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner fullScreen={false} />
        </CardContent>
      </Card>
    );
  }

  const isNotConnected = !isConnected && !isPending && !hasError && !isRevoked;

  if (isNotConnected) {
    return <WhatsAppInfoPage onConnect={handleOAuthConnect} isConnecting={oauthStartMutation.isPending} />;
  }

  return (
    <TooltipProvider>
      <>
        <Card className="relative overflow-hidden" data-testid="card-whatsapp">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#25D366]/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#25D366]/10">
                <SiWhatsapp className="h-6 w-6 text-[#25D366]" />
              </div>
              <div>
                <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                <CardDescription>Connect your WhatsApp Business account</CardDescription>
              </div>
            </div>
            {getStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthStartMutation.isPending ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-[#25D366] mx-auto mb-3" />
                <p className="font-medium">Connecting WhatsApp...</p>
                <p className="text-sm text-muted-foreground">We're completing the connection with Meta. Please don't close this window.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-medium" data-testid="text-whatsapp-phone">{connection?.phoneNumberE164 || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Display name</span>
                    <span className="font-medium" data-testid="text-whatsapp-display-name">{connection?.displayName || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Status
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>"Active" means Curbe can send and receive messages. If it shows "Needs attention", reconnect or check permissions.</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span className="font-medium capitalize" data-testid="text-whatsapp-status">
                      {connection?.status === "active" ? "Active" : connection?.status || "N/A"}
                    </span>
                  </div>
                  {connection?.lastError && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400 text-xs" data-testid="text-whatsapp-error">
                      {connection.lastError}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] })}
                    data-testid="button-refresh-whatsapp"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDisconnectDialogOpen(true)}
                    data-testid="button-disconnect-whatsapp"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent data-testid="dialog-disconnect-whatsapp">
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect WhatsApp?</AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer receive messages from this account in Curbe.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-disconnect"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}

function InstagramCard() {
  const { toast } = useToast();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/instagram/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";
  const isRevoked = connection?.status === "revoked";

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const instagramStatus = urlParams.get("instagram");
    const reason = urlParams.get("reason");

    if (instagramStatus === "connected") {
      toast({
        title: "Instagram Connected",
        description: "Your Instagram Business account has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/instagram/status"] });
      urlParams.delete("instagram");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (instagramStatus === "error") {
      const errorMsg = getInstagramErrorMessage(reason || "connection_failed");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: errorMsg.description,
      });
      urlParams.delete("instagram");
      urlParams.delete("reason");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);

  const oauthStartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/meta/instagram/start");
    },
    onSuccess: (data: { authUrl: string; state: string }) => {
      if (data.authUrl) {
        window.open(data.authUrl, "_blank");
      }
    },
    onError: (error: any) => {
      const errorMsg = getInstagramErrorMessage("connection_failed");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: error.message || errorMsg.description,
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/instagram/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/instagram/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "Instagram Disconnected",
        description: "Your Instagram Business account has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Instagram Business account.",
      });
    },
  });

  const handleOAuthConnect = () => {
    oauthStartMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card data-testid="card-instagram-loading">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner fullScreen={false} />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <>
        <Card data-testid="card-instagram" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#E4405F]/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#E4405F]/10">
                <SiInstagram className="h-6 w-6 text-[#E4405F]" />
              </div>
              <div>
                <CardTitle className="text-lg">Instagram Direct</CardTitle>
                <CardDescription>Connect your Instagram Business account</CardDescription>
              </div>
            </div>
            {getInstagramStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthStartMutation.isPending ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-[#E4405F] mx-auto mb-3" />
                <p className="font-medium">Connecting Instagram...</p>
                <p className="text-sm text-muted-foreground">We're completing the connection with Meta. Please don't close this window.</p>
              </div>
            ) : isConnected ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium" data-testid="text-instagram-username">@{connection?.igUsername}</span>
                  </div>
                  {connection?.pageName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Page</span>
                      <span className="font-medium" data-testid="text-instagram-page">{connection.pageName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connected</span>
                    <span className="font-medium" data-testid="text-instagram-connected-date">
                      {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/instagram/status"] })}
                    data-testid="button-refresh-instagram"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDisconnectDialogOpen(true)}
                      data-testid="button-disconnect-instagram"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your Instagram Business account to respond and manage DMs from Curbe's inbox.
                </p>
                
                <Button 
                  className="w-full bg-[#E4405F] hover:bg-[#D93B56]"
                  onClick={handleOAuthConnect}
                  disabled={oauthStartMutation.isPending}
                  data-testid="button-connect-instagram"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Instagram
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  We'll take you to Meta to log in and select your Instagram account.
                </p>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" data-testid="button-instagram-help">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Need help connecting?
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    <ul className="list-disc list-inside space-y-1">
                      <li>You must have an Instagram Business account</li>
                      <li>Your account must be linked to a Facebook Page</li>
                      <li>You need to approve messaging permissions</li>
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent data-testid="dialog-disconnect-instagram">
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer receive messages from this account in Curbe.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-disconnect-instagram">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-disconnect-instagram"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}

function FacebookCard() {
  const { toast } = useToast();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/facebook/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";
  const isRevoked = connection?.status === "revoked";

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const facebookStatus = urlParams.get("facebook");
    const reason = urlParams.get("reason");

    if (facebookStatus === "connected") {
      toast({
        title: "Facebook Connected",
        description: "Your Facebook Page has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
      urlParams.delete("facebook");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (facebookStatus === "error") {
      const errorMsg = getFacebookErrorMessage(reason || "connection_failed");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: errorMsg.description,
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
      const errorMsg = getFacebookErrorMessage("connection_failed");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: error.message || errorMsg.description,
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/facebook/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "Facebook Disconnected",
        description: "Your Facebook Page has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Facebook Page.",
      });
    },
  });

  const handleOAuthConnect = () => {
    oauthStartMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card data-testid="card-facebook-loading">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner fullScreen={false} />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <>
        <Card data-testid="card-facebook" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#1877F2]/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#1877F2]/10">
                <SiFacebook className="h-6 w-6 text-[#1877F2]" />
              </div>
              <div>
                <CardTitle className="text-lg">Facebook Messenger</CardTitle>
                <CardDescription>Connect your Facebook Page</CardDescription>
              </div>
            </div>
            {getFacebookStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthStartMutation.isPending ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-[#1877F2] mx-auto mb-3" />
                <p className="font-medium">Connecting Facebook...</p>
                <p className="text-sm text-muted-foreground">We're completing the connection with Meta. Please don't close this window.</p>
              </div>
            ) : isConnected ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Page</span>
                    <span className="font-medium" data-testid="text-facebook-page">{connection?.fbPageName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connected</span>
                    <span className="font-medium" data-testid="text-facebook-connected-date">
                      {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] })}
                    data-testid="button-refresh-facebook"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDisconnectDialogOpen(true)}
                      data-testid="button-disconnect-facebook"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your Facebook Page to respond and manage Messenger conversations from Curbe's inbox.
                </p>
                
                <Button 
                  className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
                  onClick={handleOAuthConnect}
                  disabled={oauthStartMutation.isPending}
                  data-testid="button-connect-facebook"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Facebook
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  We'll take you to Meta to log in and select your Facebook Page.
                </p>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" data-testid="button-facebook-help">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Need help connecting?
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    <ul className="list-disc list-inside space-y-1">
                      <li>You must be an admin of the Facebook Page</li>
                      <li>The Page must have Messenger enabled</li>
                      <li>You need to approve messaging permissions</li>
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent data-testid="dialog-disconnect-facebook">
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Facebook?</AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer receive messages from this account in Curbe.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-disconnect-facebook">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-disconnect-facebook"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}

function TikTokCard() {
  const { toast } = useToast();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/tiktok/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";
  const isRevoked = connection?.status === "revoked";

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tiktokStatus = urlParams.get("tiktok");
    const reason = urlParams.get("reason");

    if (tiktokStatus === "connected") {
      toast({
        title: "TikTok Connected",
        description: "Your TikTok account has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/tiktok/status"] });
      urlParams.delete("tiktok");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    } else if (tiktokStatus === "error") {
      const errorMsg = getTiktokErrorMessage(reason || "connection_failed");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: errorMsg.description,
      });
      urlParams.delete("tiktok");
      urlParams.delete("reason");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [toast]);

  const oauthStartMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/integrations/tiktok/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const text = await response.text();
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          console.error("TikTok start error response:", text.substring(0, 500));
        }
        throw new Error(errorData.error || "Failed to start OAuth flow");
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("TikTok start response (not JSON):", text.substring(0, 500));
        throw new Error("Invalid response from server");
      }
    },
    onSuccess: (data: { authUrl: string; state: string }) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        console.error("TikTok authUrl missing in response:", data);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to get authorization URL. Please try again.",
        });
      }
    },
    onError: (error: any) => {
      const errorMsg = getTiktokErrorMessage("connection_failed");
      toast({
        variant: "destructive",
        title: errorMsg.title,
        description: error.message || errorMsg.description,
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/tiktok/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/tiktok/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "TikTok Disconnected",
        description: "Your TikTok account has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect TikTok account.",
      });
    },
  });

  const handleOAuthConnect = () => {
    oauthStartMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card data-testid="card-tiktok-loading">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner fullScreen={false} />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <>
        <Card data-testid="card-tiktok" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-black/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-black/10">
                <SiTiktok className="h-6 w-6 text-black dark:text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">TikTok</CardTitle>
                <CardDescription>Connect your TikTok account</CardDescription>
              </div>
            </div>
            {getTiktokStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthStartMutation.isPending ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-black dark:text-white mx-auto mb-3" />
                <p className="font-medium">Connecting TikTok...</p>
                <p className="text-sm text-muted-foreground">We're completing the connection with TikTok. Please don't close this window.</p>
              </div>
            ) : isConnected ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium" data-testid="text-tiktok-account">
                      {connection?.tiktokDisplayName || connection?.tiktokUsername || "Cuenta Conectada"}
                    </span>
                  </div>
                  {connection?.tiktokUsername && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username</span>
                      <span className="font-medium" data-testid="text-tiktok-username">@{connection.tiktokUsername}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connected</span>
                    <span className="font-medium" data-testid="text-tiktok-connected-date">
                      {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/tiktok/status"] })}
                    data-testid="button-refresh-tiktok"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDisconnectDialogOpen(true)}
                      data-testid="button-disconnect-tiktok"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your TikTok account to enable TikTok Login for your users.
                </p>
                
                <Button 
                  className="w-full bg-black hover:bg-gray-800 text-white"
                  onClick={handleOAuthConnect}
                  disabled={oauthStartMutation.isPending}
                  data-testid="button-connect-tiktok"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect TikTok
                </Button>
                
                <p className="text-xs text-muted-foreground text-center">
                  We'll take you to TikTok to log in and authorize the connection.
                </p>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" data-testid="button-tiktok-help">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Need help connecting?
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    <ul className="list-disc list-inside space-y-1">
                      <li>You must have a TikTok account</li>
                      <li>You need to approve the login permissions</li>
                      <li>The connection uses TikTok Login Kit</li>
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent data-testid="dialog-disconnect-tiktok">
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect TikTok?</AlertDialogTitle>
              <AlertDialogDescription>
                Your TikTok account will be disconnected from Curbe.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-disconnect-tiktok">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-disconnect-tiktok"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}

function TelegramCard() {
  const { toast } = useToast();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [removeBotDialogOpen, setRemoveBotDialogOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [showBotSetup, setShowBotSetup] = useState(false);

  const { data: botStatus, isLoading: isLoadingBot } = useQuery<{
    hasBot: boolean;
    botUsername: string | null;
    botFirstName: string | null;
    isActive: boolean;
  }>({
    queryKey: ["/api/integrations/telegram/bot-status"],
  });

  const { data: status, isLoading: isLoadingChats } = useQuery<{
    connected: boolean;
    chats: Array<{
      id: string;
      chatId: string;
      chatType: "private" | "group" | "supergroup" | "channel";
      title: string | null;
      linkedAt: string;
    }>;
  }>({
    queryKey: ["/api/integrations/telegram/status"],
    refetchInterval: deepLink ? 2000 : false,
    enabled: botStatus?.hasBot === true,
  });

  const hasBot = botStatus?.hasBot === true;
  const isConnected = hasBot && status?.connected && status.chats.length > 0;

  useEffect(() => {
    if (deepLink && isConnected) {
      setDeepLink(null);
      toast({ title: "Connected!", description: "Your Telegram chat has been connected successfully" });
    }
  }, [deepLink, isConnected, toast]);

  const setupBotMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest("POST", "/api/integrations/telegram/setup-bot", { botToken: token });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/bot-status"] });
      setBotToken("");
      setShowBotSetup(false);
      toast({ title: "Bot Connected!", description: `@${data.botUsername} is now ready to receive messages` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to setup bot. Check your token.", variant: "destructive" });
    },
  });

  const removeBotMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/integrations/telegram/remove-bot");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/bot-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/status"] });
      setRemoveBotDialogOpen(false);
      toast({ title: "Bot Removed", description: "Your Telegram bot has been disconnected" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove bot", variant: "destructive" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/integrations/telegram/start");
    },
    onSuccess: (data) => {
      setDeepLink(data.deepLink);
      toast({ title: "Link Generated", description: "Open the link in Telegram and press Start" });
    },
    onError: (error: any) => {
      if (error.needsBotSetup) {
        setShowBotSetup(true);
        toast({ title: "Setup Required", description: "Please set up your Telegram bot first", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to generate connection link", variant: "destructive" });
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (chatId: string) => {
      return await apiRequest("POST", "/api/integrations/telegram/disconnect", { chatId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/status"] });
      toast({ title: "Disconnected", description: "The chat has been disconnected from Telegram" });
      setDisconnectDialogOpen(false);
      setSelectedChatId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to disconnect chat", variant: "destructive" });
    },
  });

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const handleDisconnect = () => {
    if (selectedChatId) {
      disconnectMutation.mutate(selectedChatId);
    }
  };

  const handleSetupBot = () => {
    if (!botToken.trim()) {
      toast({ title: "Error", description: "Please enter your bot token", variant: "destructive" });
      return;
    }
    setupBotMutation.mutate(botToken.trim());
  };

  if (isLoadingBot) {
    return (
      <Card data-testid="card-telegram-loading">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner fullScreen={false} />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <>
        <Card data-testid="card-telegram" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#0088cc]/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0088cc]/10">
                <SiTelegram className="h-6 w-6 text-[#0088cc]" />
              </div>
              <div>
                <CardTitle className="text-lg">Telegram</CardTitle>
                <CardDescription>
                  {hasBot ? `@${botStatus.botUsername}` : "Connect your own Telegram bot"}
                </CardDescription>
              </div>
            </div>
            <Badge variant={hasBot ? "default" : "secondary"} className={hasBot ? "bg-green-500" : ""}>
              {hasBot ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Bot Connected
                </>
              ) : (
                "Not Connected"
              )}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasBot || showBotSetup ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your own Telegram bot to receive messages from customers.
                </p>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bot Token</label>
                    <Input
                      type="password"
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      data-testid="input-telegram-bot-token"
                    />
                  </div>
                  <Button
                    className="w-full bg-[#0088cc] hover:bg-[#006699] text-white"
                    onClick={handleSetupBot}
                    disabled={setupBotMutation.isPending || !botToken.trim()}
                    data-testid="button-setup-telegram-bot"
                  >
                    {setupBotMutation.isPending ? (
                      <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {setupBotMutation.isPending ? "Setting up..." : "Connect Bot"}
                  </Button>
                </div>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" data-testid="button-telegram-help">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        How to create a Telegram bot?
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open Telegram and search for <strong>@BotFather</strong></li>
                      <li>Send <code>/newbot</code> and follow the instructions</li>
                      <li>Copy the bot token provided by BotFather</li>
                      <li>Paste it above and click Connect Bot</li>
                    </ol>
                  </CollapsibleContent>
                </Collapsible>
              </>
            ) : isLoadingChats ? (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner fullScreen={false} />
              </div>
            ) : connectMutation.isPending ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-[#0088cc] mx-auto mb-3" />
                <p className="font-medium">Generating Link...</p>
                <p className="text-sm text-muted-foreground">Please wait while we create your connection link.</p>
              </div>
            ) : isConnected ? (
              <>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-2">Connected Chats</div>
                  {status.chats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`telegram-chat-${chat.chatId}`}
                    >
                      <div className="flex items-center gap-2">
                        {chat.chatType === "private" ? (
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">
                          {chat.chatType === "private" ? "Private Chat" : "Group"} — {chat.title || "Unnamed"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedChatId(chat.chatId);
                          setDisconnectDialogOpen(true);
                        }}
                        data-testid={`button-disconnect-telegram-${chat.chatId}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/status"] })}
                    data-testid="button-refresh-telegram"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleConnect}
                    disabled={connectMutation.isPending}
                    data-testid="button-add-another-telegram"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Chat
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-600"
                  onClick={() => setRemoveBotDialogOpen(true)}
                  data-testid="button-remove-telegram-bot"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Bot
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Your bot <strong>@{botStatus?.botUsername}</strong> is ready. Connect a chat to start receiving messages.
                </p>

                {deepLink ? (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">Open this link in Telegram and press <strong>Start</strong>:</p>
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0088cc] hover:underline break-all text-sm"
                      data-testid="link-telegram-deeplink"
                    >
                      {deepLink}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      This link expires in 10 minutes
                    </p>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-[#0088cc] hover:bg-[#006699] text-white"
                    onClick={handleConnect}
                    disabled={connectMutation.isPending}
                    data-testid="button-connect-telegram"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Connect Chat
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-600"
                  onClick={() => setRemoveBotDialogOpen(true)}
                  data-testid="button-remove-telegram-bot"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Bot
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent data-testid="dialog-disconnect-telegram">
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect this chat?</AlertDialogTitle>
              <AlertDialogDescription>
                Curbe will stop sending and receiving messages from this Telegram chat.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-disconnect-telegram">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisconnect}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-disconnect-telegram"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={removeBotDialogOpen} onOpenChange={setRemoveBotDialogOpen}>
          <AlertDialogContent data-testid="dialog-remove-telegram-bot">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Telegram Bot?</AlertDialogTitle>
              <AlertDialogDescription>
                This will disconnect your Telegram bot and all linked chats. You'll need to set up a new bot to use Telegram again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-remove-bot">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeBotMutation.mutate()}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-remove-bot"
              >
                {removeBotMutation.isPending ? "Removing..." : "Remove Bot"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}

function ComingSoonCard({ 
  icon: Icon, 
  title, 
  description,
  bodyText,
  color 
}: { 
  icon: typeof SiInstagram; 
  title: string; 
  description: string;
  bodyText: string;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden opacity-75">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${color}/10 to-transparent`} />
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}/10`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Coming Soon
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {bodyText}
        </p>
        <Button variant="outline" className="w-full" disabled>
          <Plus className="h-4 w-4 mr-2" />
          Connect {title.split(" ")[0]}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    if (location === "/settings" || location === "/settings/") {
      setLocation("/settings/profile");
    }
  }, [location, setLocation]);
  
  const getActiveView = () => {
    if (location.startsWith("/settings/profile")) return "profile";
    if (location.startsWith("/settings/security")) return "security";
    if (location.startsWith("/settings/notifications")) return "notifications";
    if (location.startsWith("/settings/company")) return "company";
    if (location.startsWith("/settings/team")) return "team";
    if (location.startsWith("/settings/billing")) return "billing";
    if (location.startsWith("/settings/sms-voice")) return "sms-voice";
    if (location.startsWith("/settings/email")) return "email";
    if (location.startsWith("/settings/integrations")) return "integrations";
    if (location.startsWith("/settings/automations")) return "automations";
    if (location.startsWith("/settings/whatsapp")) return "whatsapp";
    if (location.startsWith("/settings/facebook")) return "facebook";
    if (location.startsWith("/settings/instagram")) return "instagram";
    if (location.startsWith("/settings/telegram")) return "telegram";
    if (location.startsWith("/settings/white-label")) return "white-label";
    return "profile";
  };
  
  const activeView = getActiveView();

  const menuItems = {
    account: [
      { label: "Profile", href: "/settings/profile", icon: UserIcon, active: activeView === "profile" },
      { label: "Company", href: "/settings/company", icon: Building, active: activeView === "company" },
      { label: "Team", href: "/settings/team", icon: UsersRound, active: activeView === "team" },
      { label: "Billing", href: "/settings/billing", icon: CreditCard, active: activeView === "billing" },
      { label: "Security", href: "/settings/security", icon: Shield, active: activeView === "security" },
      { label: "White Label", href: "/settings/white-label", icon: Palette, active: activeView === "white-label" },
    ],
    channels: [
      { label: "SMS & Voice", href: "/settings/sms-voice", icon: Phone, active: activeView === "sms-voice" },
      { label: "Email", href: "/settings/email", icon: Mail, active: activeView === "email" },
      { label: "WhatsApp", href: "/settings/whatsapp", icon: SiWhatsapp, active: activeView === "whatsapp" },
      { label: "Facebook", href: "/settings/facebook", icon: SiFacebook, active: activeView === "facebook" },
      { label: "Instagram", href: "/settings/instagram", icon: SiInstagram, active: activeView === "instagram" },
      { label: "Telegram", href: "/settings/telegram", icon: SiTelegram, active: activeView === "telegram" },
    ],
    features: [
      { label: "Integrations", href: "/settings/integrations", icon: Plug, active: activeView === "integrations" },
      { label: "Automations", href: "/settings/automations", icon: Zap, active: activeView === "automations" },
    ],
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  return (
    <div className="flex gap-6 items-start" data-testid="page-integrations">
      <div className="w-52 shrink-0 hidden lg:block">
        <nav className="sticky top-20 space-y-1">
          <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
          {menuItems.account.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                item.active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}

          <p className="px-3 py-2 pt-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
          {menuItems.channels.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                item.active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}

          <p className="px-3 py-2 pt-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
          {menuItems.features.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                item.active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-w-0">
        {activeView === "profile" && (
          <div className="relative">
            <SettingsBreadcrumb pageName="Profile" />
            <SettingsPage view="profile" />
          </div>
        )}
        {activeView === "security" && (
          <div>
            <SettingsBreadcrumb pageName="Security" />
            <SettingsPage />
          </div>
        )}
        {activeView === "company" && (
          <div className="relative">
            <SettingsBreadcrumb pageName="Company Settings" />
            <SettingsPage view="company" />
          </div>
        )}
        {activeView === "team" && (
          <div>
            <SettingsBreadcrumb pageName="Team Management" />
            <SettingsPage />
          </div>
        )}
        {activeView === "billing" && (
          <div>
            <SettingsBreadcrumb pageName="Billing" />
            <Billing />
          </div>
        )}
        {activeView === "sms-voice" && (
          <div>
            <SettingsBreadcrumb pageName="SMS & Voice" />
            <SmsVoiceContent />
          </div>
        )}
        {activeView === "email" && (
          <div>
            <SettingsBreadcrumb pageName="Email" />
            <EmailIntegration embedded />
          </div>
        )}
        {activeView === "automations" && (
          <div>
            <SettingsBreadcrumb pageName="Automations" />
          </div>
        )}
        {activeView === "whatsapp" && (
          <div>
            <SettingsBreadcrumb pageName="WhatsApp" />
            <WhatsAppCard />
          </div>
        )}
        {activeView === "facebook" && (
          <div>
            <SettingsBreadcrumb pageName="Facebook Messenger" />
            <FacebookCard />
          </div>
        )}
        {activeView === "instagram" && (
          <div>
            <SettingsBreadcrumb pageName="Instagram" />
            <InstagramCard />
          </div>
        )}
        {activeView === "telegram" && (
          <div>
            <SettingsBreadcrumb pageName="Telegram" />
            <TelegramCard />
          </div>
        )}
        {activeView === "integrations" && (
          <div>
            <SettingsBreadcrumb pageName="Integrations" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div data-card-id="whatsapp">
                <WhatsAppCard />
              </div>
              
              <div data-card-id="instagram">
                <InstagramCard />
              </div>
              
              <div data-card-id="facebook">
                <FacebookCard />
              </div>
              
              <div data-card-id="tiktok">
                <TikTokCard />
              </div>
              
              <div data-card-id="telegram">
                <TelegramCard />
              </div>
            </div>
          </div>
        )}
        {activeView === "white-label" && (
          <div>
            <SettingsBreadcrumb pageName="White Label" />
            <WhiteLabelSettings />
          </div>
        )}
      </div>
    </div>
  );
}
