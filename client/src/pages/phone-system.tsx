import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  PhoneIncoming,
  PhoneOutgoing,
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
import { E911ConfigDialog } from "@/components/E911ConfigDialog";

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
  const [showE911Dialog, setShowE911Dialog] = useState(false);
  const [selectedNumberForE911, setSelectedNumberForE911] = useState<{ phoneNumber: string; phoneNumberId: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("50");
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [autoRechargeThreshold, setAutoRechargeThreshold] = useState<string>("10");
  const [autoRechargeAmount, setAutoRechargeAmount] = useState<string>("50");
  const isInitialLoadRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef({ enabled: false, threshold: "10", amount: "50" });

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
    wallet: {
      id: string;
      balance: string;
      currency: string;
      autoRecharge: boolean;
      autoRechargeThreshold: string | null;
      autoRechargeAmount: string | null;
    };
  }>({
    queryKey: ["/api/wallet"],
  });

  // Sync auto-recharge state with wallet data
  useEffect(() => {
    if (walletData?.wallet) {
      const enabled = walletData.wallet.autoRecharge || false;
      const threshold = String(parseFloat(walletData.wallet.autoRechargeThreshold || "10"));
      const amount = String(parseFloat(walletData.wallet.autoRechargeAmount || "50"));
      
      setAutoRechargeEnabled(enabled);
      setAutoRechargeThreshold(threshold);
      setAutoRechargeAmount(amount);
      
      // Update saved state reference
      lastSavedStateRef.current = { enabled, threshold, amount };
      
      // Mark initial load as complete after syncing from API
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [walletData]);

  // Handle switch toggle - save immediately by calling mutation directly
  const handleAutoRechargeToggle = (enabled: boolean) => {
    setAutoRechargeEnabled(enabled);
    
    // Skip if still in initial load
    if (isInitialLoadRef.current) return;
    
    const thresholdNum = parseFloat(autoRechargeThreshold) || 10;
    const amountNum = parseFloat(autoRechargeAmount) || 50;
    
    // Call mutation directly - no debounce for toggle
    autoRechargeMutation.mutate({ 
      enabled, 
      threshold: thresholdNum, 
      amount: amountNum 
    });
  };

  // Auto-save threshold/amount changes with debounce
  useEffect(() => {
    // Skip during initial load or if disabled
    if (isInitialLoadRef.current || !autoRechargeEnabled) return;
    
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the save for input changes
    debounceTimerRef.current = setTimeout(() => {
      const thresholdNum = parseFloat(autoRechargeThreshold);
      const amountNum = parseFloat(autoRechargeAmount);
      
      // Validate before saving
      if (isNaN(thresholdNum) || thresholdNum < 5 || thresholdNum > 100) return;
      if (isNaN(amountNum) || amountNum < 10 || amountNum > 500) return;
      
      // Check if values changed from last saved
      const last = lastSavedStateRef.current;
      if (last.threshold === autoRechargeThreshold && last.amount === autoRechargeAmount) return;
      
      // Save to backend
      autoRechargeMutation.mutate({ 
        enabled: autoRechargeEnabled, 
        threshold: thresholdNum, 
        amount: amountNum 
      });
    }, 800);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoRechargeThreshold, autoRechargeAmount]);

  // Call history query

  const { data: callLogsData, isLoading: isLoadingCallLogs, refetch: refetchCallLogs } = useQuery<{

    logs: Array<{

      id: string;

      fromNumber: string;

      toNumber: string;

      direction: string;

      status: string;

      duration: number;

      billedDuration?: number;

      cost?: string;

      costCurrency?: string;

      callerName?: string;

      recordingUrl?: string;

      startedAt: string;

      endedAt?: string;

    }>;

  }>({

    queryKey: ["/api/call-logs"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  // Noise suppression settings query
  const { data: noiseSuppressionData, refetch: refetchNoiseSuppression } = useQuery<{
    enabled: boolean;
    direction: 'inbound' | 'outbound' | 'both';
  }>({
    queryKey: ["/api/telnyx/noise-suppression"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  // Sync call history from Telnyx CDRs
  const syncCallsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/call-logs/sync");
    },
    onSuccess: (data: { success: boolean; synced: number; errors?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-logs"] });
      if (data.synced > 0) {
        toast({
          title: "Calls Synced",
          description: `Synced ${data.synced} call records from phone system.`,
        });
      } else {
        toast({
          title: "No New Calls",
          description: "No new call records found to sync.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync call history",
        variant: "destructive",
      });
    },
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

  const topUpMutation = useMutation({
    mutationFn: async (amount: number) => {
      const data = await apiRequest("POST", "/api/wallet/top-up", { amount });
      return data;
    },
    onSuccess: (data: { success: boolean; newBalance: string; amount: number }) => {
      setShowAddFunds(false);
      setTopUpAmount("25");
      toast({
        title: "Funds Added",
        description: `$${data.amount.toFixed(2)} has been added to your wallet. New balance: $${parseFloat(data.newBalance).toFixed(2)}`,
      });
      refetchWallet();
    },
    onError: (error: Error) => {
      toast({
        title: "Top-Up Failed",
        description: error.message || "Failed to add funds to wallet",
        variant: "destructive",
      });
    },
  });

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 5 || amount > 500) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount between $5 and $500",
        variant: "destructive",
      });
      return;
    }
    topUpMutation.mutate(amount);
  };

  const autoRechargeMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; threshold: number; amount: number }) => {
      return await apiRequest("POST", "/api/wallet/auto-recharge", data);
    },
    onSuccess: (_, variables) => {
      // Update saved state ONLY after successful save
      lastSavedStateRef.current = { 
        enabled: variables.enabled, 
        threshold: String(variables.threshold), 
        amount: String(variables.amount) 
      };
      toast({
        title: variables.enabled ? "Auto-Recharge Enabled" : "Auto-Recharge Disabled",
        description: variables.enabled 
          ? `Will add $${variables.amount} when balance falls below $${variables.threshold}`
          : "Auto-recharge has been turned off",
      });
      refetchWallet();
    },
    onError: (error: Error) => {
      // Revert UI state on error
      if (walletData?.wallet) {
        setAutoRechargeEnabled(walletData.wallet.autoRecharge || false);
      }
      toast({
        title: "Failed to Update",
        description: error.message || "Could not update auto-recharge settings",
        variant: "destructive",
      });
    },
  });


  // Noise suppression mutation
  const noiseSuppressionMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; direction: string }) => {
      return await apiRequest("POST", "/api/telnyx/noise-suppression", data);
    },
    onSuccess: (response: { success: boolean; enabled: boolean; direction: string; updatedNumbers?: number; errors?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/noise-suppression"] });
      refetchNoiseSuppression();
      toast({
        title: response.enabled ? "Noise Suppression Enabled" : "Noise Suppression Disabled",
        description: response.enabled 
          ? `Active on ${response.updatedNumbers || 0} phone number(s). Direction: ${response.direction}`
          : "Noise suppression has been turned off for all numbers",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update",
        description: error.message || "Could not update noise suppression settings",
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

  const walletBalance = walletData?.wallet?.balance || "0";
  const walletCurrency = walletData?.wallet?.currency || "USD";
  const numbersCount = numbersData?.numbers?.length || 0;
  const isE911Loading = isLoadingNumbers || !numbersData;
  const hasE911Issues = !isE911Loading && (numbersData?.numbers?.some(n => !n.emergency_enabled) || numbersCount === 0);

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
              onClick={() => setShowAddFunds(true)}
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
                {walletData?.wallet?.autoRecharge && (
                  <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1" data-testid="text-auto-recharge-status">
                    <RefreshCw className="h-2.5 w-2.5" />
                    Auto: +${Math.round(parseFloat(walletData.wallet.autoRechargeAmount || "0"))} when &lt;${Math.round(parseFloat(walletData.wallet.autoRechargeThreshold || "0"))}
                  </p>
                )}
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
          <div className="space-y-5">
            {/* 3 Status Cards - Same Style */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* E911 Card */}
              <div 
                className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card cursor-pointer transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
                onClick={() => {
                  if (numbersData?.numbers?.[0]) {
                    setSelectedNumberForE911({
                      phoneNumber: numbersData.numbers[0].phone_number,
                      phoneNumberId: numbersData.numbers[0].id || "",
                    });
                    setShowE911Dialog(true);
                  } else {
                    toast({ title: "No Phone Number", description: "Please purchase a phone number first before configuring E911." });
                  }
                }}
                data-testid="button-configure-e911-compliance"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isE911Loading ? 'bg-slate-100 dark:bg-slate-800' :
                  hasE911Issues ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
                }`}>
                  {isE911Loading ? (
                    <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                  ) : (
                    <MapPin className={`h-5 w-5 ${hasE911Issues ? 'text-amber-600' : 'text-emerald-600'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-foreground">E911</p>
                  <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">Emergency address</p>
                </div>
                {isE911Loading ? (
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full shrink-0">
                    Loading
                  </span>
                ) : hasE911Issues ? (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full shrink-0">
                    Pending
                  </span>
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
              </div>

              {/* A2P 10DLC Card */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card opacity-50 cursor-not-allowed">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">A2P 10DLC</p>
                  <p className="text-xs text-slate-400 dark:text-muted-foreground truncate">Coming soon</p>
                </div>
                <Clock className="h-4 w-4 text-slate-300 shrink-0" />
              </div>

              {/* My Numbers Card */}
              {numbersCount > 0 && numbersData?.numbers?.[0] ? (
                <div 
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card"
                  data-testid="card-my-number"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-foreground">
                      {formatPhoneDisplay(numbersData.numbers[0].phone_number)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">My Number</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    numbersData.numbers[0].status === 'active' 
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' 
                      : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
                  }`}>
                    {numbersData.numbers[0].status === 'active' ? 'Active' : numbersData.numbers[0].status}
                  </span>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card cursor-pointer transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
                  onClick={() => setShowBuyNumber(true)}
                  data-testid="button-add-line"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-foreground">My Numbers</p>
                    <p className="text-xs text-slate-500 dark:text-muted-foreground truncate">Get a number</p>
                  </div>
                  <Plus className="h-4 w-4 text-indigo-500 shrink-0" />
                </div>
              )}
            </div>

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

        {/* Audio Features Section */}
        {statusData?.configured && (
          <Card className="shadow-sm border-slate-200 dark:border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                Audio Features
              </CardTitle>
              <CardDescription>
                Configure audio settings for all your phone numbers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                    <Mic className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 dark:text-foreground">Noise Suppression</p>
                    <p className="text-sm text-muted-foreground">Reduces background noise during calls. Applies to all phone numbers.</p>
                  </div>
                </div>
                <Switch
                  checked={noiseSuppressionData?.enabled || false}
                  onCheckedChange={(checked) => {
                    noiseSuppressionMutation.mutate({
                      enabled: checked,
                      direction: noiseSuppressionData?.direction || 'outbound',
                    });
                  }}
                  disabled={noiseSuppressionMutation.isPending}
                  data-testid="switch-noise-suppression"
                />
              </div>
              
              {noiseSuppressionData?.enabled && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <Label className="text-slate-700 dark:text-foreground">Direction</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Which side of the call to apply noise reduction</p>
                  </div>
                  <Select
                    value={noiseSuppressionData?.direction || 'outbound'}
                    onValueChange={(value: 'inbound' | 'outbound' | 'both') => {
                      noiseSuppressionMutation.mutate({
                        enabled: true,
                        direction: value,
                      });
                    }}
                    disabled={noiseSuppressionMutation.isPending}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-noise-direction">
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outbound">Outbound Only</SelectItem>
                      <SelectItem value="inbound">Inbound Only</SelectItem>
                      <SelectItem value="both">Both Directions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {noiseSuppressionMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating noise suppression settings...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Call History Section */}
        {statusData?.configured && (
          <Card className="shadow-sm border-slate-200 dark:border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  Call History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncCallsMutation.mutate()}
                  disabled={syncCallsMutation.isPending}
                  className="h-8"
                  data-testid="button-refresh-call-logs"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncCallsMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncCallsMutation.isPending ? 'Syncing...' : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoadingCallLogs ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !callLogsData?.logs || callLogsData.logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No calls yet</p>
                  <p className="text-xs mt-1">Your call history will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {callLogsData.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-muted/50 hover:bg-slate-100 dark:hover:bg-muted transition-colors"
                      data-testid={`row-call-${log.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          log.direction === 'inbound' 
                            ? 'bg-blue-100 dark:bg-blue-900/30' 
                            : 'bg-green-100 dark:bg-green-900/30'
                        }`}>
                          {log.direction === 'inbound' ? (
                            <PhoneIncoming className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <PhoneOutgoing className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-700 dark:text-foreground truncate">
                              {log.direction === 'inbound' ? log.fromNumber : log.toNumber}
                            </p>
                            {log.callerName && (
                              <span className="text-xs text-muted-foreground">({log.callerName})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{format(new Date(log.startedAt), "MMM dd, h:mm a")}</span>
                            <span className="text-slate-400">•</span>
                            <span className={`capitalize ${
                              log.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                              log.status === 'failed' || log.status === 'busy' || log.status === 'no-answer' ? 'text-red-500' :
                              'text-amber-600 dark:text-amber-400'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          {log.duration > 0 && (
                            <p className="text-sm text-slate-700 dark:text-foreground">
                              {Math.floor(log.duration / 60)}:{(log.duration % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                          {log.cost && parseFloat(log.cost) > 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              ${parseFloat(log.cost).toFixed(4)} {log.costCurrency || 'USD'}
                            </p>
                          )}
                        </div>
                        {log.recordingUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(log.recordingUrl, '_blank')}
                            data-testid={`button-play-recording-${log.id}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-primary">
                              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Buy Number Modal */}
        <BuyNumbersDialog
          open={showBuyNumber}
          onOpenChange={setShowBuyNumber}
          onNumberPurchased={() => {
            refetchNumbers();
          }}
        />

        {selectedNumberForE911 && (
          <E911ConfigDialog
            open={showE911Dialog}
            onOpenChange={setShowE911Dialog}
            phoneNumber={selectedNumberForE911.phoneNumber}
            phoneNumberId={selectedNumberForE911.phoneNumberId}
            onSuccess={() => {
              refetchNumbers();
              setSelectedNumberForE911(null);
            }}
          />
        )}

        {/* Add Funds Dialog */}
        <Dialog open={showAddFunds} onOpenChange={(open) => {
          setShowAddFunds(open);
          if (!open) setShowCustomAmount(false);
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Funds to Wallet</DialogTitle>
              <DialogDescription>
                Add funds using your saved payment method.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Amount Selection */}
              <div className="space-y-3">
                <Label>Select Amount</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[10, 20, 50, 100].map((amt) => (
                    <Button
                      key={amt}
                      type="button"
                      variant={!showCustomAmount && topUpAmount === String(amt) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setTopUpAmount(String(amt));
                        setShowCustomAmount(false);
                      }}
                      className="h-12"
                      data-testid={`button-preset-${amt}`}
                    >
                      ${amt}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={showCustomAmount ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setShowCustomAmount(true);
                      setTopUpAmount("");
                    }}
                    className="h-12"
                    data-testid="button-preset-other"
                  >
                    Other
                  </Button>
                </div>
                {showCustomAmount && (
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                    <Input
                      type="number"
                      min="5"
                      max="500"
                      step="1"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="pl-8 text-lg h-12"
                      placeholder="Enter amount"
                      autoFocus
                      data-testid="input-topup-amount"
                    />
                    <p className="text-xs text-slate-500 mt-1">Minimum $5, maximum $500</p>
                  </div>
                )}
              </div>

              {/* Auto-Recharge Section */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto-Recharge</Label>
                    <p className="text-xs text-slate-500">Automatically add funds when balance is low</p>
                  </div>
                  <Switch
                    checked={autoRechargeEnabled}
                    onCheckedChange={handleAutoRechargeToggle}
                    data-testid="switch-auto-recharge"
                  />
                </div>
                
                {autoRechargeEnabled && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-xs">When balance falls below</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <Input
                          type="number"
                          min="5"
                          max="100"
                          value={autoRechargeThreshold}
                          onChange={(e) => setAutoRechargeThreshold(e.target.value)}
                          className="pl-7"
                          data-testid="input-auto-recharge-threshold"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Add this amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <Input
                          type="number"
                          min="10"
                          max="500"
                          value={autoRechargeAmount}
                          onChange={(e) => setAutoRechargeAmount(e.target.value)}
                          className="pl-7"
                          data-testid="input-auto-recharge-amount"
                        />
                      </div>
                    </div>
                    {autoRechargeMutation.isPending && (
                      <div className="col-span-2 flex items-center justify-center text-xs text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddFunds(false)}
                disabled={topUpMutation.isPending}
                data-testid="button-cancel-topup"
              >
                Cancel
              </Button>
              <Button
                onClick={handleTopUp}
                disabled={topUpMutation.isPending || !topUpAmount || parseFloat(topUpAmount) < 5}
                data-testid="button-confirm-topup"
              >
                {topUpMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  `Add $${topUpAmount || '0'}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
  const [cnamName, setCnamName] = useState("");
  const [cnamEnabled, setCnamEnabled] = useState(false);
  const [isEditingCnam, setIsEditingCnam] = useState(false);

  // Query CNAM settings for this number
  const cnamQuery = useQuery<{ cnamEnabled: boolean; cnamName: string }>({
    queryKey: ["/api/telnyx/cnam", number.id],
    queryFn: async () => {
      const res = await fetch(`/api/telnyx/cnam/${number.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch CNAM settings");
      return res.json();
    },
    enabled: !!number.id,
  });

  // Update local state when CNAM data loads
  useEffect(() => {
    if (cnamQuery.data) {
      setCnamName(cnamQuery.data.cnamName || "");
      setCnamEnabled(cnamQuery.data.cnamEnabled || false);
    }
  }, [cnamQuery.data]);

  // Mutation to update CNAM
  const cnamMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; cnamName?: string }) => {
      return await apiRequest("POST", `/api/telnyx/cnam/${number.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/cnam", number.id] });
      setIsEditingCnam(false);
      toast({
        title: "CNAM Updated",
        description: "Caller ID name settings updated. Changes may take 12-72 hours to propagate.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update CNAM settings",
      });
    },
  });
  
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
            {/* CNAM Listing (Outbound Caller ID Name) */}
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-foreground">Caller ID Name (CNAM Listing)</p>
                    <p className="text-xs text-slate-400">Display your company name when making outbound calls</p>
                  </div>
                </div>
                <Switch 
                  checked={cnamEnabled}
                  disabled={cnamMutation.isPending}
                  onCheckedChange={(checked) => {
                    setCnamEnabled(checked); // Optimistic update
                    if (checked && !cnamName) {
                      setIsEditingCnam(true);
                    } else {
                      cnamMutation.mutate({ enabled: checked, cnamName: cnamName || undefined });
                    }
                  }}
                  data-testid={`switch-cnam-listing-${number.phone_number}`}
                />
              </div>
              
              {(cnamEnabled || isEditingCnam) && (
                <div className="pt-2 border-t border-slate-200 dark:border-border space-y-3">
                  <div>
                    <Label htmlFor={`cnam-name-${number.id}`} className="text-xs text-slate-600 dark:text-muted-foreground">
                      Display Name (max 15 characters, letters/numbers/spaces only)
                    </Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id={`cnam-name-${number.id}`}
                        value={cnamName}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 15);
                          setCnamName(value);
                        }}
                        placeholder="Company Name"
                        maxLength={15}
                        className="flex-1 h-9 bg-white dark:bg-background"
                        data-testid={`input-cnam-name-${number.phone_number}`}
                      />
                      <Button
                        size="sm"
                        onClick={() => cnamMutation.mutate({ enabled: true, cnamName })}
                        disabled={cnamMutation.isPending || !cnamName.trim()}
                        data-testid={`button-save-cnam-${number.phone_number}`}
                      >
                        {cnamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {cnamName.length}/15 characters • Changes take 12-72 hours to propagate
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Inbound CNAM Lookup */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-foreground">Caller ID Lookup (Inbound)</p>
                  <p className="text-xs text-slate-400">Show caller names on incoming calls • Additional cost applies</p>
                </div>
              </div>
              <Switch 
                checked={cnamLookup} 
                onCheckedChange={(checked) => { setCnamLookup(checked); handleFeatureToggle("CNAM Lookup", checked); }}
                data-testid={`switch-cnam-lookup-${number.phone_number}`}
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
