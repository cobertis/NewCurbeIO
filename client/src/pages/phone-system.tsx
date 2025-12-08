import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Phone, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  PhoneCall,
  MessageSquare,
  Shield,
  Wallet,
  RefreshCw,
  Plus,
  Clock,
  Copy,
  ChevronDown,
  ChevronRight,
  Users,
  Mic,
  ShieldCheck,
  FileText,
  TrendingUp,
  AlertTriangle,
  Zap,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { BuyNumbersDialog } from "@/components/WebPhoneFloatingWindow";

interface ManagedAccountDetails {
  id: string;
  email: string;
  api_key?: string;
  api_token?: string;
  api_user?: string;
  organization_name?: string;
  created_at: string;
  updated_at: string;
  managed_account_allow_custom_pricing?: boolean;
  rollup_billing?: boolean;
  balance?: {
    balance: string;
    credit_limit: string;
    available_credit: string;
    currency: string;
  };
}

interface StatusResponse {
  configured: boolean;
  hasAccount?: boolean;
  managedAccountId?: string;
  accountDetails?: ManagedAccountDetails;
  message?: string;
}

interface NumberInfo {
  phone_number: string;
  connection_name: string;
  status: string;
  phone_number_type?: string;
  created_at?: string;
  id?: string;
  emergency_enabled?: boolean;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7);
    return `(${areaCode}) ${prefix}-${line}`;
  }
  if (digits.length === 10) {
    const areaCode = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6);
    return `(${areaCode}) ${prefix}-${line}`;
  }
  return phone;
}

