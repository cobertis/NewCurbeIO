import { useState, useEffect, useRef, useCallback } from "react";
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
import { 
  Phone, 
  PhoneIncoming,
  PhoneOutgoing,
  Settings2, 
  CheckCircle2, 
  Loader2,
  PhoneCall,
  MessageSquare,
  Shield,
  Wallet,
  RefreshCw,
  Plus,
  Clock,
  Copy,
  Mic,
  MapPin,
  History,
  Zap,
  DollarSign,
  TrendingUp,
  Volume2,
  Play,
  Pause,
  Square,
  AlertTriangle,
  User
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
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
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function PhoneSystem() {
  const { toast } = useToast();

  // WebSocket handler for real-time call log updates
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'NEW_CALL_LOG' || message.type === 'CALL_LOG_UPDATED') {
      // Refetch call logs when a new call is logged or updated
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet'] });
    }
  }, []);

  useWebSocket(handleWebSocketMessage);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showBuyNumber, setShowBuyNumber] = useState(false);
  const [showE911Dialog, setShowE911Dialog] = useState(false);
  const [selectedNumberForE911, setSelectedNumberForE911] = useState<{ phoneNumber: string; phoneNumberId: string } | null>(null);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("50");
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [autoRechargeThreshold, setAutoRechargeThreshold] = useState<string>("10");
  const [autoRechargeAmount, setAutoRechargeAmount] = useState<string>("50");
  const [activeTab, setActiveTab] = useState("overview");
  const isInitialLoadRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef({ enabled: false, threshold: "10", amount: "50" });
  const [showRecordingConfirm, setShowRecordingConfirm] = useState(false);
  const [showCnamConfirm, setShowCnamConfirm] = useState(false);

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

  useEffect(() => {
    if (walletData?.wallet) {
      const enabled = walletData.wallet.autoRecharge || false;
      const threshold = String(parseFloat(walletData.wallet.autoRechargeThreshold || "10"));
      const amount = String(parseFloat(walletData.wallet.autoRechargeAmount || "50"));
      setAutoRechargeEnabled(enabled);
      setAutoRechargeThreshold(threshold);
      setAutoRechargeAmount(amount);
      lastSavedStateRef.current = { enabled, threshold, amount };
      setTimeout(() => { isInitialLoadRef.current = false; }, 100);
    }
  }, [walletData]);

  const handleAutoRechargeToggle = (enabled: boolean) => {
    setAutoRechargeEnabled(enabled);
    if (isInitialLoadRef.current) return;
    const thresholdNum = parseFloat(autoRechargeThreshold) || 10;
    const amountNum = parseFloat(autoRechargeAmount) || 50;
    autoRechargeMutation.mutate({ enabled, threshold: thresholdNum, amount: amountNum });
  };

  useEffect(() => {
    if (isInitialLoadRef.current || !autoRechargeEnabled) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const thresholdNum = parseFloat(autoRechargeThreshold);
      const amountNum = parseFloat(autoRechargeAmount);
      if (isNaN(thresholdNum) || thresholdNum < 5 || thresholdNum > 100) return;
      if (isNaN(amountNum) || amountNum < 10 || amountNum > 500) return;
      const last = lastSavedStateRef.current;
      if (last.threshold === autoRechargeThreshold && last.amount === autoRechargeAmount) return;
      autoRechargeMutation.mutate({ enabled: autoRechargeEnabled, threshold: thresholdNum, amount: amountNum });
    }, 800);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [autoRechargeThreshold, autoRechargeAmount]);

  const { data: callLogsData, isLoading: isLoadingCallLogs } = useQuery<{
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

  const { data: noiseSuppressionData, refetch: refetchNoiseSuppression } = useQuery<{
    enabled: boolean;
    direction: 'inbound' | 'outbound' | 'both';
  }>({
    queryKey: ["/api/telnyx/noise-suppression"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  const { data: billingFeaturesData, refetch: refetchBillingFeatures } = useQuery<{
    recordingEnabled: boolean;
    cnamEnabled: boolean;
  }>({
    queryKey: ["/api/telnyx/billing-features"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      setIsSettingUp(true);
      return await apiRequest("POST", "/api/telnyx/managed-accounts/setup");
    },
    onSuccess: (data) => {
      setIsSettingUp(false);
      if (data.success) {
        toast({ title: "Phone System Activated", description: "Your phone system is ready." });
        queryClient.invalidateQueries({ queryKey: ["/api/telnyx/managed-accounts/status"] });
        refetch();
      } else {
        toast({ title: "Setup Failed", description: data.error, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      setIsSettingUp(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const topUpMutation = useMutation({
    mutationFn: async (amount: number) => apiRequest("POST", "/api/wallet/top-up", { amount }),
    onSuccess: (data: { success: boolean; newBalance: string; amount: number }) => {
      setShowAddFunds(false);
      setTopUpAmount("50");
      toast({
        title: "Funds Added",
        description: `$${data.amount.toFixed(2)} added. New balance: $${parseFloat(data.newBalance).toFixed(2)}`,
      });
      refetchWallet();
    },
    onError: (error: Error) => {
      toast({ title: "Top-Up Failed", description: error.message, variant: "destructive" });
    },
  });

  const autoRechargeMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; threshold: number; amount: number }) => {
      return await apiRequest("POST", "/api/wallet/auto-recharge", data);
    },
    onSuccess: (_, variables) => {
      lastSavedStateRef.current = { enabled: variables.enabled, threshold: String(variables.threshold), amount: String(variables.amount) };
      toast({
        title: variables.enabled ? "Auto-Recharge Enabled" : "Auto-Recharge Disabled",
        description: variables.enabled ? `Will add $${variables.amount} when balance falls below $${variables.threshold}` : "Auto-recharge turned off",
      });
      refetchWallet();
    },
    onError: (error: Error) => {
      if (walletData?.wallet) setAutoRechargeEnabled(walletData.wallet.autoRecharge || false);
      toast({ title: "Failed to Update", description: error.message, variant: "destructive" });
    },
  });

  const noiseSuppressionMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; direction: string }) => {
      return await apiRequest("POST", "/api/telnyx/noise-suppression", data);
    },
    onSuccess: (response: { success: boolean; enabled: boolean; direction: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/noise-suppression"] });
      refetchNoiseSuppression();
      toast({
        title: response.enabled ? "Noise Suppression Enabled" : "Noise Suppression Disabled",
        description: response.enabled ? `Active on ${response.direction} calls` : "Noise suppression turned off",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Update", description: error.message, variant: "destructive" });
    },
  });

  const billingFeaturesMutation = useMutation({
    mutationFn: async (data: { recordingEnabled?: boolean; cnamEnabled?: boolean }) => {
      return await apiRequest("POST", "/api/telnyx/billing-features", data);
    },
    onSuccess: (response: { success: boolean; recordingEnabled: boolean; cnamEnabled: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/billing-features"] });
      refetchBillingFeatures();
      toast({
        title: "Billing Features Updated",
        description: "Your billing feature settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Update", description: error.message, variant: "destructive" });
    },
  });

  // Synced mutation that updates both billing features AND Telnyx call recording for all numbers
  const syncedRecordingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // Update billing features first
      const billingResult = await apiRequest("POST", "/api/telnyx/billing-features", { recordingEnabled: enabled });
      
      // Then update Telnyx call recording for each phone number
      const numbers = numbersData?.numbers || [];
      const recordingPromises = numbers
        .filter(n => n.id)
        .map(n => apiRequest("POST", `/api/telnyx/call-recording/${n.id}`, { enabled }));
      
      await Promise.allSettled(recordingPromises);
      
      return billingResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/billing-features"] });
      refetchBillingFeatures();
      // Also invalidate voice settings for all numbers
      numbersData?.numbers?.forEach(n => {
        if (n.id) {
          queryClient.invalidateQueries({ queryKey: ["/api/telnyx/voice-settings", n.id] });
        }
      });
      toast({
        title: "Call Recording Updated",
        description: "Recording settings synchronized across all numbers.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Update", description: error.message, variant: "destructive" });
    },
  });

  const handleRecordingToggle = (enabled: boolean) => {
    if (enabled) {
      setShowRecordingConfirm(true);
    } else {
      syncedRecordingMutation.mutate(false);
    }
  };

  const handleCnamToggle = (enabled: boolean) => {
    if (enabled) {
      setShowCnamConfirm(true);
    } else {
      billingFeaturesMutation.mutate({ cnamEnabled: false });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  if (isLoadingStatus) {
    return <LoadingSpinner fullScreen message="Loading phone system..." />;
  }

  const hasAccount = statusData?.configured || statusData?.hasAccount;
  const accountDetails = statusData?.accountDetails;
  const accountId = statusData?.managedAccountId;
  const walletBalance = walletData?.wallet?.balance || "0";
  const walletCurrency = walletData?.wallet?.currency || "USD";
  const numbersCount = numbersData?.numbers?.length || 0;
  const hasE911Issues = numbersData?.numbers?.some(n => !n.emergency_enabled) || numbersCount === 0;

  const formatCurrency = (amount: string, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parseFloat(amount || "0"));
  };

  if (!hasAccount) {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-foreground">Phone System</h1>
          <p className="text-slate-500 dark:text-muted-foreground mt-1">Professional business phone lines</p>
        </div>
        <div className="flex-1 flex items-center justify-center py-16">
          <Card className="max-w-xl w-full border-0 shadow-xl rounded-2xl">
            <CardHeader className="text-center pb-4 pt-10">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                <Phone className="h-8 w-8 text-indigo-600" />
              </div>
              <CardTitle className="text-xl font-semibold">Activate Your Phone System</CardTitle>
              <CardDescription className="text-base mt-2">Get started with professional business calling</CardDescription>
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
                {isSettingUp ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Activating...</> : <><Zap className="h-5 w-5 mr-2" />Activate Now</>}
              </Button>
              <p className="text-xs text-slate-400 text-center">Ready in seconds. No additional setup required.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-border bg-white dark:bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-foreground" data-testid="text-page-title">Phone System</h1>
            <p className="text-sm text-slate-500 dark:text-muted-foreground">Manage your business phone lines</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowBuyNumber(true)} data-testid="button-buy-number">
              <Plus className="h-4 w-4 mr-1" />
              Buy Number
            </Button>
            <div 
              className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              onClick={() => setShowAddFunds(true)}
              data-testid="button-add-funds"
            >
              <Wallet className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-xs text-slate-500">Balance</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white" data-testid="text-balance">{formatCurrency(walletBalance, walletCurrency)}</p>
              </div>
              <Plus className="h-3 w-3 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b border-slate-200 dark:border-border bg-white dark:bg-card px-6">
            <TabsList className="bg-transparent h-12 p-0 gap-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-lg px-4">
                <TrendingUp className="h-4 w-4 mr-2" />Overview
              </TabsTrigger>
              <TabsTrigger value="numbers" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-lg px-4">
                <Phone className="h-4 w-4 mr-2" />Numbers
              </TabsTrigger>
              <TabsTrigger value="calls" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-lg px-4">
                <History className="h-4 w-4 mr-2" />Call History
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800 rounded-lg px-4">
                <Settings2 className="h-4 w-4 mr-2" />Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="p-6 m-0">
            <div className="grid gap-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 dark:border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{numbersCount}</p>
                        <p className="text-xs text-slate-500">Phone Numbers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{formatCurrency(walletBalance)}</p>
                        <p className="text-xs text-slate-500">Wallet Balance</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <PhoneCall className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{callLogsData?.logs?.length || 0}</p>
                        <p className="text-xs text-slate-500">Total Calls</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className={`border-slate-200 dark:border-border ${hasE911Issues ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                  <CardContent className="p-4">
                    <div 
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        if (numbersData?.numbers?.[0]) {
                          setSelectedNumberForE911({ phoneNumber: numbersData.numbers[0].phone_number, phoneNumberId: numbersData.numbers[0].id || "" });
                          setShowE911Dialog(true);
                        }
                      }}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${hasE911Issues ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                        <MapPin className={`h-5 w-5 ${hasE911Issues ? 'text-amber-600' : 'text-emerald-600'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-foreground">E911 Status</p>
                        <p className={`text-xs ${hasE911Issues ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {hasE911Issues ? 'Action Required' : 'Configured'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card className="border-slate-200 dark:border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Recent Calls</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("calls")}>View All</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingCallLogs ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                  ) : !callLogsData?.logs?.length ? (
                    <div className="text-center py-8 text-slate-400">
                      <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No calls yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {callLogsData.logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${log.direction === 'inbound' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                              {log.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4 text-blue-600" /> : <PhoneOutgoing className="h-4 w-4 text-green-600" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-foreground">
                                {formatPhoneDisplay(log.direction === 'inbound' ? log.fromNumber : log.toNumber)}
                              </p>
                              <p className="text-xs text-slate-400">{format(new Date(log.startedAt), "MMM dd, h:mm a")}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {log.duration > 0 && <p className="text-sm text-slate-600 dark:text-slate-300">{Math.floor(log.duration / 60)}:{(log.duration % 60).toString().padStart(2, '0')}</p>}
                            <Badge variant="outline" className={`text-xs ${log.status === 'answered' ? 'text-green-600 border-green-200' : 'text-slate-500'}`}>
                              {log.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Numbers Tab */}
          <TabsContent value="numbers" className="p-6 m-0">
            <div className="space-y-4">
              {isLoadingNumbers ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
              ) : !numbersData?.numbers?.length ? (
                <Card className="border-dashed border-2 border-slate-300 dark:border-slate-600">
                  <CardContent className="py-12 text-center">
                    <Phone className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-700 dark:text-foreground mb-2">No Phone Numbers</h3>
                    <p className="text-sm text-slate-500 mb-4">Purchase a phone number to start making and receiving calls.</p>
                    <Button onClick={() => setShowBuyNumber(true)} data-testid="button-add-first-number">
                      <Plus className="h-4 w-4 mr-2" />Get a Number
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                numbersData.numbers.map((number, idx) => (
                  <PhoneNumberCard 
                    key={number.id || idx} 
                    number={number} 
                    onConfigureE911={() => {
                      setSelectedNumberForE911({ phoneNumber: number.phone_number, phoneNumberId: number.id || "" });
                      setShowE911Dialog(true);
                    }}
                  />
                ))
              )}
            </div>
          </TabsContent>

          {/* Call History Tab */}
          <TabsContent value="calls" className="p-6 m-0">
            <Card className="border-slate-200 dark:border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />Call History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingCallLogs ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : !callLogsData?.logs?.length ? (
                  <div className="text-center py-12 text-slate-400">
                    <Phone className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No calls yet</p>
                    <p className="text-sm mt-1">Your call history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {callLogsData.logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50 hover:bg-slate-100 dark:hover:bg-muted transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded-full ${log.direction === 'inbound' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                            {log.direction === 'inbound' ? <PhoneIncoming className="h-5 w-5 text-blue-600" /> : <PhoneOutgoing className="h-5 w-5 text-green-600" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-800 dark:text-foreground">
                                {formatPhoneDisplay(log.direction === 'inbound' ? log.fromNumber : log.toNumber)}
                              </p>
                              {log.callerName && <span className="text-sm text-slate-500">({log.callerName})</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <span>{format(new Date(log.startedAt), "MMM dd, yyyy 'at' h:mm a")}</span>
                              <span className="text-slate-300">|</span>
                              <span className={log.status === 'answered' ? 'text-green-600' : log.status === 'failed' ? 'text-red-500' : 'text-amber-600'}>
                                {log.status}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          {log.duration > 0 && (
                            <div className="text-center min-w-[50px]">
                              <p className="font-medium text-slate-700 dark:text-foreground">{Math.floor(log.duration / 60)}:{(log.duration % 60).toString().padStart(2, '0')}</p>
                              <p className="text-xs text-slate-400">duration</p>
                            </div>
                          )}
                          {log.cost && parseFloat(log.cost) > 0 && (
                            <div className="text-center min-w-[60px]">
                              <p className="font-medium text-amber-600">${parseFloat(log.cost).toFixed(4)}</p>
                              <p className="text-xs text-slate-400">cost</p>
                            </div>
                          )}
                          {log.recordingUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950"
                              onClick={() => {
                                const audio = document.getElementById(`audio-${log.id}`) as HTMLAudioElement;
                                if (audio) {
                                  if (audio.paused) {
                                    document.querySelectorAll('audio').forEach(a => a.pause());
                                    audio.play();
                                  } else {
                                    audio.pause();
                                  }
                                }
                              }}
                              data-testid={`button-play-recording-${log.id}`}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Listen
                            </Button>
                          )}
                        </div>
                        {log.recordingUrl && (
                          <audio id={`audio-${log.id}`} src={log.recordingUrl} className="hidden" preload="none" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="p-6 m-0">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Wallet & Billing - Primary Card */}
              <Card className="border-slate-200 dark:border-border lg:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-green-600" />Wallet Balance
                      </CardTitle>
                      <CardDescription>Your prepaid balance for calls and messaging</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(walletBalance)}</p>
                      <p className="text-xs text-slate-500">Available</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Button onClick={() => setShowAddFunds(true)} className="h-12" data-testid="button-add-funds">
                      <Plus className="h-4 w-4 mr-2" />Add Funds
                    </Button>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="font-medium text-sm text-slate-700 dark:text-foreground">Auto-Recharge</p>
                        <p className="text-xs text-slate-500">Add funds when balance is low</p>
                      </div>
                      <Switch checked={autoRechargeEnabled} onCheckedChange={handleAutoRechargeToggle} data-testid="switch-auto-recharge" />
                    </div>
                  </div>
                  {autoRechargeEnabled && (
                    <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div>
                        <Label className="text-xs">Threshold</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <Input type="number" min="5" max="100" value={autoRechargeThreshold} onChange={(e) => setAutoRechargeThreshold(e.target.value)} className="pl-7" data-testid="input-auto-recharge-threshold" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Recharge Amount</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <Input type="number" min="10" max="500" value={autoRechargeAmount} onChange={(e) => setAutoRechargeAmount(e.target.value)} className="pl-7" data-testid="input-auto-recharge-amount" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Call Rates Card */}
              <Card className="border-slate-200 dark:border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4" />Call Rates
                  </CardTitle>
                  <CardDescription>Per-minute rates by destination</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-muted/50">
                      <span className="text-slate-600 dark:text-slate-400">USA / Canada</span>
                      <span className="font-medium">$0.02/min</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-muted/50">
                      <span className="text-slate-600 dark:text-slate-400">Mexico (Landline)</span>
                      <span className="font-medium">$0.035/min</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-muted/50">
                      <span className="text-slate-600 dark:text-slate-400">Mexico (Mobile)</span>
                      <span className="font-medium">$0.045/min</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-muted/50">
                      <span className="text-slate-600 dark:text-slate-400">Toll-Free (1800/1888)</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-muted/50">
                      <span className="text-slate-600 dark:text-slate-400">UK / Germany / France</span>
                      <span className="font-medium">$0.015-0.02/min</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Features Card */}
              <Card className="border-slate-200 dark:border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />Billing Features
                  </CardTitle>
                  <CardDescription>Enable paid features for enhanced call functionality</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Mic className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="font-medium text-sm text-slate-700 dark:text-foreground">Call Recording</p>
                        <p className="text-xs text-slate-500">Record all calls for quality assurance</p>
                        <Badge variant="outline" className="mt-1 text-xs text-amber-600 border-amber-300">$0.005/min</Badge>
                      </div>
                    </div>
                    <Switch
                      checked={billingFeaturesData?.recordingEnabled || false}
                      onCheckedChange={handleRecordingToggle}
                      disabled={billingFeaturesMutation.isPending || syncedRecordingMutation.isPending}
                      data-testid="switch-call-recording"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm text-slate-700 dark:text-foreground">CNAM (Caller ID Name)</p>
                        <p className="text-xs text-slate-500">Display caller names for incoming calls</p>
                        <Badge variant="outline" className="mt-1 text-xs text-amber-600 border-amber-300">$1.00/month + $0.01 per inbound call</Badge>
                      </div>
                    </div>
                    <Switch
                      checked={billingFeaturesData?.cnamEnabled || false}
                      onCheckedChange={handleCnamToggle}
                      disabled={billingFeaturesMutation.isPending}
                      data-testid="switch-cnam"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Audio Settings Card */}
              <Card className="border-slate-200 dark:border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />Audio Settings
                  </CardTitle>
                  <CardDescription>Configure call audio quality</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Mic className="h-4 w-4 text-indigo-600" />
                      <div>
                        <p className="font-medium text-sm text-slate-700 dark:text-foreground">Noise Suppression</p>
                        <p className="text-xs text-slate-500">Reduces background noise</p>
                      </div>
                    </div>
                    <Switch
                      checked={noiseSuppressionData?.enabled || false}
                      onCheckedChange={(checked) => noiseSuppressionMutation.mutate({ enabled: checked, direction: noiseSuppressionData?.direction || 'outbound' })}
                      disabled={noiseSuppressionMutation.isPending}
                      data-testid="switch-noise-suppression"
                    />
                  </div>
                  {noiseSuppressionData?.enabled && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Label className="text-sm">Direction</Label>
                      <Select
                        value={noiseSuppressionData?.direction || 'outbound'}
                        onValueChange={(value: 'inbound' | 'outbound' | 'both') => noiseSuppressionMutation.mutate({ enabled: true, direction: value })}
                      >
                        <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <BuyNumbersDialog open={showBuyNumber} onOpenChange={setShowBuyNumber} onNumberPurchased={() => refetchNumbers()} />
      
      {selectedNumberForE911 && (
        <E911ConfigDialog
          open={showE911Dialog}
          onOpenChange={setShowE911Dialog}
          phoneNumber={selectedNumberForE911.phoneNumber}
          phoneNumberId={selectedNumberForE911.phoneNumberId}
          onSuccess={() => { refetchNumbers(); setSelectedNumberForE911(null); }}
        />
      )}

      {/* Add Funds Dialog */}
      <Dialog open={showAddFunds} onOpenChange={(open) => { setShowAddFunds(open); if (!open) setShowCustomAmount(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>Add funds to your wallet using your saved payment method.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant={!showCustomAmount && topUpAmount === String(amt) ? "default" : "outline"}
                  onClick={() => { setTopUpAmount(String(amt)); setShowCustomAmount(false); }}
                  className="h-12"
                >
                  ${amt}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setShowCustomAmount(true); setTopUpAmount(""); }}>
              Custom Amount
            </Button>
            {showCustomAmount && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                <Input type="number" min="5" max="500" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="pl-8 h-12 text-lg" placeholder="Enter amount" autoFocus />
                <p className="text-xs text-slate-500 mt-1">Min $5, Max $500</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFunds(false)} disabled={topUpMutation.isPending}>Cancel</Button>
            <Button onClick={() => { const amt = parseFloat(topUpAmount); if (amt >= 5 && amt <= 500) topUpMutation.mutate(amt); }} disabled={topUpMutation.isPending || !topUpAmount || parseFloat(topUpAmount) < 5}>
              {topUpMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</> : `Add $${topUpAmount || '0'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Recording Confirmation Dialog */}
      <AlertDialog open={showRecordingConfirm} onOpenChange={setShowRecordingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Enable Call Recording
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Call Recording is a paid feature that will add <span className="font-semibold text-foreground">$0.005 per minute</span> to your call costs.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>Example:</strong> A 10-minute call would cost an additional $0.05 for recording.
                </p>
              </div>
              <p className="text-sm">
                You can disable this feature at any time. Charges will only apply to calls made while recording is enabled.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-recording">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                syncedRecordingMutation.mutate(true);
                setShowRecordingConfirm(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-confirm-recording"
            >
              Enable Recording
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CNAM Confirmation Dialog */}
      <AlertDialog open={showCnamConfirm} onOpenChange={setShowCnamConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Enable CNAM (Caller ID Name)
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                CNAM is a paid feature with the following costs:
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2 text-sm">
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>Monthly fee:</strong> $1.00/month
                </p>
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>Per-call fee:</strong> $0.01 per inbound call
                </p>
              </div>
              <p className="text-sm">
                This feature displays the caller's name on incoming calls. You can disable this feature at any time.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cnam">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                billingFeaturesMutation.mutate({ cnamEnabled: true });
                setShowCnamConfirm(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-confirm-cnam"
            >
              Enable CNAM
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* Phone Number Card Component */
interface PhoneNumberCardProps {
  number: NumberInfo;
  onConfigureE911?: () => void;
}

function PhoneNumberCard({ number, onConfigureE911 }: PhoneNumberCardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("voice");

  const voiceSettingsQuery = useQuery<{
    success: boolean;
    cnamListing?: { enabled: boolean; details: string };
    callRecording?: { inboundEnabled: boolean; format: string; channels: string };
    inboundCallScreening?: string;
    callerIdNameEnabled?: boolean;
    callForwarding?: { enabled: boolean; destination: string; keepCallerId: boolean };
  }>({
    queryKey: ["/api/telnyx/voice-settings", number.id],
    queryFn: async () => {
      const res = await fetch(`/api/telnyx/voice-settings/${number.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!number.id,
  });

  const cnamMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; cnamName?: string }) => apiRequest("POST", `/api/telnyx/cnam/${number.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/voice-settings", number.id] });
      toast({ title: "CNAM Updated", description: "Changes may take 12-72 hours to propagate." });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "Update Failed", description: error.message }),
  });

  const callRecordingMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; format?: string; channels?: string }) => {
      // Update Telnyx call recording for this phone number
      const telnyxResult = await apiRequest("POST", `/api/telnyx/call-recording/${number.id}`, data);
      
      // Also update billing features to stay in sync
      await apiRequest("POST", "/api/telnyx/billing-features", { recordingEnabled: data.enabled });
      
      return telnyxResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/voice-settings", number.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/billing-features"] });
      toast({ title: variables.enabled ? "Call Recording Enabled" : "Call Recording Disabled" });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "Update Failed", description: error.message }),
  });

  const callScreeningMutation = useMutation({
    mutationFn: async (data: { mode: string }) => apiRequest("POST", `/api/telnyx/spam-protection/${number.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/voice-settings", number.id] });
      toast({ title: "Call Screening Updated" });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "Update Failed", description: error.message }),
  });

  const cnamLookupMutation = useMutation({
    mutationFn: async (enabled: boolean) => apiRequest("POST", `/api/telnyx/caller-id-lookup/${number.id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/voice-settings", number.id] });
      toast({ title: "Caller ID Lookup Updated" });
    },
    onError: (error: any) => toast({ variant: "destructive", title: "Update Failed", description: error.message }),
  });

  const settings = voiceSettingsQuery.data;
  const isLoading = voiceSettingsQuery.isLoading;

  return (
    <Card className="border-slate-200 dark:border-border overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
              <Phone className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-foreground">{formatPhoneDisplay(number.phone_number)}</p>
              <p className="text-sm text-slate-500">{number.phone_number_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Local'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={number.status === 'active' ? 'default' : 'secondary'} className={number.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : ''}>
              {number.status === 'active' ? 'Active' : number.status}
            </Badge>
            {!number.emergency_enabled && onConfigureE911 && (
              <Button variant="outline" size="sm" onClick={onConfigureE911} className="text-amber-600 border-amber-300 hover:bg-amber-50">
                <MapPin className="h-3 w-3 mr-1" />E911
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6 border-b border-slate-100 dark:border-border">
          <TabsList className="bg-transparent h-10 p-0 gap-4">
            <TabsTrigger value="voice" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 pb-2 text-sm">
              Voice Settings
            </TabsTrigger>
            <TabsTrigger value="caller-id" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-0 pb-2 text-sm">
              Caller ID
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="voice" className="p-6 m-0">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
                <div>
                  <p className="font-medium text-slate-700 dark:text-foreground">Call Recording</p>
                  <p className="text-sm text-slate-500">Record all calls (inbound & outbound)</p>
                </div>
                <Switch
                  checked={settings?.callRecording?.inboundEnabled || (settings?.callRecording as any)?.outboundEnabled || false}
                  onCheckedChange={(checked) => callRecordingMutation.mutate({ enabled: checked })}
                  disabled={callRecordingMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
                <div>
                  <p className="font-medium text-slate-700 dark:text-foreground">Spam Call Screening</p>
                  <p className="text-sm text-slate-500">Block suspected spam calls</p>
                </div>
                <Switch
                  checked={settings?.inboundCallScreening !== 'disabled' && !!settings?.inboundCallScreening}
                  onCheckedChange={(checked) => callScreeningMutation.mutate({ mode: checked ? 'reject_calls' : 'disabled' })}
                  disabled={callScreeningMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
                <div>
                  <p className="font-medium text-slate-700 dark:text-foreground">Caller ID Lookup</p>
                  <p className="text-sm text-slate-500">Show caller names ($0.40/mo)</p>
                </div>
                <Switch
                  checked={settings?.callerIdNameEnabled || false}
                  onCheckedChange={(checked) => cnamLookupMutation.mutate(checked)}
                  disabled={cnamLookupMutation.isPending}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="caller-id" className="p-6 m-0">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-muted/50">
                <div>
                  <p className="font-medium text-slate-700 dark:text-foreground">CNAM Listing</p>
                  <p className="text-sm text-slate-500">Display your business name on outgoing calls</p>
                </div>
                <Switch
                  checked={settings?.cnamListing?.enabled || false}
                  onCheckedChange={(checked) => cnamMutation.mutate({ enabled: checked, cnamName: settings?.cnamListing?.details })}
                  disabled={cnamMutation.isPending}
                />
              </div>
              {settings?.cnamListing?.enabled && (
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Label className="text-sm">Business Name (max 15 chars)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      maxLength={15}
                      defaultValue={settings?.cnamListing?.details || ''}
                      placeholder="Your Business"
                      onBlur={(e) => cnamMutation.mutate({ enabled: true, cnamName: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Changes take 12-72 hours to propagate to all carriers.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
