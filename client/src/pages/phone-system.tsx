import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ComplianceTab } from "@/components/compliance-tab";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  User,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Search,
  ChevronRight,
  Hash,
  Eye,
  EyeOff,
  Monitor
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, subDays, startOfDay, isSameDay } from "date-fns";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend } from "recharts";
import { useWebSocket } from "@/hooks/use-websocket";
import { BuyNumbersDialog } from "@/components/WebPhoneFloatingWindow";
import { E911ConfigDialog } from "@/components/E911ConfigDialog";
import { PbxSettings } from "@/components/pbx-settings";

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
  ownerUserId?: string | null;
  ownerUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    avatar?: string | null;
  } | null;
  phoneNumber: string;
  connectionName?: string;
  status: string;
  numberType?: string;
  createdAt?: string;
  id?: string;
  e911Enabled?: boolean;
  e911AddressId?: string;
  telnyxPhoneNumberId?: string;
  callerIdName?: string;
  cnamEnabled?: boolean;
  recordingEnabled?: boolean;
  cnamLookupEnabled?: boolean;
  noiseSuppressionEnabled?: boolean;
  noiseSuppressionDirection?: string;
  voicemailEnabled?: boolean;
  voicemailPin?: string;
  ivrId?: string | null;
  e911StreetAddress?: string | null;
  e911ExtendedAddress?: string | null;
  e911Locality?: string | null;
  e911AdminArea?: string | null;
  e911PostalCode?: string | null;
}

interface PbxIvr {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  extension: string;
  language: string;
  isDefault: boolean;
  isActive: boolean;
}

