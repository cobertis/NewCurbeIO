import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { SiFacebook } from "react-icons/si";
import { ChevronLeft, ExternalLink, Copy, QrCode, Unlink, Download } from "lucide-react";
import type { ChannelConnection } from "@shared/schema";
import { format } from "date-fns";
import QRCode from "qrcode";

export default function FacebookDetailsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/facebook/status"],
  });

  const connection = connectionData?.connection;

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/integrations/facebook/${connection?.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Page disconnected",
        description: "Your Facebook page has been disconnected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/facebook/status"] });
      setLocation("/settings/facebook");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to disconnect the page.",
      });
    },
  });

  const chatLink = `https://m.me/${connection?.fbPageId || ""}`;

  const generateQRCode = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(chatLink, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeDataUrl(dataUrl);
      setQrDialogOpen(true);
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate QR code.",
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Link copied to clipboard.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard.",
      });
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement("a");
    link.download = `facebook-qr-${connection?.fbPageName || "page"}.png`;
    link.href = qrCodeDataUrl;
    link.click();
  };

  if (isLoading) {
    return (
      <SettingsLayout activeSection="facebook">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  if (!connection) {
    return (
      <SettingsLayout activeSection="facebook">
        <div className="text-center py-12">
          <p className="text-slate-500">Facebook page not found.</p>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/settings/facebook")}
            className="mt-4"
          >
            Go back to Facebook settings
          </Button>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="facebook">
      <div className="space-y-6" data-testid="page-facebook-details">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-facebook-details">
          <Link 
            href="/settings/facebook" 
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Facebook
          </Link>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="bg-[#1877F2]/10 p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img 
                  src={`https://graph.facebook.com/${connection.fbPageId}/picture?type=large`}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border-2 border-white shadow-sm"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className="absolute -bottom-1 -right-1 bg-[#1877F2] rounded-full p-1">
                  <SiFacebook className="h-3 w-3 text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {connection.fbPageName || "Facebook Page"}
                  </h1>
                  <a 
                    href={`https://facebook.com/${connection.fbPageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-[#1877F2]"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Connected {connection.createdAt ? format(new Date(connection.createdAt), "MMM d, yyyy 'at' h:mm a") : ""}
                </p>
              </div>
            </div>
          </div>
          
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="p-6 grid grid-cols-[150px_1fr] gap-4 items-start">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">General</span>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Account</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Connected Facebook account is: <span className="font-medium text-slate-900 dark:text-slate-100">{connection.displayName || "Unknown"}</span>
                  </p>
                </div>
              </div>

              <div className="p-6 grid grid-cols-[150px_1fr] gap-4 items-start">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Sharing</span>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Chat link</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      You can share the direct link to the Facebook page chat:
                    </p>
                    <div className="flex items-center gap-2">
                      <a 
                        href={chatLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {chatLink}
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(chatLink)}
                        data-testid="button-copy-link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">QR code</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      You can share this QR code that will link directly to the Facebook page chat.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={generateQRCode}
                      data-testid="button-view-qr"
                    >
                      <QrCode className="h-4 w-4" />
                      View QR code
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-[150px_1fr] gap-4 items-start">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Terms</span>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">Unlink page</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    If you unlink this Facebook page, you will not be able to manage Messenger conversations from this page in Curbe. All previous conversations will still be accessible from your Curbe account.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => setDisconnectDialogOpen(true)}
                    data-testid="button-unlink-page"
                  >
                    <Unlink className="h-4 w-4" />
                    Unlink page
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-qr-code">
          <DialogHeader>
            <DialogTitle>QR code & chat link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Share this QR code or link to direct people to a Messenger conversation with the{" "}
              <span className="font-medium">{connection.fbPageName}</span> page.
            </p>
            
            <div className="flex flex-col items-center py-6">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Scan QR Code</p>
              {qrCodeDataUrl && (
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code" 
                  className="w-48 h-48"
                  data-testid="img-qr-code"
                />
              )}
              <p className="text-sm text-slate-500 mt-4">or</p>
              <div className="flex items-center gap-2 mt-2">
                <a 
                  href={chatLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {chatLink}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => copyToClipboard(chatLink)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button onClick={downloadQRCode} className="gap-2" data-testid="button-download-qr">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent data-testid="dialog-disconnect-facebook">
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Facebook Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink this Facebook page? You will no longer be able to receive or send messages through this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? "Unlinking..." : "Unlink page"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
