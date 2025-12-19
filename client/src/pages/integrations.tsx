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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SiWhatsapp, SiInstagram, SiFacebook } from "react-icons/si";
import { CheckCircle, XCircle, Clock, AlertTriangle, Plus, Trash2, RefreshCw, ExternalLink, Settings, HelpCircle, ChevronDown, Info } from "lucide-react";
import type { ChannelConnection, User } from "@shared/schema";

type ChannelType = "whatsapp" | "instagram" | "facebook";

interface ConnectionStatus {
  connected: boolean;
  connection?: ChannelConnection;
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
        description: "No se completó la conexión con Meta. Intenta nuevamente cuando estés listo."
      };
    case "permission_denied":
    case "insufficient_permissions":
      return {
        title: "Permission required",
        description: "Tu cuenta de Meta no otorgó los permisos necesarios para conectar WhatsApp. Intenta nuevamente y acepta los permisos solicitados."
      };
    case "number_already_connected":
      return {
        title: "This number is already connected",
        description: "Este número ya está conectado a otro workspace. Usa un número diferente o desconecta el número del otro workspace antes de continuar."
      };
    case "number_not_eligible":
    case "no_phone_number":
      return {
        title: "Number not eligible",
        description: "Este número no puede conectarse a WhatsApp Business Platform en este momento."
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
        description: "No pudimos completar la conexión. Nuestro equipo ya tiene registros del error. Intenta nuevamente en unos minutos."
      };
  }
}