export default function PhoneSystem() {
  const { toast } = useToast();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showBuyNumber, setShowBuyNumber] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: statusData, isLoading: isLoadingStatus, refetch } = useQuery<StatusResponse>({
    queryKey: ["/api/telnyx/managed-accounts/status"],
  });

  const { data: numbersData, isLoading: isLoadingNumbers, refetch: refetchNumbers } = useQuery<{
    success: boolean;
    numbers?: NumberInfo[];
  }>({
    queryKey: ["/api/telnyx/my-numbers"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  const { data: walletData, refetch: refetchWallet } = useQuery<{
    id: string;
    balance: string;
    currency: string;
    autoRecharge: boolean;
    autoRechargeThreshold: string | null;
    autoRechargeAmount: string | null;
  }>({
    queryKey: ["/api/wallet"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      setIsSettingUp(true);
      const data = await apiRequest("POST", "/api/telnyx/managed-accounts/setup");
      return data;
    },
    onSuccess: (data) => {
      setIsSettingUp(false);
      if (data.success) {
        toast({
          title: "Phone System Activated",
          description: "Your phone system has been set up successfully.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/telnyx/managed-accounts/status"] });
        refetch();
      } else {
        toast({
          title: "Setup Failed",
          description: data.error || "Failed to setup phone system",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setIsSettingUp(false);
      toast({
        title: "Error",
        description: error.message || "Failed to setup phone system",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  if (isLoadingStatus) {
    return <LoadingSpinner fullScreen message="Loading phone system status..." />;
  }

  const hasAccount = statusData?.configured || statusData?.hasAccount;
  const accountDetails = statusData?.accountDetails;
  const accountId = statusData?.managedAccountId;

  const formatCurrency = (amount: string, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(parseFloat(amount || "0"));
  };

  const walletBalance = walletData?.balance || "0";
  const walletCurrency = walletData?.currency || "USD";
  const numbersCount = numbersData?.numbers?.length || 0;
  const hasE911Issues = numbersData?.numbers?.some(n => !n.emergency_enabled) || false;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground" data-testid="text-page-title">
              Phone System
            </h1>
            <p className="text-slate-500 dark:text-muted-foreground mt-1">
              Manage your business phone lines
            </p>
          </div>
          {hasAccount && (
            <div 
              className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              style={{ borderLeft: '4px solid hsl(215, 50%, 55%)' }}
              onClick={() => toast({ title: "Add Funds", description: "Balance management coming soon." })}
              data-testid="button-add-funds"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-medium">Balance</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white" data-testid="text-balance">
                  {formatCurrency(walletBalance, walletCurrency)}
                </p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors flex items-center gap-1">
                <Plus className="h-3 w-3" />
                Add
              </span>
            </div>
          )}
        </div>

        {!hasAccount ? (
          /* Setup Card - Clean onboarding */
          <div className="flex-1 flex items-center justify-center py-16">
            <Card className="max-w-xl w-full border-0 shadow-xl rounded-2xl bg-white dark:bg-card">
              <CardHeader className="text-center pb-4 pt-10">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                  <Phone className="h-8 w-8 text-indigo-600" />
                </div>
                <CardTitle className="text-xl font-semibold">Activate Your Phone System</CardTitle>
                <CardDescription className="text-base mt-2">
                  Get started with professional business calling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pb-8 px-8">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                      <PhoneCall className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-foreground">HD Voice</p>
                  </div>
                  <div className="p-4">
                    <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-foreground">SMS/MMS</p>
                  </div>
                  <div className="p-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-3">
                      <Shield className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-foreground">E911 Ready</p>
                  </div>
                </div>

                <Button 
                  size="lg"
                  onClick={() => setupMutation.mutate()}
                  disabled={isSettingUp}
                  className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  data-testid="button-setup-phone"
                >
                  {isSettingUp ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Activate Now
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-400 text-center">
                  Ready in seconds. No additional setup required.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Modern KPI Cards Row - 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* E911 Emergency Card */}
              <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl bg-white dark:bg-card">
                <div className={`absolute inset-0 opacity-[0.03] ${hasE911Issues ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-green-500'}`} />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${hasE911Issues ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                      <MapPin className={`h-5 w-5 ${hasE911Issues ? 'text-amber-600' : 'text-emerald-600'}`} />
                    </div>
                    {hasE911Issues ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Action Required
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        Configured
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">E911 Emergency</h3>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed">
                      {hasE911Issues ? 'Configure emergency address for your numbers' : 'Emergency services are properly configured'}
                    </p>
                  </div>
                  {hasE911Issues && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-4 h-9 text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
                      onClick={() => toast({ title: "E911 Configuration", description: "E911 configuration will be available in a future update." })}
                      data-testid="button-configure-e911-compliance"
                    >
                      Configure Now
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* A2P 10DLC Card */}
              <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl bg-white dark:bg-card">
                <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-slate-400 to-slate-500" />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-slate-500" />
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                      <Clock className="h-3 w-3" />
                      Coming Soon
                    </span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">A2P 10DLC</h3>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground leading-relaxed">
                      Register your brand for business messaging compliance
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled
                    className="w-full mt-4 h-9 text-xs font-medium text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                    data-testid="button-configure-a2p"
                  >
                    Register Brand
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* Active Lines Card */}
              <Card className="group relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl bg-white dark:bg-card">
                <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-indigo-500 to-blue-500" />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetchNumbers()}
                        disabled={isLoadingNumbers}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
                        data-testid="button-refresh-numbers"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoadingNumbers ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-slate-900 dark:text-foreground" data-testid="text-lines-count">{numbersCount}</span>
                      <span className="text-xs text-slate-500 dark:text-muted-foreground">active {numbersCount === 1 ? 'line' : 'lines'}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">Phone Lines</h3>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-4 h-9 text-xs font-medium text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800"
                    onClick={() => setShowBuyNumber(true)}
                    data-testid="button-add-line"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add New Line
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Phone Numbers List */}
            {numbersData?.numbers && numbersData.numbers.length > 0 && (
              <Card className="border-0 shadow-sm rounded-2xl bg-white dark:bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-foreground">Your Numbers</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-border">
                  {numbersData.numbers.map((number, index) => (
                    <div 
                      key={number.phone_number}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toast({ title: formatPhoneDisplay(number.phone_number), description: "Phone number details coming soon." })}
                      data-testid={`row-number-${number.phone_number}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-foreground">
                            {formatPhoneDisplay(number.phone_number)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-muted-foreground">
                            {number.phone_number_type ? number.phone_number_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Local'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!number.emergency_enabled && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                            E911
                          </Badge>
                        )}
                        <Badge 
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 ${number.status === 'active' ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                        >
                          {number.status === 'active' ? 'Active' : number.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Empty state when no numbers */}
            {(!numbersData?.numbers || numbersData.numbers.length === 0) && !isLoadingNumbers && (
              <Card className="border-0 shadow-sm rounded-2xl bg-white dark:bg-card">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-muted flex items-center justify-center mb-4">
                    <Phone className="h-7 w-7 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-foreground mb-1">No Phone Lines Yet</h3>
                  <p className="text-sm text-slate-500 dark:text-muted-foreground mb-5 max-w-xs">
                    Get your first business phone number to start making calls
                  </p>
                  <Button 
                    onClick={() => setShowBuyNumber(true)} 
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-5"
                  >
                    <Plus className="h-4 w-4" />
                    Get Your First Number
                  </Button>
                </CardContent>
              </Card>
            )}

            {isLoadingNumbers && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}

            {/* Advanced Settings Collapsible */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-slate-500 hover:text-slate-700 dark:hover:text-foreground">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Advanced Settings
                  </span>
                  {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Card className="border-0 shadow-sm rounded-xl bg-white dark:bg-card">
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-muted/50">
                        <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">Account ID</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-slate-700 dark:text-foreground truncate flex-1">{accountId}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(accountId || "", "Account ID")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-muted/50">
                        <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">Organization</p>
                        <p className="text-sm text-slate-700 dark:text-foreground truncate">{accountDetails?.organization_name || '-'}</p>
                      </div>
                      {accountDetails?.api_key && (
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-muted/50 md:col-span-2">
                          <p className="text-xs text-slate-500 dark:text-muted-foreground mb-1">API Key</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-slate-700 dark:text-foreground truncate flex-1">
                              {accountDetails.api_key.substring(0, 30)}...
                            </code>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(accountDetails.api_key || "", "API Key")}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 pt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created: {accountDetails?.created_at ? format(new Date(accountDetails.created_at), "MMM dd, yyyy") : '-'}
                      </span>
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Updated: {accountDetails?.updated_at ? format(new Date(accountDetails.updated_at), "MMM dd, yyyy") : '-'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Buy Number Modal */}
        <BuyNumbersDialog
          open={showBuyNumber}
          onOpenChange={setShowBuyNumber}
          onNumberPurchased={() => {
            refetchNumbers();
          }}
        />
    </div>
  );
}

/* Smart Phone Number Card Component */
interface PhoneNumberCardProps {
  number: NumberInfo;
  index: number;
  onConfigureE911?: (phoneNumber: string, phoneNumberId: string) => void;
}

function PhoneNumberCard({ number, index, onConfigureE911 }: PhoneNumberCardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("routing");
  const [callRecording, setCallRecording] = useState(false);
  const [spamProtection, setSpamProtection] = useState(true);
  const [cnamLookup, setCnamLookup] = useState(false);
  
  const handleFeatureToggle = (feature: string, enabled: boolean) => {
    toast({
      title: enabled ? `${feature} Enabled` : `${feature} Disabled`,
      description: "Feature settings will be available in a future update.",
    });
  };

  return (
    <Card className="border-0 shadow-sm rounded-xl bg-white dark:bg-card overflow-hidden" data-testid={`card-number-${number.phone_number}`}>
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
              <Phone className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <p className="text-xl font-semibold text-slate-900 dark:text-foreground">
                  {formatPhoneDisplay(number.phone_number)}
                </p>
                <Badge variant="outline" className="text-xs">
                  US
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-muted-foreground">
                {number.phone_number_type ? number.phone_number_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Local'}
              </p>
            </div>
          </div>
          <Badge 
            variant={number.status === 'active' ? 'default' : 'secondary'} 
            className={number.status === 'active' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400' : ''}
          >
            {number.status === 'active' ? 'Active' : number.status}
          </Badge>
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-6 border-b border-slate-100 dark:border-border">
          <TabsList className="bg-transparent h-12 p-0 gap-6">
            <TabsTrigger 
              value="routing" 
              className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 pb-3 text-slate-500 data-[state=active]:text-indigo-600"
            >
              <Users className="h-4 w-4 mr-2" />
              Routing
            </TabsTrigger>
            <TabsTrigger 
              value="features"
              className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 pb-3 text-slate-500 data-[state=active]:text-indigo-600"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger 
              value="logs"
              className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 pb-3 text-slate-500 data-[state=active]:text-indigo-600"
            >
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="routing" className="p-6 m-0">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-foreground mb-2 block">
                Who answers calls to this number?
              </label>
              <Select defaultValue="app" onValueChange={(value) => toast({ title: "Routing Updated", description: "Routing settings will be available in a future update." })}>
                <SelectTrigger className="w-full max-w-md bg-white dark:bg-background" data-testid={`select-routing-${number.phone_number}`}>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="app">Web Phone App</SelectItem>
                  <SelectItem value="user">Forward to User</SelectItem>
                  <SelectItem value="group">Ring Group</SelectItem>
                  <SelectItem value="ivr">IVR Menu</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 dark:text-muted-foreground mt-2">
                Incoming calls will be routed to the selected destination
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="features" className="p-6 m-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-foreground">Call Recording</p>
                  <p className="text-xs text-slate-400">Record all calls for quality assurance</p>
                </div>
              </div>
              <Switch 
                checked={callRecording} 
                onCheckedChange={(checked) => { setCallRecording(checked); handleFeatureToggle("Call Recording", checked); }}
                data-testid={`switch-recording-${number.phone_number}`}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-foreground">Spam Protection</p>
                  <p className="text-xs text-slate-400">Block robocalls and spam numbers</p>
                </div>
              </div>
              <Switch 
                checked={spamProtection} 
                onCheckedChange={(checked) => { setSpamProtection(checked); handleFeatureToggle("Spam Protection", checked); }}
                data-testid={`switch-spam-${number.phone_number}`}
              />
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-foreground">Caller ID Lookup (CNAM)</p>
                  <p className="text-xs text-slate-400">Show caller names • Additional cost applies</p>
                </div>
              </div>
              <Switch 
                checked={cnamLookup} 
                onCheckedChange={(checked) => { setCnamLookup(checked); handleFeatureToggle("CNAM Lookup", checked); }}
                data-testid={`switch-cnam-${number.phone_number}`}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="p-6 m-0">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-muted flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 dark:text-muted-foreground">No recent calls</p>
            <p className="text-xs text-slate-400 mt-1">Call logs will appear here</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Card Footer */}
      <div className="px-6 py-3 bg-slate-50 dark:bg-muted/30 border-t border-slate-100 dark:border-border flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-700 gap-2"
          onClick={() => onConfigureE911?.(number.phone_number, number.id || "")}
          data-testid={`button-e911-${number.phone_number}`}
        >
          <MapPin className="h-4 w-4" />
          Configure E911
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-700 gap-2"
          onClick={() => toast({ title: "Call Logs", description: "Detailed call logs will be available in a future update." })}
          data-testid={`button-logs-${number.phone_number}`}
        >
          View Full Logs
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
