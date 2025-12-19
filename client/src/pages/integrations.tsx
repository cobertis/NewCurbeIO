import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SiWhatsapp, SiInstagram, SiFacebook } from "react-icons/si";
import { CheckCircle, XCircle, Clock, AlertTriangle, Plus, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import type { ChannelConnection } from "@shared/schema";

type ChannelType = "whatsapp" | "instagram" | "facebook";

interface ConnectionStatus {
  connected: boolean;
  connection?: ChannelConnection;
}

function getStatusBadge(status: string | undefined) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Connected</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    case "error":
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
    case "revoked":
      return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
    default:
      return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Connected</Badge>;
  }
}

function WhatsAppCard() {
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    wabaId: "",
    phoneNumberId: "",
    phoneNumber: "",
    displayName: "",
    accessToken: "",
  });

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/whatsapp/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active";

  const connectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/integrations/whatsapp/connect", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      setConnectDialogOpen(false);
      setFormData({ wabaId: "", phoneNumberId: "", phoneNumber: "", displayName: "", accessToken: "" });
      toast({
        title: "WhatsApp Connected",
        description: "Your WhatsApp Business account has been connected successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect WhatsApp Business account.",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/integrations/whatsapp/disconnect");
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

  const handleConnect = () => {
    if (!formData.wabaId || !formData.phoneNumberId || !formData.accessToken) {
      toast({
        variant: "destructive",
        title: "Missing Fields",
        description: "Please fill in all required fields.",
      });
      return;
    }
    connectMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner fullScreen={false} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-500/10 to-transparent" />
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <SiWhatsapp className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">WhatsApp Business</CardTitle>
              <CardDescription>Connect your WhatsApp Business account</CardDescription>
            </div>
          </div>
          {getStatusBadge(connection?.status)}
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Number</span>
                  <span className="font-medium">{connection?.phoneNumberE164 || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Display Name</span>
                  <span className="font-medium">{connection?.displayName || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connected</span>
                  <span className="font-medium">
                    {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                {connection?.lastError && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400 text-xs">
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
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your WhatsApp Business Platform account to send and receive messages directly from your inbox.
              </p>
              <Button
                className="w-full bg-green-500 hover:bg-green-600"
                onClick={() => setConnectDialogOpen(true)}
                data-testid="button-connect-whatsapp"
              >
                <Plus className="h-4 w-4 mr-2" />
                Connect WhatsApp
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-green-500" />
              Connect WhatsApp Business
            </DialogTitle>
            <DialogDescription>
              Enter your WhatsApp Business API credentials from Meta Business Suite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wabaId">WhatsApp Business Account ID *</Label>
              <Input
                id="wabaId"
                placeholder="e.g., 123456789012345"
                value={formData.wabaId}
                onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                data-testid="input-waba-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
              <Input
                id="phoneNumberId"
                placeholder="e.g., 109876543210123"
                value={formData.phoneNumberId}
                onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                data-testid="input-phone-number-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number (E.164)</Label>
              <Input
                id="phoneNumber"
                placeholder="e.g., +1234567890"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                data-testid="input-phone-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., My Business"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token *</Label>
              <Input
                id="accessToken"
                type="password"
                placeholder="Your permanent access token"
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                data-testid="input-access-token"
              />
              <p className="text-xs text-muted-foreground">
                Get this from Meta Business Suite → System Users → Generate Token
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="bg-green-500 hover:bg-green-600"
              data-testid="button-submit-connect"
            >
              {connectMutation.isPending ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your WhatsApp Business account. You will no longer be able to send or receive WhatsApp messages until you reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
  );
}

function ComingSoonCard({ 
  icon: Icon, 
  title, 
  description, 
  color 
}: { 
  icon: typeof SiInstagram; 
  title: string; 
  description: string; 
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
          This integration is currently in development and will be available soon.
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your social media accounts to manage all conversations in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <WhatsAppCard />
        
        <ComingSoonCard
          icon={SiInstagram}
          title="Instagram Direct"
          description="Connect your Instagram Business account"
          color="text-pink-500"
        />
        
        <ComingSoonCard
          icon={SiFacebook}
          title="Facebook Messenger"
          description="Connect your Facebook Page"
          color="text-blue-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            To connect WhatsApp Business, you need:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>A Meta Business Account with WhatsApp Business API access</li>
            <li>A verified WhatsApp Business phone number</li>
            <li>A permanent access token from Meta Business Suite</li>
          </ul>
          <Button variant="link" className="p-0 h-auto" asChild>
            <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              View WhatsApp Cloud API Documentation
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
