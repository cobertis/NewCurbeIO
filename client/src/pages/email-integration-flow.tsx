import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowLeft,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link, useLocation } from "wouter";
import {
  Phone,
  MessageSquare,
  Building,
  CreditCard,
  User as UserIcon,
  Zap,
  Plug,
  Ticket,
  ListTodo,
  DollarSign,
  Sparkles,
  Settings,
  Users,
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}

function NavigationLink({ item, onClick }: { item: NavigationItem; onClick: (href: string) => void }) {
  return (
    <button
      onClick={() => onClick(item.href)}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
        item.active && "border-l-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
      )}
    >
      <item.icon className="h-4 w-4" />
      <span className="flex-1 text-left">{item.label}</span>
    </button>
  );
}

function SettingsSidebar({ onNavigate }: { onNavigate: (href: string) => void }) {
  const menuItems: { channels: NavigationItem[]; features: NavigationItem[]; administration: NavigationItem[] } = {
    channels: [
      { label: "SMS & voice", href: "/integrations/sms-voice", icon: Phone },
      { label: "Email", href: "/settings/email", icon: Mail, active: true },
      { label: "Chat widget", href: "/integrations", icon: MessageSquare },
      { label: "WhatsApp", href: "/integrations", icon: SiWhatsapp },
      { label: "Facebook", href: "/integrations", icon: SiFacebook },
      { label: "Instagram", href: "/integrations", icon: SiInstagram },
    ],
    features: [
      { label: "Messenger", href: "/inbox", icon: MessageSquare },
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "API & Integrations", href: "/integrations", icon: Plug },
      { label: "Email to SMS", href: "/settings/email-to-sms", icon: Mail },
      { label: "Auto-responders", href: "/campaigns", icon: Zap },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Deals", href: "/deals", icon: DollarSign },
      { label: "Point AI", href: "/ai-assistant", icon: Sparkles },
    ],
    administration: [
      { label: "Workspace", href: "/settings/company", icon: Building },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "My account", href: "/settings/profile", icon: UserIcon },
    ],
  };

  return (
    <div className="w-60 shrink-0 hidden lg:block">
      <div className="sticky top-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Settings</span>
        </div>

        <div className="py-2">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
          {menuItems.channels.map((item) => (
            <NavigationLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>

        <div className="py-2">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
          {menuItems.features.map((item) => (
            <NavigationLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>

        <div className="py-2 pb-3">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
          {menuItems.administration.map((item) => (
            <NavigationLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface EmailSettings {
  id: string;
  companyId: string;
  sendingDomain: string;
  identityArn?: string;
  verificationStatus: string;
  dkimStatus?: string;
  mailFromDomain?: string;
  mailFromStatus?: string;
  configurationSetName?: string;
  isActive: boolean;
  isPaused: boolean;
  pauseReason?: string;
  dailyLimit: number;
  hourlyLimit: number;
  minuteLimit: number;
  warmupStage: number;
  bounceRate: number;
  complaintRate: number;
  maxBounceRate: number;
  maxComplaintRate: number;
  createdAt: string;
  senders?: EmailSender[];
}

interface EmailSender {
  id?: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
  status?: string;
}

type WizardStep = 1 | 2 | 3;

export default function EmailIntegrationFlowPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [domain, setDomain] = useState("");
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({
    dkim: true,
    dmarc: true,
  });
  const [senders, setSenders] = useState<EmailSender[]>([
    { fromEmail: "", fromName: "", replyToEmail: "" }
  ]);

  const { data: settingsResponse, isLoading: loadingSettings } = useQuery<{ configured: boolean; settings: EmailSettings | null }>({
    queryKey: ["/api/ses/settings"],
  });

  const settings = settingsResponse?.settings;

  const { data: dnsRecordsResponse, isLoading: loadingDns, isFetching: checkingDns, refetch: refetchDns } = useQuery<{ records: DnsRecord[] }>({
    queryKey: ["/api/ses/domain/dns-records"],
    enabled: !!settings?.sendingDomain,
  });

  const dnsRecords = dnsRecordsResponse?.records || [];

  useEffect(() => {
    if (settings?.sendingDomain) {
      setDomain(settings.sendingDomain);
      if (settings.verificationStatus === "SUCCESS" || settings.dkimStatus === "SUCCESS") {
        setCurrentStep(3);
      } else {
        setCurrentStep(2);
      }
      if (settings.senders && settings.senders.length > 0) {
        setSenders(settings.senders);
      }
    }
  }, [settings]);

  const setupDomainMutation = useMutation({
    mutationFn: async (domainName: string) => {
      return apiRequest("POST", "/api/ses/domain/setup", { domain: domainName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ses/domain/dns-records"] });
      setCurrentStep(2);
      toast({
        title: "Domain added",
        description: "Now add the DNS records to verify your domain.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/ses/domain/verify");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ses/domain/dns-records"] });
      if (data?.verified) {
        toast({
          title: "Domain verified",
          description: "Your domain has been successfully verified.",
        });
        setCurrentStep(3);
      } else {
        toast({
          title: "Verification in progress",
          description: "Some records are still pending. Please check your DNS settings.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect domain mutation
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  
  const disconnectDomainMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/ses/domain");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ses/domain/dns-records"] });
      setCurrentStep(1);
      setDomain("");
      setSenders([{ fromEmail: "", fromName: "", replyToEmail: "" }]);
      setShowDisconnectConfirm(false);
      toast({
        title: "Domain disconnected",
        description: "Your domain has been removed. You can set up a new domain anytime.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-refresh verification status every 5 seconds when on step 2
  useEffect(() => {
    if (currentStep === 2 && settings?.sendingDomain) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/ses/domain/dns-records"] });
      }, 5000); // Check every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [currentStep, settings?.sendingDomain]);

  const saveSendersMutation = useMutation({
    mutationFn: async (sendersData: EmailSender[]) => {
      return apiRequest("POST", "/api/ses/senders", { senders: sendersData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      toast({
        title: "Setup complete",
        description: "Your email senders have been configured.",
      });
      setLocation("/integrations/email");
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Value copied to clipboard.",
    });
  };

  const toggleRecord = (key: string) => {
    setExpandedRecords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addSender = () => {
    setSenders([...senders, { fromEmail: "", fromName: "", replyToEmail: "" }]);
  };

  const removeSender = (index: number) => {
    if (senders.length > 1) {
      setSenders(senders.filter((_, i) => i !== index));
    }
  };

  const updateSender = (index: number, field: keyof EmailSender, value: string) => {
    const updated = [...senders];
    updated[index] = { ...updated[index], [field]: value };
    setSenders(updated);
  };

  const isStepComplete = (step: WizardStep): boolean => {
    if (step === 1) return !!settings?.sendingDomain;
    if (step === 2) return settings?.verificationStatus === "SUCCESS" || settings?.dkimStatus === "SUCCESS";
    if (step === 3) return (settings?.senders?.length ?? 0) > 0;
    return false;
  };

  const getDkimRecords = () => dnsRecords.filter(r => r.purpose === "DKIM");
  const getSpfRecord = () => dnsRecords.find(r => r.purpose === "SPF");
  const getDmarcRecord = () => dnsRecords.find(r => r.purpose === "DMARC" || r.name?.includes("_dmarc"));

  const allRecordsVerified = () => {
    const dkimRecords = getDkimRecords();
    // Check if all DKIM records are verified or overall verification is successful
    const allDkimVerified = dkimRecords.length > 0 && dkimRecords.every(r => r.status === "success" || r.status === "SUCCESS");
    return allDkimVerified || settings?.verificationStatus === "SUCCESS" || settings?.dkimStatus === "success";
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  if (loadingSettings) {
    return <LoadingSpinner message="Loading email settings..." />;
  }

  return (
    <div className="flex gap-6" data-testid="page-email-integration-flow">
      <SettingsSidebar onNavigate={handleNavigation} />
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/integrations/email">
            <Button variant="ghost" size="sm" data-testid="button-back-email">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-semibold mb-1">Email Domain Setup</h1>
          <p className="text-muted-foreground">Configure your sending domain for email campaigns</p>
        </div>

        <div className="space-y-4">
        {/* Step 1: Add your domain */}
        <Card className={`${isStepComplete(1) ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isStepComplete(1) 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {isStepComplete(1) ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-semibold">1</span>}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Add your domain</h3>
                {isStepComplete(1) ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      You have added the following domain: <strong>{settings?.sendingDomain}</strong>
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                      data-testid="button-disconnect-domain"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Enter the domain you'll use for sending emails.
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="domain" className="text-sm font-medium">
                          Domain name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="domain"
                          placeholder="company.com"
                          value={domain}
                          onChange={(e) => setDomain(e.target.value)}
                          className="mt-1.5 max-w-md"
                          data-testid="input-domain-name"
                        />
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                              Tips for setting up your domain for email campaigns
                            </p>
                            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                              <li>Consider using a subdomain (e.g. marketing.yourcompany.com) to protect your main domain's reputation.</li>
                              <li>Ensure you own or manage the domain.</li>
                              <li>Make sure you, a team member, or an IT consultant can manage DNS records for the domain you will use.</li>
                              <li>Free email domains (Gmail, Yahoo) can't be used — use your own domain.</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => setupDomainMutation.mutate(domain)}
                        disabled={!domain || setupDomainMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-continue-step1"
                      >
                        {setupDomainMutation.isPending && <LoadingSpinner fullScreen={false} />}
                        Continue
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Authenticate domain */}
        <Card className={`${isStepComplete(2) ? 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20' : ''}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isStepComplete(2) 
                  ? 'bg-green-500 text-white' 
                  : isStepComplete(1)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {isStepComplete(2) ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-semibold">2</span>}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Authenticate domain</h3>
                {isStepComplete(2) ? (
                  <p className="text-sm text-muted-foreground">
                    You have verified your domain ownership.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4">
                    This step is needed to verify domain ownership and improve email delivery.
                  </p>
                )}

                {isStepComplete(1) && !isStepComplete(2) && (
                  <div className="space-y-4 mt-4">
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            How DNS updates work
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Add SPF, DKIM, and DMARC records in your domain hosting provider's dashboard to verify your domain and improve email delivery.
                          </p>
                        </div>
                      </div>
                    </div>

                    {loadingDns ? (
                      <LoadingSpinner message="Loading DNS records..." fullScreen={false} />
                    ) : (
                      <div className="space-y-3">
                        {/* DKIM Records - ALL 3 are required */}
                        {getDkimRecords().map((record, index) => (
                          <DnsRecordCard
                            key={`dkim-${index}`}
                            title={`DKIM Record ${index + 1} of ${getDkimRecords().length} (CNAME)`}
                            description={index === 0 ? "All DKIM records must be added to verify your domain. This cryptographically signs emails sent from your domain." : ""}
                            record={record}
                            expanded={expandedRecords[`dkim-${index}`] ?? true}
                            onToggle={() => toggleRecord(`dkim-${index}`)}
                            onCopy={copyToClipboard}
                            isChecking={checkingDns}
                          />
                        ))}

                        {/* SPF Record */}
                        {getSpfRecord() && (
                          <DnsRecordCard
                            title="SPF Record (TXT)"
                            description="This authorizes Amazon SES to send emails on behalf of your domain."
                            record={getSpfRecord()!}
                            expanded={expandedRecords.spf ?? true}
                            onToggle={() => toggleRecord('spf')}
                            onCopy={copyToClipboard}
                            isChecking={checkingDns}
                          />
                        )}

                        {/* DMARC Record */}
                        {getDmarcRecord() && (
                          <DnsRecordCard
                            title="DMARC Record (TXT)"
                            description="This record protects your domain from unauthorized email use and helps improve deliverability."
                            record={getDmarcRecord()!}
                            expanded={expandedRecords.dmarc ?? true}
                            onToggle={() => toggleRecord('dmarc')}
                            onCopy={copyToClipboard}
                            isChecking={checkingDns}
                          />
                        )}
                      </div>
                    )}

                    {allRecordsVerified() && (
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          <p className="text-sm text-green-800 dark:text-green-200">
                            Your domain <strong>{settings?.sendingDomain}</strong> has been successfully verified. Continue to the next step to add senders.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Auto-verification notice */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 text-blue-600 dark:text-blue-400 ${checkingDns ? 'animate-spin' : ''}`} />
                        <p className="text-xs text-blue-800 dark:text-blue-200">
                          {checkingDns ? "Checking DNS records..." : "Verification status updates automatically every 5 seconds. You can also click \"Verify records\" to check immediately."}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => verifyDomainMutation.mutate()}
                        disabled={verifyDomainMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-verify-records"
                      >
                        {verifyDomainMutation.isPending ? (
                          <LoadingSpinner fullScreen={false} />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Verify records
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setLocation("/integrations/email")}
                        data-testid="button-finish-later"
                      >
                        Finish later
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Add email senders */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isStepComplete(3) 
                  ? 'bg-green-500 text-white' 
                  : isStepComplete(2)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {isStepComplete(3) ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-semibold">3</span>}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Add email senders</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create sender profiles that will be used when sending emails from your domain.
                </p>

                {(isStepComplete(2) || currentStep === 3) && (
                  <div className="space-y-6 mt-4">
                    {senders.map((sender, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-4">
                            <div>
                              <Label className="text-sm font-medium">
                                "From" email address <span className="text-red-500">*</span>
                              </Label>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Input
                                  placeholder="example"
                                  value={sender.fromEmail.split('@')[0] || sender.fromEmail}
                                  onChange={(e) => updateSender(index, 'fromEmail', e.target.value)}
                                  className="max-w-[200px]"
                                  data-testid={`input-from-email-${index}`}
                                />
                                <span className="text-sm text-muted-foreground bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded border">
                                  @{settings?.sendingDomain || 'domain.com'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                The recipients will see this email @{settings?.sendingDomain} as the "From" address.
                              </p>
                            </div>

                            <div>
                              <Label className="text-sm font-medium">
                                "From" name <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                placeholder="Organization or person name"
                                value={sender.fromName}
                                onChange={(e) => updateSender(index, 'fromName', e.target.value)}
                                className="mt-1.5 max-w-md"
                                data-testid={`input-from-name-${index}`}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                This name will be displayed as the sender in email clients.
                              </p>
                            </div>

                            <div>
                              <Label className="text-sm font-medium">"Reply-to" email</Label>
                              <Input
                                placeholder="example@company.com"
                                value={sender.replyToEmail || ""}
                                onChange={(e) => updateSender(index, 'replyToEmail', e.target.value)}
                                className="mt-1.5 max-w-md"
                                data-testid={`input-reply-to-${index}`}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Email where replies will be sent. If left blank, replies will go to the sender's email address.
                              </p>
                            </div>

                            <div>
                              <Label className="text-sm font-medium">Sender preview</Label>
                              <div className="flex items-center gap-3 mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm">
                                    {sender.fromName || "Sender Name"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {sender.fromEmail ? `${sender.fromEmail}@${settings?.sendingDomain}` : `example@${settings?.sendingDomain || 'domain.com'}`}
                                  </p>
                                  {sender.replyToEmail && (
                                    <p className="text-xs text-muted-foreground">Reply to: {sender.replyToEmail}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {senders.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSender(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              data-testid={`button-remove-sender-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={addSender}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                      data-testid="button-add-sender"
                    >
                      <Plus className="w-4 h-4" />
                      Add another sender
                    </button>

                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Note about sender emails
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Each sender profile will appear as a separate option when composing emails. Make sure to create profiles for each department or purpose (e.g., info, support, marketing).
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => saveSendersMutation.mutate(senders.map(s => ({
                          ...s,
                          fromEmail: s.fromEmail.includes('@') ? s.fromEmail : `${s.fromEmail}@${settings?.sendingDomain}`
                        })))}
                        disabled={saveSendersMutation.isPending || !senders.some(s => s.fromEmail && s.fromName)}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-save-senders"
                      >
                        {saveSendersMutation.isPending && <LoadingSpinner fullScreen={false} />}
                        Save & finish setup
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setLocation("/integrations/email")}
                        data-testid="button-finish-later"
                      >
                        Finish later
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect <strong>{settings?.sendingDomain}</strong>? 
              This will remove the domain from AWS SES and delete all configuration. 
              You will need to set up a new domain to send emails again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectDomainMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={disconnectDomainMutation.isPending}
              data-testid="button-confirm-disconnect"
            >
              {disconnectDomainMutation.isPending && <LoadingSpinner fullScreen={false} />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface DnsRecordCardProps {
  title: string;
  description: string;
  record: DnsRecord;
  expanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  isChecking?: boolean;
}

function DnsRecordCard({ title, description, record, expanded, onToggle, onCopy, isChecking }: DnsRecordCardProps) {
  const isVerified = record.status === "SUCCESS" || record.status === "success";

  return (
    <div className="border rounded-lg overflow-hidden">
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
          <div className="text-left">
            <h4 className="font-medium">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-3">
            {isChecking ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0 animate-pulse">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />Checking DNS...
              </Badge>
            ) : (
              <Badge className={isVerified 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0" 
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-0"
              }>
                {isVerified ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" />Verified</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" />Not verified</>
                )}
              </Badge>
            )}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-3 border-t">
            <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-start text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-mono">{record.type}</span>
              <div></div>
            </div>
            <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-start text-sm">
              <span className="text-muted-foreground">Name / Host</span>
              <span className="font-mono text-xs break-all">{record.name}</span>
              <Button variant="outline" size="sm" onClick={() => onCopy(record.name)} data-testid="button-copy-name">
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
            <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-start text-sm">
              <span className="text-muted-foreground">{record.type} value</span>
              <span className="font-mono text-xs break-all">{record.value}</span>
              <Button variant="outline" size="sm" onClick={() => onCopy(record.value)} data-testid="button-copy-value">
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
