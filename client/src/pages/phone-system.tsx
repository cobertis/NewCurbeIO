import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Phone, 
  Settings2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  PhoneCall,
  MessageSquare,
  Shield
} from "lucide-react";

export default function PhoneSystem() {
  const { toast } = useToast();
  const [isSettingUp, setIsSettingUp] = useState(false);

  const { data: statusData, isLoading: isLoadingStatus, refetch } = useQuery<{
    hasAccount: boolean;
    accountId?: string;
    status?: string;
    balance?: string;
  }>({
    queryKey: ["/api/telnyx/managed-accounts/status"],
  });

  const { data: numbersData, isLoading: isLoadingNumbers } = useQuery<{
    success: boolean;
    numbers?: Array<{
      phone_number: string;
      connection_name: string;
      status: string;
    }>;
  }>({
    queryKey: ["/api/telnyx/numbers"],
    enabled: statusData?.hasAccount === true,
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

  if (isLoadingStatus) {
    return <LoadingSpinner fullScreen message="Loading phone system status..." />;
  }

  const hasAccount = statusData?.hasAccount;
  const accountStatus = statusData?.status;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Phone System</h1>
        <p className="text-muted-foreground">Manage your business phone numbers and calling features</p>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Phone System Active
                  </CardTitle>
                  <CardDescription>Your phone system is configured and ready to use</CardDescription>
                </div>
                <Badge variant={accountStatus === 'active' ? 'default' : 'secondary'}>
                  {accountStatus || 'Active'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Account ID:</span>
                  <p className="font-mono text-xs mt-1">{statusData?.accountId}</p>
                </div>
                {statusData?.balance && (
                  <div>
                    <span className="text-muted-foreground">Balance:</span>
                    <p className="font-medium mt-1">${statusData.balance}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Phone Numbers</CardTitle>
              <CardDescription>Phone numbers assigned to your account</CardDescription>
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
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{number.phone_number}</span>
                      </div>
                      <Badge variant={number.status === 'active' ? 'default' : 'secondary'}>
                        {number.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No phone numbers yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the phone button in the header to buy new numbers
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