function getInstagramErrorMessage(reason: string): { title: string; description: string } {
  switch (reason) {
    case "connection_cancelled":
      return {
        title: "Connection cancelled",
        description: "No se completó la conexión con Meta."
      };
    case "not_professional":
      return {
        title: "Professional account required",
        description: "Esta cuenta es personal. Cambia tu Instagram a Business o Creator."
      };
    case "permission_denied":
      return {
        title: "Permission denied",
        description: "Curbe no tiene permiso para acceder a Instagram DMs."
      };
    case "access_not_available":
      return {
        title: "Access not available",
        description: "Esta integración aún no está habilitada para esta cuenta."
      };
    case "connection_failed":
    default:
      return {
        title: "Connection failed",
        description: "No pudimos completar la conexión."
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
        title: "Conexión cancelada",
        description: "Cancelaste la conexión. Intenta de nuevo cuando estés listo."
      };
    case "permission_required":
      return {
        title: "Permisos requeridos",
        description: "Necesitas aprobar los permisos para conectar Facebook Messenger."
      };
    case "page_not_found":
      return {
        title: "Página no encontrada",
        description: "No se encontró ninguna Página de Facebook en tu cuenta."
      };
    case "connection_failed":
    default:
      return {
        title: "Error de conexión",
        description: "No pudimos conectar tu Página. Por favor intenta de nuevo."
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
        description: error.message || "No pudimos completar la conexión. Intenta nuevamente.",
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

  return (
    <TooltipProvider>
      <>
        <Card className="relative overflow-hidden" data-testid="card-whatsapp">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-500/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <SiWhatsapp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-lg">WhatsApp Business</CardTitle>
                <CardDescription>
                  {isConnected || isPending || hasError || isRevoked
                    ? "Connected to your WhatsApp Business account"
                    : "Conecta tu WhatsApp Business para enviar y recibir mensajes desde tu inbox en Curbe."}
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {oauthStartMutation.isPending ? (
              <div className="text-center py-6">
                <RefreshCw className="h-8 w-8 animate-spin text-green-500 mx-auto mb-3" />
                <p className="font-medium">Connecting WhatsApp...</p>
                <p className="text-sm text-muted-foreground">Estamos completando la conexión con Meta. No cierres esta ventana.</p>
              </div>
            ) : isConnected || isPending || hasError || isRevoked ? (
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
                          <p>"Active" significa que Curbe puede enviar y recibir mensajes. Si aparece "Needs attention", reconecta o revisa permisos.</p>
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
                <p className="text-xs text-muted-foreground">
                  Desconectar detendrá el envío/recepción de mensajes en Curbe para este número.
                </p>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      onClick={handleOAuthConnect}
                      disabled={oauthStartMutation.isPending}
                      data-testid="button-connect-whatsapp"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Connect WhatsApp
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Conectar WhatsApp habilita mensajes en Curbe. Meta puede pedirte seleccionar/crear tu cuenta de WhatsApp Business y confirmar el número.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Te llevaremos a Meta para iniciar sesión y seleccionar tu cuenta de WhatsApp Business.
                  </p>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => setManualConnectDialogOpen(true)}
                      data-testid="button-manual-connect-whatsapp"
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      Manual Connect (Debug)
                    </Button>
                  )}
                </div>
                
                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground" data-testid="button-help-whatsapp">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="h-3 w-3" />
                        Need help?
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="text-sm text-muted-foreground space-y-2 p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium text-foreground">Para conectar WhatsApp necesitas:</p>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>Un <strong>Meta Business</strong> (Business Manager/Portfolio)</li>
                        <li>Un número elegible para WhatsApp Business Platform</li>
                        <li>Permisos para administrar tu cuenta de WhatsApp Business</li>
                      </ul>
                      <Button variant="link" className="p-0 h-auto text-primary" asChild>
                        <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp-setup-guide">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View WhatsApp setup guide
                        </a>
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={manualConnectDialogOpen} onOpenChange={setManualConnectDialogOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-manual-connect-whatsapp">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SiWhatsapp className="h-5 w-5 text-green-500" />
                Manual Connect (Debug)
              </DialogTitle>
              <DialogDescription>
                Enter your WhatsApp Business API credentials from Meta Business Suite. This is for debugging purposes only.
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
              <Button variant="outline" onClick={() => setManualConnectDialogOpen(false)} data-testid="button-cancel-manual-connect">
                Cancel
              </Button>
              <Button
                onClick={handleManualConnect}
                disabled={manualConnectMutation.isPending}
                className="bg-green-500 hover:bg-green-600"
                data-testid="button-submit-manual-connect"
              >
                {manualConnectMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <AlertDialogContent data-testid="dialog-disconnect-whatsapp">
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect WhatsApp?</AlertDialogTitle>
              <AlertDialogDescription>
                Curbe dejará de recibir y enviar mensajes desde este número. Puedes volver a conectarlo en cualquier momento.
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-pink-500/10 to-transparent" />
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <SiInstagram className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Instagram Direct</CardTitle>
                <CardDescription>Connect your Instagram Business account</CardDescription>
              </div>
            </div>
            {getInstagramStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Account</span>
                    <span className="font-medium" data-testid="text-instagram-username">@{connection?.igUsername}</span>
                  </div>
                  {connection?.pageName && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Page</span>
                      <span className="font-medium" data-testid="text-instagram-page">{connection.pageName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Connected</span>
                    <span className="font-medium" data-testid="text-instagram-connected-date">
                      {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDisconnectDialogOpen(true)}
                    data-testid="button-disconnect-instagram"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecta tu Instagram profesional para responder y gestionar DMs desde el inbox de Curbe.
                </p>
                
                <Button 
                  className="w-full bg-pink-500 hover:bg-pink-600"
                  onClick={handleOAuthConnect}
                  disabled={oauthStartMutation.isPending}
                  data-testid="button-connect-instagram"
                >
                  {oauthStartMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Connect Instagram
                    </>
                  )}
                </Button>
                
                {oauthStartMutation.isPending && (
                  <p className="text-xs text-muted-foreground text-center">
                    Estamos completando la conexión con Meta. No cierres esta ventana.
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground text-center">
                  Te llevaremos a Meta para iniciar sesión y seleccionar tu cuenta de Instagram.
                </p>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" data-testid="button-instagram-help">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Need help connecting?
                      <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    <p>
                      Necesitas una cuenta de Instagram Business o Creator y permisos para autorizar mensajería.
                    </p>
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
                Curbe dejará de recibir y enviar DMs desde esta cuenta.
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
        title: "Facebook conectado",
        description: "Tu Página de Facebook ha sido conectada exitosamente.",
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
        title: "Facebook desconectado",
        description: "Tu Página de Facebook ha sido desconectada.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error al desconectar",
        description: error.message || "No pudimos desconectar tu Página de Facebook.",
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
                <CardDescription>Conecta tu Página de Facebook</CardDescription>
              </div>
            </div>
            {getFacebookStatusBadge(connection?.status)}
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Página</span>
                    <span className="font-medium" data-testid="text-facebook-page">{connection?.fbPageName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Conectado</span>
                    <span className="font-medium" data-testid="text-facebook-connected-date">
                      {connection?.connectedAt ? new Date(connection.connectedAt).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDisconnectDialogOpen(true)}
                    data-testid="button-disconnect-facebook"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecta tu Página de Facebook para responder y gestionar mensajes de Messenger desde el inbox de Curbe.
                </p>
                
                <Button 
                  className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
                  onClick={handleOAuthConnect}
                  disabled={oauthStartMutation.isPending}
                  data-testid="button-connect-facebook"
                >
                  {oauthStartMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Conectar Facebook
                    </>
                  )}
                </Button>
                
                {oauthStartMutation.isPending && (
                  <p className="text-xs text-muted-foreground text-center">
                    Estamos completando la conexión con Meta. No cierres esta ventana.
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground text-center">
                  Te llevaremos a Meta para iniciar sesión y seleccionar tu Página de Facebook.
                </p>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" data-testid="button-facebook-help">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      ¿Necesitas ayuda conectando?
                      <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Debes ser administrador de la Página de Facebook</li>
                      <li>La Página debe tener Messenger habilitado</li>
                      <li>Necesitas aprobar los permisos de mensajería</li>
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
              <AlertDialogTitle>¿Desconectar Facebook?</AlertDialogTitle>
              <AlertDialogDescription>
                Curbe dejará de recibir y enviar mensajes desde esta Página.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-disconnect-facebook">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => disconnectMutation.mutate()}
                className="bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-disconnect-facebook"
              >
                {disconnectMutation.isPending ? "Desconectando..." : "Desconectar"}
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
  return (
    <div className="space-y-6" data-testid="page-integrations">
      <div>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your social media accounts to manage all conversations in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <WhatsAppCard />
        
        <InstagramCard />
        
        <FacebookCard />
      </div>
    </div>
  );
}