function formatPhoneDisplay(phone: string | undefined | null): string {
  if (!phone) return "";
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
  
  // Access control - check if user has access to Phone System
  const { data: accessData, isLoading: isLoadingAccess } = useQuery<{ 
    hasAccess: boolean; 
    isOwner: boolean; 
    reason: string; 
  }>({
    queryKey: ['/api/telnyx/phone-system-access'],
  });

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
  const [selectedNumber, setSelectedNumber] = useState<NumberInfo | null>(null);
  const [editingCnam, setEditingCnam] = useState(false);
  const [cnamInput, setCnamInput] = useState("");
  const [voicemailPinInput, setVoicemailPinInput] = useState("");
  const [showDeskPhoneCredentials, setShowDeskPhoneCredentials] = useState(false);
  const [deskPhoneCredentials, setDeskPhoneCredentials] = useState<{ sipUsername: string; sipPassword: string; loading: boolean } | null>(null);

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

  const { data: ivrs = [] } = useQuery<PbxIvr[]>({
    queryKey: ["/api/pbx/ivrs"],
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

  // Auto-select first number when data loads, and sync selectedNumber with fresh data
  useEffect(() => {
    if (numbersData?.numbers?.length) {
      const currentId = selectedNumber?.phoneNumber;
      const updatedNumber = currentId ? numbersData.numbers.find(n => n.phoneNumber === currentId) : null;
      
      if (updatedNumber) {
        // Sync selectedNumber with fresh data from server
        setSelectedNumber(updatedNumber);
      } else if (!selectedNumber) {
        // No number selected, select first
        setSelectedNumber(numbersData.numbers[0]);
      }
    } else {
      setSelectedNumber(null);
    }
  }, [numbersData]);

  // Reset all number-specific states when selected number changes
  useEffect(() => {
    setVoicemailPinInput(selectedNumber?.voicemailPin || "");
    setShowDeskPhoneCredentials(false);
    setDeskPhoneCredentials(null);
    setEditingCnam(false);
    setCnamInput("");
  }, [selectedNumber?.phoneNumber]);

  // Sync voicemail PIN when it changes on the server
  useEffect(() => {
    if (selectedNumber?.voicemailPin) {
      setVoicemailPinInput(selectedNumber.voicemailPin);
    }
  }, [selectedNumber?.voicemailPin]);

  // Sort numbers: 1) IVR assigned, 2) User assigned, 3) Active, 4) Inactive/Pending port
  const sortedNumbers = useMemo(() => {
    if (!numbersData?.numbers) return [];
    
    return [...numbersData.numbers].sort((a, b) => {
      // Priority function: lower = higher priority
      const getPriority = (num: NumberInfo) => {
        // 1. IVR assigned (highest priority)
        if (num.ivrId && num.ivrId !== 'unassigned') return 1;
        // 2. User assigned (direct)
        if (num.ownerUserId) return 2;
        // 3. Active numbers
        if (num.status === 'active') return 3;
        // 4. Inactive and pending port (lowest priority)
        return 4;
      };
      
      return getPriority(a) - getPriority(b);
    });
  }, [numbersData?.numbers]);

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

  // Auto-sync recordings on page load (not just on Calls tab)
  useEffect(() => {
    console.log('[PhoneSystem] useEffect triggered, callLogsData:', callLogsData?.logs?.length || 0, 'logs');
    if (callLogsData?.logs) {
      const callsWithoutRecording = callLogsData.logs.filter(
        (log) => log.status === 'answered' && log.duration > 0 && !log.recordingUrl
      );
      console.log(`[PhoneSystem] Calls without recording: ${callsWithoutRecording.length}`);
      if (callsWithoutRecording.length > 0) {
        console.log(`[PhoneSystem] Found ${callsWithoutRecording.length} calls without recordings, syncing...`);
        fetch('/api/telnyx/sync-recordings', { method: 'POST', credentials: 'include' })
          .then(async (res) => {
            const data = await res.json();
            console.log('[PhoneSystem] Sync response:', data);
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
            }, 1000);
          })
          .catch(err => console.error('[PhoneSystem] Recording sync error:', err));
      }
    }
  }, [callLogsData]);

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

  // Query for company agents (for the user assignment dropdown)
  const { data: agentsData } = useQuery<{
    agents: Array<{
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      avatar?: string | null;
      role: string;
    }>;
  }>({
    queryKey: ["/api/company/agents"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });


  const { data: pricingData, isLoading: isLoadingPricing } = useQuery<{
    voice: {
      local: { outbound: number; inbound: number };
      tollfree: { outbound: number; inbound: number };
      recording: number;
      cnamLookup: number;
    };
    sms: {
      local: { outbound: number; inbound: number };
      tollfree: { outbound: number; inbound: number };
    };
    monthly: {
      localNumber: number;
      tollfreeNumber: number;
    };
    billing: {
      minimumSeconds: number;
      incrementSeconds: number;
    };
    lastUpdated: string;
  }>({
    queryKey: ["/api/telnyx/pricing"],
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

  const updateCnamMutation = useMutation({
    mutationFn: async ({ phoneNumberId, cnamName }: { phoneNumberId: string; cnamName: string }) => {
      return apiRequest("POST", `/api/telnyx/cnam/${phoneNumberId}`, { 
        enabled: true, 
        cnamName 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      refetchNumbers();
      toast({ title: "CNAM Updated", description: "Caller ID name updated. Changes may take 12-72 hours to propagate." });
      setEditingCnam(false);
      setCnamInput("");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Failed to update CNAM" });
    },
  });


  const assignNumberMutation = useMutation({
    mutationFn: async ({ phoneNumberId, userId }: { phoneNumberId: string; userId: string | null }) => {
      return apiRequest("POST", `/api/telnyx/assign-number/${phoneNumberId}`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      refetchNumbers();
      toast({ title: "Number Assigned", description: "Phone number assignment updated successfully." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Assignment Failed", description: error.message || "Failed to assign phone number" });
    },
  });

  const numberVoiceSettingsMutation = useMutation({
    mutationFn: async ({ phoneNumberId, settings }: { 
      phoneNumberId: string; 
      settings: { 
        recordingEnabled?: boolean; 
        cnamLookupEnabled?: boolean; 
        noiseSuppressionEnabled?: boolean;
        noiseSuppressionDirection?: string;
        voicemailEnabled?: boolean;
        voicemailPin?: string;
        ivrId?: string | null;
      } 
    }) => {
      return apiRequest("POST", `/api/telnyx/number-voice-settings/${phoneNumberId}`, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      refetchNumbers();
      toast({ title: "Voice Settings Updated", description: "Number voice settings saved successfully." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Update Failed", description: error.message || "Failed to update voice settings" });
    },
  });

  // Sync voice settings from Telnyx when a number is selected
  const syncVoiceSettingsMutation = useMutation({
    mutationFn: async (phoneNumberId: string) => {
      return apiRequest("POST", `/api/telnyx/sync-voice-settings/${phoneNumberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      refetchNumbers();
    },
  });

  // Auto-sync voice settings when selected number changes
  useEffect(() => {
    if (selectedNumber?.telnyxPhoneNumberId) {
      syncVoiceSettingsMutation.mutate(selectedNumber.telnyxPhoneNumberId);
    }
  }, [selectedNumber?.telnyxPhoneNumberId]);

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
  const walletBalance = parseFloat(walletData?.wallet?.balance || "0");
  const walletCurrency = walletData?.wallet?.currency || "USD";
  const numbersCount = numbersData?.numbers?.length || 0;
  const hasE911Issues = numbersData?.numbers?.some(n => !n.e911Enabled) || numbersCount === 0;

  const formatCurrency = (amount: string | number, currency: string = "USD") => {
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount || "0");
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numAmount);
  };

  if (!hasAccount) {
    return (
      <div className="flex flex-col galg:p-8">
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

  // Access control - show loading or access denied if needed
  if (isLoadingAccess) {
    return <LoadingSpinner fullScreen={true} />;
  }
  
  if (!accessData?.hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-500" />
              Access Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only the phone system administrator can access this page. 
              Contact your company administrator for telephony configuration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-slate-950 dark:via-gray-950 dark:to-slate-900">
      {/* GLOBAL STATUS BAR - Account Status at a glance */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Left: Status Indicators */}
          <div className="flex items-center gap-6">
            {/* Numbers Count */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/50 rounded-lg">
              <Phone className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{numbersCount} Number{numbersCount !== 1 ? 's' : ''}</span>
            </div>
            {/* E911 Status - Clickable when needs setup */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`flex items-center gap-2 ${hasE911Issues ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-1 -mx-2 -my-1 rounded-md transition-colors' : ''}`}
                    onClick={() => {
                      if (hasE911Issues) {
                        const numbersWithoutE911 = numbersData?.numbers?.filter(n => !n.e911Enabled) || [];
                        if (numbersWithoutE911.length === 1) {
                          setSelectedNumberForE911({ phoneNumber: numbersWithoutE911[0].phoneNumber, phoneNumberId: numbersWithoutE911[0].telnyxPhoneNumberId || numbersWithoutE911[0].id || "" });
                          setShowE911Dialog(true);
                        } else if (numbersWithoutE911.length > 1) {
                          setActiveTab("numbers");
                        }
                      }
                    }}
                    data-testid="status-e911"
                  >
                    <MapPin className={`h-4 w-4 ${hasE911Issues ? 'text-amber-500' : 'text-green-500'}`} />
                    <span className={`text-sm ${hasE911Issues ? 'text-amber-600 font-medium' : 'text-green-600'}`}>
                      E911: {hasE911Issues ? 'Needs Setup' : 'Ready'}
                    </span>
                    {hasE911Issues && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  {hasE911Issues ? (
                    <>
                      <p className="font-medium text-red-600">E911 Configuration Required</p>
                      <p className="text-xs text-slate-400 mt-1">FCC regulations require E911 for all VoIP numbers. Failure to configure can result in <span className="font-bold text-red-500">$100 fine per emergency call</span>.</p>
                      <p className="text-xs text-blue-500 mt-2">Click to configure now</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">E911 Emergency Services</p>
                      <p className="text-xs text-slate-400 mt-1">All your phone numbers have E911 configured for emergency services.</p>
                    </>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Right: Add Funds + Balance */}
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAddFunds(true)}
              className="shadow-sm hover:shadow-md transition-all border-slate-200 dark:border-slate-700"
              data-testid="button-add-funds-quick"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Funds
            </Button>
            <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50">
              <div className={`w-2.5 h-2.5 rounded-full ${walletBalance > 10 ? 'bg-green-500 shadow-green-500/50' : walletBalance > 0 ? 'bg-amber-500 shadow-amber-500/50' : 'bg-red-500 shadow-red-500/50'} shadow-lg`} />
              <span className="text-sm text-slate-500 dark:text-slate-400">Balance:</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(walletBalance)}</span>
              {walletBalance < 10 && <Badge variant="outline" className="text-xs font-medium text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">Low</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Tab Navigation */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800 px-6">
            <TabsList className="bg-transparent h-14 p-0 gap-1">
              <TabsTrigger value="overview" className="data-[state=active]:border-b-[3px] data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:font-semibold rounded-none px-5 py-4 text-sm font-medium bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                Overview
              </TabsTrigger>
              <TabsTrigger value="numbers" className="data-[state=active]:border-b-[3px] data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:font-semibold rounded-none px-5 py-4 text-sm font-medium bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                Numbers
              </TabsTrigger>
              <TabsTrigger value="calls" className="data-[state=active]:border-b-[3px] data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:font-semibold rounded-none px-5 py-4 text-sm font-medium bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                Calls
              </TabsTrigger>
              <TabsTrigger value="pricing" className="data-[state=active]:border-b-[3px] data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:font-semibold rounded-none px-5 py-4 text-sm font-medium bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                Pricing
              </TabsTrigger>
              <TabsTrigger value="pbx" className="data-[state=active]:border-b-[3px] data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:font-semibold rounded-none px-5 py-4 text-sm font-medium bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" data-testid="tab-pbx">
                PBX
              </TabsTrigger>
              <TabsTrigger value="compliance" className="data-[state=active]:border-b-[3px] data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:font-semibold rounded-none px-5 py-4 text-sm font-medium bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" data-testid="tab-compliance">
                Compliance
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab - Analytics Dashboard */}
          <TabsContent value="overview" className="flex-1 m-0 overflow-auto">
            <div className="p-6 space-y-6">
              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Total Calls */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-shadow border border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-800/20 rounded-xl">
                      <Phone className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-4xl font-bold text-slate-900 dark:text-white" data-testid="stat-total-calls">{callLogsData?.logs?.length || 0}</p>
                      <p className="text-sm font-medium text-slate-500 mt-1">Total Calls</p>
                    </div>
                  </div>
                </div>
                {/* Answer Rate */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-shadow border border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/20 rounded-xl">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-4xl font-bold text-slate-900 dark:text-white" data-testid="stat-answer-rate">
                        {callLogsData?.logs?.length ? Math.round((callLogsData.logs.filter(l => l.status === 'answered').length / callLogsData.logs.length) * 100) : 0}%
                      </p>
                      <p className="text-sm font-medium text-slate-500 mt-1">Answer Rate</p>
                    </div>
                  </div>
                </div>
                {/* Total Minutes */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-shadow border border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 rounded-xl">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-4xl font-bold text-slate-900 dark:text-white" data-testid="stat-total-minutes">
                        {callLogsData?.logs?.reduce((acc, l) => acc + (l.duration || 0), 0) ? Math.round(callLogsData.logs.reduce((acc, l) => acc + (l.duration || 0), 0) / 60) : 0}
                      </p>
                      <p className="text-sm font-medium text-slate-500 mt-1">Total Minutes</p>
                    </div>
                  </div>
                </div>
                {/* Total Spend */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-shadow border border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-800/20 rounded-xl">
                      <DollarSign className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-4xl font-bold text-slate-900 dark:text-white" data-testid="stat-total-spend">
                        ${callLogsData?.logs?.reduce((acc, l) => acc + parseFloat(l.cost || '0'), 0).toFixed(2) || '0.00'}
                      </p>
                      <p className="text-sm font-medium text-slate-500 mt-1">Total Spend</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Call Volume Chart - Last 7 Days */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Call Volume (Last 7 Days)</h3>
                  <div className="h-64">
                    {callLogsData?.logs?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={(() => {
                          const last7Days = Array.from({ length: 7 }, (_, i) => {
                            const date = subDays(new Date(), 6 - i);
                            const dayLogs = callLogsData.logs.filter(l => isSameDay(new Date(l.startedAt), date));
                            return {
                              day: format(date, 'EEE'),
                              inbound: dayLogs.filter(l => l.direction === 'inbound').length,
                              outbound: dayLogs.filter(l => l.direction === 'outbound').length,
                            };
                          });
                          return last7Days;
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                          <Legend />
                          <Bar dataKey="inbound" name="Inbound" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outbound" name="Outbound" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No call data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Call Distribution Pie */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Call Status</h3>
                  <div className="h-64">
                    {callLogsData?.logs?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={[
                              { name: 'Answered', value: callLogsData.logs.filter(l => l.status === 'answered').length, color: '#22c55e' },
                              { name: 'Missed', value: callLogsData.logs.filter(l => l.status === 'missed' || l.status === 'no-answer').length, color: '#ef4444' },
                              { name: 'Busy', value: callLogsData.logs.filter(l => l.status === 'busy').length, color: '#f59e0b' },
                              { name: 'Other', value: callLogsData.logs.filter(l => !['answered', 'missed', 'no-answer', 'busy'].includes(l.status)).length, color: '#94a3b8' },
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {[
                              { name: 'Answered', value: callLogsData.logs.filter(l => l.status === 'answered').length, color: '#22c55e' },
                              { name: 'Missed', value: callLogsData.logs.filter(l => l.status === 'missed' || l.status === 'no-answer').length, color: '#ef4444' },
                              { name: 'Busy', value: callLogsData.logs.filter(l => l.status === 'busy').length, color: '#f59e0b' },
                              { name: 'Other', value: callLogsData.logs.filter(l => !['answered', 'missed', 'no-answer', 'busy'].includes(l.status)).length, color: '#94a3b8' },
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No call data available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Call Direction Cards + Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inbound Card - Full width rectangular */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <PhoneIncoming className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Inbound Calls</p>
                        <p className="text-4xl font-bold text-slate-900 dark:text-white" data-testid="stat-inbound">
                          {callLogsData?.logs?.filter(l => l.direction === 'inbound').length || 0}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Duration</p>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                        {callLogsData?.logs?.filter(l => l.direction === 'inbound').reduce((acc, l) => acc + (l.duration || 0), 0) 
                          ? `${Math.round(callLogsData.logs.filter(l => l.direction === 'inbound').reduce((acc, l) => acc + (l.duration || 0), 0) / 60)} min` 
                          : '0 min'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Outbound Card - Full width rectangular */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                        <PhoneOutgoing className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Outbound Calls</p>
                        <p className="text-4xl font-bold text-slate-900 dark:text-white" data-testid="stat-outbound">
                          {callLogsData?.logs?.filter(l => l.direction === 'outbound').length || 0}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Duration</p>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                        {callLogsData?.logs?.filter(l => l.direction === 'outbound').reduce((acc, l) => acc + (l.duration || 0), 0) 
                          ? `${Math.round(callLogsData.logs.filter(l => l.direction === 'outbound').reduce((acc, l) => acc + (l.duration || 0), 0) / 60)} min` 
                          : '0 min'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Avg Call Duration</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="stat-avg-duration">
                          {(() => {
                            const answeredCalls = callLogsData?.logs?.filter(l => l.status === 'answered' && l.duration > 0) || [];
                            if (!answeredCalls.length) return '0:00';
                            const avgSec = Math.round(answeredCalls.reduce((acc, l) => acc + l.duration, 0) / answeredCalls.length);
                            return `${Math.floor(avgSec / 60)}:${(avgSec % 60).toString().padStart(2, '0')}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                        <Mic className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Calls with Recordings</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="stat-recordings">
                          {callLogsData?.logs?.filter(l => l.recordingUrl).length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Longest Call</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="stat-longest">
                          {(() => {
                            const maxDuration = Math.max(...(callLogsData?.logs?.map(l => l.duration || 0) || [0]));
                            if (!maxDuration) return '0:00';
                            return `${Math.floor(maxDuration / 60)}:${(maxDuration % 60).toString().padStart(2, '0')}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Numbers Tab - Split View */}
          <TabsContent value="numbers" className="flex-1 m-0 overflow-auto">
            {/* Global Connection Settings */}
            <div className="px-6 pt-4 pb-2">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-foreground">Noise Suppression</p>
                    <p className="text-sm text-slate-500">Reduce background noise on all calls</p>
                  </div>
                  <Switch
                    checked={noiseSuppressionData?.enabled || false}
                    onCheckedChange={(checked) => noiseSuppressionMutation.mutate({ 
                      enabled: checked, 
                      direction: noiseSuppressionData?.direction || 'outbound' 
                    })}
                    disabled={noiseSuppressionMutation.isPending}
                    data-testid="switch-noise-suppression"
                  />
                </div>
                {noiseSuppressionData?.enabled && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <Label className="text-xs text-slate-500 mb-2 block">Direction</Label>
                    <Select
                      value={noiseSuppressionData?.direction || "outbound"}
                      onValueChange={(value: "inbound" | "outbound" | "both") => {
                        noiseSuppressionMutation.mutate({ enabled: true, direction: value });
                      }}
                      disabled={noiseSuppressionMutation.isPending}
                    >
                      <SelectTrigger className="h-9 w-48" data-testid="select-noise-direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inbound">Inbound Only</SelectItem>
                        <SelectItem value="outbound">Outbound Only</SelectItem>
                        <SelectItem value="both">Both Directions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            {isLoadingNumbers ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : !numbersData?.numbers?.length ? (
              <div className="p-6">
                <div className="bg-white dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                  <Phone className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-foreground mb-2">No Phone Numbers</h3>
                  <p className="text-sm text-slate-500 mb-4">Purchase a phone number to start making and receiving calls.</p>
                  <Button onClick={() => setShowBuyNumber(true)} data-testid="button-add-first-number">
                    <Plus className="h-4 w-4 mr-2" />Get a Number
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-0 h-full">
                {/* Left Column: Numbers List */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 overflow-auto">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Phone Numbers</h2>
                        <p className="text-xs text-slate-400 mt-1">{numbersData.numbers.length} number{numbersData.numbers.length !== 1 ? 's' : ''}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowBuyNumber(true)}
                        className="h-8"
                        data-testid="button-buy-number"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Buy
                      </Button>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedNumbers.map((number, idx) => {
                      const hasE911 = number.e911AddressId || number.e911Enabled;
                      const isSelected = selectedNumber?.phoneNumber === number.phoneNumber;
                      const assignedUserName = number.ownerUser 
                        ? `${number.ownerUser.firstName || ''} ${number.ownerUser.lastName || ''}`.trim() || number.ownerUser.email
                        : null;
                      const assignedIvrName = number.ivrId && number.ivrId !== 'unassigned'
                        ? ivrs.find(i => i.id === number.ivrId)?.name
                        : null;
                      return (
                        <div
                          key={number.id || idx}
                          className={`px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-2 border-l-transparent'}`}
                          onClick={() => setSelectedNumber(number)}
                          data-testid={`number-item-${idx}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{formatPhoneDisplay(number.phoneNumber)}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className={`text-xs ${number.status === 'active' ? 'text-green-600 border-green-300' : 'text-slate-500'}`}>
                                  {number.status}
                                </Badge>
                                {assignedUserName && (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
                                    <User className="h-3 w-3 mr-1" />
                                    {assignedUserName}
                                  </Badge>
                                )}
                                {assignedIvrName && (
                                  <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-700">
                                    IVR: {assignedIvrName}
                                  </Badge>
                                )}
                                {!hasE911 && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">No E911</Badge>}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Number Details */}
                <div className="lg:col-span-2">
                  {selectedNumber ? (
                    <div className="space-y-6">
                      {/* Number Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{formatPhoneDisplay(selectedNumber.phoneNumber)}</h2>
                          <p className="text-sm text-slate-500 mt-1">
                            {selectedNumber.numberType === 'toll_free' ? 'Toll-Free' : 'Local'} Number
                          </p>
                        </div>
                        <Badge className={`${selectedNumber.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600'}`}>
                          {selectedNumber.status}
                        </Badge>
                      </div>

                      {/* Quick Info Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
                          <p className="font-medium text-slate-900 dark:text-white mt-1">{selectedNumber.numberType === 'toll_free' ? 'Toll-Free' : 'Local'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly Cost</p>
                          <p className="font-medium text-slate-900 dark:text-white mt-1">{selectedNumber.numberType === 'toll_free' ? '$1.50' : '$1.00'}/mo</p>
                        </div>
                      </div>

                      {/* E911 + Call Routing Row */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* E911 Section */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedNumber.e911AddressId || selectedNumber.e911Enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                              <MapPin className={`h-5 w-5 ${selectedNumber.e911AddressId || selectedNumber.e911Enabled ? 'text-green-600' : 'text-amber-600'}`} />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-700 dark:text-foreground">E911 Emergency Services</p>
                              <p className="text-xs text-slate-500">
                                {selectedNumber.e911AddressId || selectedNumber.e911Enabled ? 'Configured' : 'Not configured'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant={selectedNumber.e911AddressId || selectedNumber.e911Enabled ? "outline" : "default"}
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedNumberForE911({ phoneNumber: selectedNumber.phoneNumber, phoneNumberId: selectedNumber.telnyxPhoneNumberId || selectedNumber.id || "" });
                              setShowE911Dialog(true);
                            }}
                            data-testid="button-configure-e911"
                          >
                            {selectedNumber.e911AddressId || selectedNumber.e911Enabled ? 'Update' : 'Configure'}
                          </Button>
                          {selectedNumber.e911StreetAddress && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {selectedNumber.e911StreetAddress}
                                {selectedNumber.e911ExtendedAddress && `, ${selectedNumber.e911ExtendedAddress}`}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {selectedNumber.e911Locality}, {selectedNumber.e911AdminArea} {selectedNumber.e911PostalCode}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Call Routing Section - Combined User & IVR */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedNumber.ownerUserId || selectedNumber.ivrId ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
                              <PhoneIncoming className={`h-5 w-5 ${selectedNumber.ownerUserId || selectedNumber.ivrId ? 'text-blue-600' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-700 dark:text-foreground">Call Routing</p>
                              <p className="text-xs text-slate-500">
                                {selectedNumber.ownerUserId 
                                  ? `Direct to ${selectedNumber.ownerUser?.firstName || 'User'}` 
                                  : selectedNumber.ivrId && selectedNumber.ivrId !== 'unassigned'
                                    ? `IVR: ${ivrs.find(i => i.id === selectedNumber.ivrId)?.name || 'Selected'}`
                                    : 'Using default IVR'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {/* Assigned User */}
                            <div>
                              <Label className="text-xs text-slate-500 mb-1.5 block">Direct to User</Label>
                              <Select
                                value={selectedNumber.ownerUserId || "unassigned"}
                                onValueChange={(value) => {
                                  const userId = value === "unassigned" ? null : value;
                                  if (selectedNumber.telnyxPhoneNumberId) {
                                    assignNumberMutation.mutate({
                                      phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                      userId,
                                    });
                                    if (userId) {
                                      numberVoiceSettingsMutation.mutate({
                                        phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                        settings: { ivrId: "unassigned" }
                                      });
                                    }
                                  }
                                }}
                                disabled={assignNumberMutation.isPending}
                              >
                                <SelectTrigger className="w-full" data-testid="select-assigned-user">
                                  <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">No direct user</SelectItem>
                                  {agentsData?.agents?.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                      {agent.firstName && agent.lastName 
                                        ? `${agent.firstName} ${agent.lastName}` 
                                        : agent.email}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Entry IVR */}
                            <div>
                              <Label className="text-xs text-slate-500 mb-1.5 block">Entry IVR</Label>
                              <Select
                                value={selectedNumber.ivrId === null ? "default" : (selectedNumber.ivrId || "default")}
                                onValueChange={(value) => {
                                  const ivrId = value === "default" ? null : (value === "unassigned" ? "unassigned" : value);
                                  if (selectedNumber.telnyxPhoneNumberId) {
                                    numberVoiceSettingsMutation.mutate({
                                      phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                      settings: { ivrId }
                                    });
                                    if (value !== "unassigned" && selectedNumber.ownerUserId) {
                                      assignNumberMutation.mutate({
                                        phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                        userId: null,
                                      });
                                    }
                                  }
                                }}
                                disabled={numberVoiceSettingsMutation.isPending || !!selectedNumber.ownerUserId}
                              >
                                <SelectTrigger className={`w-full ${selectedNumber.ownerUserId ? 'opacity-50' : ''}`} data-testid="select-entry-ivr">
                                  <SelectValue placeholder="Select IVR" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default">Use Default IVR</SelectItem>
                                  <SelectItem value="unassigned">No IVR (Direct)</SelectItem>
                                  {ivrs.map((ivr) => (
                                    <SelectItem key={ivr.id} value={ivr.id}>
                                      {ivr.name} {ivr.isDefault && '(Default)'} - Ext. {ivr.extension}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedNumber.ownerUserId && (
                                <p className="text-xs text-slate-400 mt-1">IVR disabled when user is assigned</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desk Phone Credentials - Only show when user is assigned */}
                      {selectedNumber.ownerUserId && (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-50 dark:bg-purple-900/20">
                                <Monitor className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-slate-700 dark:text-foreground">Desk Phone Credentials</p>
                                <p className="text-xs text-slate-500">
                                  SIP credentials to configure a physical desk phone
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (showDeskPhoneCredentials) {
                                  setShowDeskPhoneCredentials(false);
                                  setDeskPhoneCredentials(null);
                                } else {
                                  setDeskPhoneCredentials({ sipUsername: '', sipPassword: '', loading: true });
                                  setShowDeskPhoneCredentials(true);
                                  try {
                                    const response = await fetch(`/api/telnyx/sip-credentials?userId=${selectedNumber.ownerUserId}`, { credentials: 'include' });
                                    const data = await response.json();
                                    if (data.username && data.password) {
                                      setDeskPhoneCredentials({ 
                                        sipUsername: data.username, 
                                        sipPassword: data.password, 
                                        loading: false 
                                      });
                                    } else {
                                      toast({ title: "No Credentials", description: "No SIP credentials found for this user." });
                                      setShowDeskPhoneCredentials(false);
                                      setDeskPhoneCredentials(null);
                                    }
                                  } catch (error) {
                                    toast({ title: "Error", description: "Failed to fetch SIP credentials." });
                                    setShowDeskPhoneCredentials(false);
                                    setDeskPhoneCredentials(null);
                                  }
                                }
                              }}
                              data-testid="button-show-sip-credentials"
                            >
                              {showDeskPhoneCredentials ? 'Hide' : 'Show Credentials'}
                            </Button>
                          </div>
                          {showDeskPhoneCredentials && deskPhoneCredentials && (
                            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                              {deskPhoneCredentials.loading ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-slate-500">SIP Server</Label>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">
                                          sip.telnyx.com
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => {
                                            navigator.clipboard.writeText('sip.telnyx.com');
                                            toast({ title: "Copied", description: "SIP Server copied to clipboard." });
                                          }}
                                          data-testid="button-copy-sip-server"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-slate-500">Username</Label>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono truncate max-w-[150px]">
                                          {deskPhoneCredentials.sipUsername}
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => {
                                            navigator.clipboard.writeText(deskPhoneCredentials.sipUsername);
                                            toast({ title: "Copied", description: "Username copied to clipboard." });
                                          }}
                                          data-testid="button-copy-sip-username"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs text-slate-500">Password</Label>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono">
                                          ••••••••
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => {
                                            navigator.clipboard.writeText(deskPhoneCredentials.sipPassword);
                                            toast({ title: "Copied", description: "Password copied to clipboard." });
                                          }}
                                          data-testid="button-copy-sip-password"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    Use these credentials to configure your desk phone or SIP client. Port: 5060 (UDP) or 5061 (TLS).
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Voice Settings - Per Number */}
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                          <p className="font-medium text-sm text-slate-700 dark:text-foreground">Voice Settings</p>
                          <p className="text-xs text-slate-500">Configuration for this number only</p>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-foreground">Inbound Call Recording</p>
                              <p className="text-xs text-slate-500">Record all incoming calls to this number</p>
                            </div>
                            <Switch
                              checked={selectedNumber.recordingEnabled || false}
                              onCheckedChange={(checked) => {
                                if (selectedNumber.telnyxPhoneNumberId) {
                                  numberVoiceSettingsMutation.mutate({
                                    phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                    settings: { recordingEnabled: checked }
                                  });
                                }
                              }}
                              disabled={numberVoiceSettingsMutation.isPending}
                              data-testid="switch-recording-number"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-foreground">CNAM Lookup</p>
                              <p className="text-xs text-slate-500">Show caller names on incoming</p>
                            </div>
                            <Switch
                              checked={selectedNumber.cnamLookupEnabled || false}
                              onCheckedChange={(checked) => {
                                if (selectedNumber.telnyxPhoneNumberId) {
                                  numberVoiceSettingsMutation.mutate({
                                    phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                    settings: { cnamLookupEnabled: checked }
                                  });
                                }
                              }}
                              disabled={numberVoiceSettingsMutation.isPending}
                              data-testid="switch-cnam-number"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-foreground">Voicemail</p>
                                <p className="text-xs text-slate-500">Enable voicemail (dial *98 to check)</p>
                              </div>
                              <Switch
                                checked={selectedNumber.voicemailEnabled || false}
                                onCheckedChange={(checked) => {
                                  if (selectedNumber.telnyxPhoneNumberId) {
                                    // Use local state voicemailPinInput (user may have just typed it)
                                    const currentPin = voicemailPinInput || selectedNumber.voicemailPin;
                                    if (checked && (!currentPin || currentPin.length < 4)) {
                                      toast({ title: "PIN Required", description: "Please set a 4-digit PIN below to enable voicemail." });
                                      return;
                                    }
                                    numberVoiceSettingsMutation.mutate({
                                      phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                      settings: { voicemailEnabled: checked }
                                    });
                                  }
                                }}
                                disabled={numberVoiceSettingsMutation.isPending}
                                data-testid="switch-voicemail-number"
                              />
                            </div>
                            <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                              <Label className="text-xs text-slate-500 mb-1 block">PIN (4 digits)</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={4}
                                  placeholder="0000"
                                  value={voicemailPinInput}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                    setVoicemailPinInput(value);
                                    if (selectedNumber.telnyxPhoneNumberId && value.length === 4) {
                                      numberVoiceSettingsMutation.mutate({
                                        phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                        settings: { voicemailPin: value }
                                      });
                                    }
                                  }}
                                  className="h-8 w-20 text-center font-mono text-xs"
                                  disabled={numberVoiceSettingsMutation.isPending}
                                  data-testid="input-voicemail-pin"
                                />
                                {selectedNumber.voicemailPin && selectedNumber.voicemailPin.length === 4 && (
                                  <span className="text-xs text-green-600 flex items-center">PIN set</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1">Required to access voicemail messages</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CNAM Listing - Outbound Caller ID Name */}
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-foreground">Outbound Caller ID Name</p>
                            <p className="text-xs text-slate-500">Display your business name when making calls (max 15 characters)</p>
                          </div>
                          {!editingCnam && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCnamInput(selectedNumber.callerIdName || "");
                                setEditingCnam(true);
                              }}
                              data-testid="button-edit-cnam"
                            >
                              {selectedNumber.callerIdName ? 'Update' : 'Configure'}
                            </Button>
                          )}
                        </div>
                        {editingCnam ? (
                          <div className="space-y-3">
                            <div>
                              <Input
                                placeholder="Business Name (max 15 chars)"
                                value={cnamInput}
                                onChange={(e) => setCnamInput(e.target.value.slice(0, 15))}
                                maxLength={15}
                                className="uppercase"
                                data-testid="input-cnam-name"
                              />
                              <p className="text-xs text-slate-400 mt-1">{cnamInput.length}/15 characters</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (selectedNumber.telnyxPhoneNumberId && cnamInput.trim()) {
                                    updateCnamMutation.mutate({
                                      phoneNumberId: selectedNumber.telnyxPhoneNumberId,
                                      cnamName: cnamInput.trim()
                                    });
                                  }
                                }}
                                disabled={!cnamInput.trim() || updateCnamMutation.isPending}
                                data-testid="button-save-cnam"
                              >
                                {updateCnamMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingCnam(false);
                                  setCnamInput("");
                                }}
                                data-testid="button-cancel-cnam"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                              Current: <span className="font-medium text-slate-900 dark:text-white">{selectedNumber.callerIdName || 'Not configured'}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              Changes take 12-72 hours to propagate to all carriers.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <Phone className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-500">Select a number to view details</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Call History Tab */}
          <TabsContent value="calls" className="m-0">
            <CallHistoryWithAutoPolling 
              callLogsData={callLogsData}
              isLoadingCallLogs={isLoadingCallLogs}
              billingFeaturesData={billingFeaturesData}
            />
          </TabsContent>

          {/* Pricing Tab - Billing & Wallet + Telephony Rates */}
          <TabsContent value="pricing" className="flex-1 m-0 overflow-auto">
            <div className="p-6">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Wallet & Billing */}
                <div className="lg:col-span-1 space-y-4">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Wallet & Billing</h2>
                  
                  {/* Balance Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Current Balance</span>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddFunds(true)} className="h-7 text-xs" data-testid="button-add-funds">
                        <Plus className="h-3 w-3 mr-1" />Add Funds
                      </Button>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(walletBalance)}</p>
                  </div>

                  {/* Auto-Recharge */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-slate-700 dark:text-foreground">Auto-Recharge</p>
                        <p className="text-xs text-slate-500">Automatically add funds when balance is low</p>
                      </div>
                      <Switch checked={autoRechargeEnabled} onCheckedChange={handleAutoRechargeToggle} data-testid="switch-auto-recharge" />
                    </div>
                    {autoRechargeEnabled && (
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <Label className="text-xs text-slate-500">When below</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <Input type="number" min="5" max="100" value={autoRechargeThreshold} onChange={(e) => setAutoRechargeThreshold(e.target.value)} className="pl-7 h-9" data-testid="input-auto-recharge-threshold" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Add amount</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <Input type="number" min="10" max="500" value={autoRechargeAmount} onChange={(e) => setAutoRechargeAmount(e.target.value)} className="pl-7 h-9" data-testid="input-auto-recharge-amount" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Pricing Cards */}
                <div className="lg:col-span-2">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Telephony Rates</h2>
                  
                  {isLoadingPricing ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : pricingData ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Voice Calls */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Phone className="h-4 w-4 text-indigo-600" />
                          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Voice Calls</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Local Outbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.voice.local.outbound.toFixed(4)}/min</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Local Inbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.voice.local.inbound.toFixed(4)}/min</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Toll-Free Outbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.voice.tollfree.outbound.toFixed(4)}/min</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Toll-Free Inbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.voice.tollfree.inbound.toFixed(4)}/min</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Call Recording</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.voice.recording.toFixed(4)}/min</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-slate-600 dark:text-slate-400">CNAM (per number)</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.voice.cnamLookup.toFixed(2)}/month</span>
                          </div>
                        </div>
                      </div>

                      {/* SMS Messages */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare className="h-4 w-4 text-indigo-600" />
                          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">SMS Messages</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Local Outbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.sms.local.outbound.toFixed(4)}/msg</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Local Inbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.sms.local.inbound.toFixed(4)}/msg</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Toll-Free Outbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.sms.tollfree.outbound.toFixed(4)}/msg</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-slate-600 dark:text-slate-400">Toll-Free Inbound</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.sms.tollfree.inbound.toFixed(4)}/msg</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">Note: Carrier fees (~$0.003) may apply</p>
                      </div>

                      {/* Monthly Numbers */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Hash className="h-4 w-4 text-indigo-600" />
                          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Phone Numbers</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Local Number</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.monthly.localNumber.toFixed(2)}/month</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-slate-600 dark:text-slate-400">Toll-Free Number</span>
                            <span className="font-medium text-slate-900 dark:text-white">${pricingData.monthly.tollfreeNumber.toFixed(2)}/month</span>
                          </div>
                        </div>
                      </div>

                      {/* Billing Rules */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-4 w-4 text-indigo-600" />
                          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Billing Rules</h3>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-slate-600 dark:text-slate-400">Minimum Billable</span>
                            <span className="font-medium text-slate-900 dark:text-white">{pricingData.billing.minimumSeconds} seconds</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-slate-600 dark:text-slate-400">Billing Increment</span>
                            <span className="font-medium text-slate-900 dark:text-white">{pricingData.billing.incrementSeconds} seconds</span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">Calls billed in {pricingData.billing.incrementSeconds}s increments, {pricingData.billing.minimumSeconds}s minimum</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-slate-500">Unable to load pricing information</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pbx" className="flex-1 m-0 overflow-auto">
            <PbxSettings />
          </TabsContent>

          {/* Compliance Tab - 10DLC Brand Registration */}
          <TabsContent value="compliance" className="flex-1 m-0 overflow-auto">
            <ComplianceTab />
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
                CNAM is a paid feature with the following cost:
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                <p className="text-amber-800 dark:text-amber-200">
                  <strong>Monthly fee:</strong> $0.50/month per number
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

/* Compact Inline Audio Player Component */
interface AudioPlayerProps {
  recordingUrl: string;
  logId: string;
}

function CompactAudioPlayer({ recordingUrl, logId }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => { setDuration(audio.duration); setIsLoading(false); };
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
    if (audio.paused) { setIsLoading(true); audio.play().catch(() => setIsLoading(false)); }
    else { audio.pause(); }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = parseFloat(e.target.value);
    setCurrentTime(audio.currentTime);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(recordingUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${logId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { window.open(recordingUrl, '_blank'); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5">
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />
      <button onClick={togglePlayPause} disabled={isLoading} className="w-6 h-6 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50" data-testid={`button-play-${logId}`}>
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
      </button>
      <button onClick={handleStop} className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 text-slate-500" data-testid={`button-stop-${logId}`}>
        <Square className="h-2 w-2" />
      </button>
      <div className="relative w-16 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 h-full bg-indigo-500" style={{ width: `${progress}%` }} />
        <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <span className="text-[10px] text-slate-500 font-mono w-8">{formatTime(currentTime)}</span>
      <button onClick={handleDownload} className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 text-slate-500" title="Download" data-testid={`button-download-${logId}`}>
        <Download className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

/* Helper to format call status with proper capitalization and direction logic */
function formatCallStatus(status: string, direction: string): string {
  if (status === 'answered') return 'Answered';
  if (status === 'failed') return 'Failed';
  // For missed/no-answer: outbound = "No Answer", inbound = "Missed"
  if (status === 'missed' || status === 'no-answer') {
    return direction === 'outbound' ? 'No Answer' : 'Missed';
  }
  // Capitalize first letter for any other status
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/* Call History with Auto-Polling Component */
interface CallHistoryProps {
  callLogsData: { logs: any[] } | undefined;
  isLoadingCallLogs: boolean;
  billingFeaturesData: { recordingEnabled?: boolean } | undefined;
}

type SortField = 'date' | 'duration' | 'cost';
type SortDir = 'asc' | 'desc';

function CallHistoryWithAutoPolling({ callLogsData, isLoadingCallLogs, billingFeaturesData }: CallHistoryProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number | null>(null);
  
  // Filters & Sorting
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'answered' | 'missed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  useEffect(() => {
    if (initialSyncDone || !billingFeaturesData?.recordingEnabled || !callLogsData?.logs?.length) return;
    const callsWithoutRecording = callLogsData.logs.filter(log => log.status === 'answered' && log.duration > 0 && !log.recordingUrl);
    if (callsWithoutRecording.length > 0) {
      setInitialSyncDone(true);
      fetch('/api/telnyx/sync-recordings', { method: 'POST', credentials: 'include' })
        .then(() => queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] }))
        .catch(() => {});
    } else { setInitialSyncDone(true); }
  }, [callLogsData, billingFeaturesData, initialSyncDone]);
  
  const hasRecentCallsWithoutRecording = useCallback(() => {
    if (!callLogsData?.logs?.length || !billingFeaturesData?.recordingEnabled) return false;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return callLogsData.logs.some(log => {
      const logTime = new Date(log.startedAt).getTime();
      return logTime > fiveMinutesAgo && log.status === 'answered' && log.duration > 0 && !log.recordingUrl;
    });
  }, [callLogsData, billingFeaturesData]);
  
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    setIsPolling(true);
    pollingStartTimeRef.current = Date.now();
    fetch('/api/telnyx/sync-recordings', { method: 'POST', credentials: 'include' }).catch(() => {});
    pollingIntervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - (pollingStartTimeRef.current || 0);
      if (elapsed > 2 * 60 * 1000) { stopPolling(); return; }
      try { await fetch('/api/telnyx/sync-recordings', { method: 'POST', credentials: 'include' }); } catch {}
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
    }, 5000);
  }, []);
  
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
    pollingStartTimeRef.current = null;
    setIsPolling(false);
  }, []);
  
  useEffect(() => {
    if (hasRecentCallsWithoutRecording()) { startPolling(); }
    else if (isPolling) { stopPolling(); }
    return () => stopPolling();
  }, [callLogsData, hasRecentCallsWithoutRecording, startPolling, stopPolling, isPolling]);
  
  const callsMissingRecording = callLogsData?.logs?.filter(log => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const logTime = new Date(log.startedAt).getTime();
    return logTime > fiveMinutesAgo && log.status === 'answered' && log.duration > 0 && !log.recordingUrl;
  }) || [];

  const toggleSort = (field: SortField) => {
    if (sortField === field) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortDir('desc'); }
  };

  const filteredAndSortedLogs = callLogsData?.logs
    ?.filter(log => {
      if (directionFilter !== 'all' && log.direction !== directionFilter) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const phone = (log.direction === 'inbound' ? log.fromNumber : log.toNumber) || '';
        if (!phone.toLowerCase().includes(q) && !(log.callerName || '').toLowerCase().includes(q)) return false;
      }
      return true;
    })
    ?.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      else if (sortField === 'duration') cmp = (b.duration || 0) - (a.duration || 0);
      else if (sortField === 'cost') cmp = parseFloat(b.cost || '0') - parseFloat(a.cost || '0');
      return sortDir === 'asc' ? -cmp : cmp;
    }) || [];

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-400" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-indigo-600" /> : <ArrowDown className="h-3 w-3 text-indigo-600" />;
  };
  
  return (
    <Card className="border-slate-200 dark:border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />Call History
            {callLogsData?.logs?.length ? <span className="text-xs font-normal text-slate-400">({filteredAndSortedLogs.length})</span> : null}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {isPolling && callsMissingRecording.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="h-7 w-32 pl-7 text-xs" data-testid="input-search-calls" />
            </div>
            <Select value={directionFilter} onValueChange={(v: any) => setDirectionFilter(v)}>
              <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-direction-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="h-7 w-24 text-xs" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="answered">Answered</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoadingCallLogs ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : !callLogsData?.logs?.length ? (
          <div className="text-center py-8 text-slate-400">
            <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No calls yet</p>
          </div>
        ) : filteredAndSortedLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No calls match filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-muted/50 border-y border-slate-100 dark:border-border">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Phone</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('date')}>
                    <span className="flex items-center gap-1">Date <SortIcon field="date" /></span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Recording</th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('duration')}>
                    <span className="flex items-center justify-end gap-1">Duration <SortIcon field="duration" /></span>
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => toggleSort('cost')}>
                    <span className="flex items-center justify-end gap-1">Cost <SortIcon field="cost" /></span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border max-h-[400px] overflow-y-auto">
                {filteredAndSortedLogs.map(log => {
                  const isMissing = callsMissingRecording.some(c => c.id === log.id);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-1.5">
                        {log.direction === 'inbound' ? <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" /> : <PhoneOutgoing className="h-3.5 w-3.5 text-green-500" />}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-foreground whitespace-nowrap">
                        {formatPhoneDisplay(log.direction === 'inbound' ? log.fromNumber : log.toNumber)}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                        {format(new Date(log.startedAt), "MM/dd/yy h:mm a")}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          log.status === 'answered' ? 'bg-green-100 text-green-700' : 
                          log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{formatCallStatus(log.status, log.direction)}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {log.recordingUrl ? (
                          <CompactAudioPlayer recordingUrl={log.recordingUrl} logId={log.id} />
                        ) : isMissing && billingFeaturesData?.recordingEnabled ? (
                          <span className="flex items-center gap-1 text-amber-500"><Loader2 className="h-3 w-3 animate-spin" />Syncing</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                        {log.duration > 0 ? `${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, '0')}` : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-amber-600">
                        {log.cost && parseFloat(log.cost) > 0 ? `$${parseFloat(log.cost).toFixed(4)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
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
              <p className="text-lg font-semibold text-slate-900 dark:text-foreground">{formatPhoneDisplay(number.phoneNumber)}</p>
              <p className="text-sm text-slate-500">{number.numberType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Local'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={number.status === 'active' ? 'default' : 'secondary'} className={number.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : ''}>
              {number.status === 'active' ? 'Active' : number.status}
            </Badge>
            {!number.e911Enabled && onConfigureE911 && (
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

        <TabsContent value="voice" className="m-0">
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
                  <p className="text-sm text-slate-500">Show caller names on incoming calls</p>
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

        <TabsContent value="caller-id" className="m-0">
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
