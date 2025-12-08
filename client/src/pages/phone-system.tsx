import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { 
  Phone, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  PhoneCall,
  MessageSquare,
  Shield,
  Building2,
  Mail,
  Calendar,
  Wallet,
  CreditCard,
  Key,
  RefreshCw,
  Plus,
  Globe,
  Hash,
  Clock,
  DollarSign,
  Copy,
  ExternalLink
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
}

export default function PhoneSystem() {
  const { toast } = useToast();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [showBuyNumber, setShowBuyNumber] = useState(false);

  const { data: statusData, isLoading: isLoadingStatus, refetch } = useQuery<StatusResponse>({
    queryKey: ["/api/telnyx/managed-accounts/status"],
  });

  const { data: numbersData, isLoading: isLoadingNumbers, refetch: refetchNumbers } = useQuery<{
    success: boolean;
    numbers?: NumberInfo[];
  }>({
    queryKey: ["/api/telnyx/numbers"],
    enabled: statusData?.configured === true || statusData?.hasAccount === true,
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      setIsSettingUp(true);
      const response = await apiRequest("POST", "/api/telnyx/managed-accounts/setup");
      return response.json();
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

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Phone System</h1>
          <p className="text-muted-foreground">Manage your business phone numbers and calling features</p>
        </div>
        {hasAccount && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
              data-testid="button-refresh-status"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setShowBuyNumber(true)}
              className="gap-2"
              data-testid="button-buy-number"
            >
              <Plus className="h-4 w-4" />
              Buy Number
            </Button>
          </div>
        )}
      </div>

      {!hasAccount ? (
        <Card className="border-2 border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>Setup Phone System</CardTitle>
            <CardDescription>
              Activate your business phone system to make calls, send SMS, and manage phone numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50">
                <PhoneCall className="h-6 w-6 text-blue-500" />
                <span className="text-xs text-muted-foreground text-center">Voice Calls</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50">
                <MessageSquare className="h-6 w-6 text-green-500" />
                <span className="text-xs text-muted-foreground text-center">SMS & MMS</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50">
                <Shield className="h-6 w-6 text-purple-500" />
                <span className="text-xs text-muted-foreground text-center">E911 Ready</span>
              </div>
            </div>

            <Button 
              size="lg"
              onClick={() => setupMutation.mutate()}
              disabled={isSettingUp}
              className="gap-2"
              data-testid="button-setup-phone"
            >
              {isSettingUp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Settings2 className="h-4 w-4" />
                  Activate Phone System
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Account Overview Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Phone System Active</CardTitle>
                    <CardDescription>Business Phone Account</CardDescription>
                  </div>
                </div>
                <Badge variant="default" className="bg-green-600">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Organization */}
                {accountDetails?.organization_name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Organization</p>
                      <p className="font-medium truncate" data-testid="text-organization">{accountDetails.organization_name}</p>
                    </div>
                  </div>
                )}

                {/* Email */}
                {accountDetails?.email && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Account Email</p>
                      <p className="font-medium truncate" data-testid="text-email">{accountDetails.email}</p>
                    </div>
                  </div>
                )}

                {/* Account ID */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Account ID</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs truncate" data-testid="text-account-id">{accountId}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => copyToClipboard(accountId || "", "Account ID")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Created Date */}
                {accountDetails?.created_at && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="font-medium text-sm" data-testid="text-created-at">{formatDate(accountDetails.created_at)}</p>
                    </div>
                  </div>
                )}

                {/* Last Updated */}
                {accountDetails?.updated_at && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="font-medium text-sm" data-testid="text-updated-at">{formatDate(accountDetails.updated_at)}</p>
                    </div>
                  </div>
                )}

                {/* Custom Pricing */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Custom Pricing</p>
                    <Badge variant={accountDetails?.managed_account_allow_custom_pricing ? "default" : "secondary"} className="mt-1">
                      {accountDetails?.managed_account_allow_custom_pricing ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Balance Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Account Balance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-balance">
                      {accountDetails?.balance ? formatCurrency(accountDetails.balance.balance, accountDetails.balance.currency) : "$0.00"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Credit Limit</p>
                    <p className="text-2xl font-bold text-foreground" data-testid="text-credit-limit">
                      {accountDetails?.balance ? formatCurrency(accountDetails.balance.credit_limit, accountDetails.balance.currency) : "$0.00"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground mb-1">Available Credit</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-available-credit">
                      {accountDetails?.balance ? formatCurrency(accountDetails.balance.available_credit, accountDetails.balance.currency) : "$0.00"}
                    </p>
                  </div>
                </div>
              </div>

              {/* API Credentials Section */}
              {accountDetails?.api_key && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      API Credentials
                    </h3>
                    <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">API Key (V2)</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                            {accountDetails.api_key.substring(0, 20)}...
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(accountDetails.api_key || "", "API Key")}
                            className="gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            Copy
                          </Button>
                        </div>
                      </div>
                      {accountDetails.api_token && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">API Token (V1)</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background px-2 py-1 rounded border flex-1 truncate">
                              {accountDetails.api_token}
                            </code>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(accountDetails.api_token || "", "API Token")}
                              className="gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Phone Numbers Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Phone Numbers
                  </CardTitle>
                  <CardDescription>Phone numbers assigned to your account</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchNumbers()}
                    disabled={isLoadingNumbers}
                    className="gap-2"
                    data-testid="button-refresh-numbers"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingNumbers ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowBuyNumber(true)}
                    className="gap-2"
                    data-testid="button-buy-number-2"
                  >
                    <Plus className="h-4 w-4" />
                    Buy Number
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingNumbers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : numbersData?.numbers && numbersData.numbers.length > 0 ? (
                <div className="space-y-2">
                  {numbersData.numbers.map((number) => (
                    <div 
                      key={number.phone_number}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      data-testid={`card-number-${number.phone_number}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{number.phone_number}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {number.phone_number_type && (
                              <span className="capitalize">{number.phone_number_type.replace(/_/g, ' ')}</span>
                            )}
                            {number.connection_name && (
                              <>
                                <span>•</span>
                                <span>{number.connection_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant={number.status === 'active' ? 'default' : 'secondary'} className={number.status === 'active' ? 'bg-green-600' : ''}>
                        {number.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">No Phone Numbers Yet</h3>
                  <p className="text-muted-foreground text-sm mb-4 max-w-sm">
                    Purchase your first phone number to start making calls and sending messages.
                  </p>
                  <Button onClick={() => setShowBuyNumber(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Buy Your First Number
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setShowBuyNumber(true)}>
                  <Phone className="h-5 w-5" />
                  <span className="text-xs">Manage Numbers</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => setShowBuyNumber(true)}>
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">Buy Number</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => refetch()}>
                  <RefreshCw className="h-5 w-5" />
                  <span className="text-xs">Sync Account</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => refetchNumbers()}>
                  <Settings2 className="h-5 w-5" />
                  <span className="text-xs">Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>
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
