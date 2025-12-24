import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Globe, Upload, Trash2, X, Copy, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function WhiteLabelSettings() {
  const { toast } = useToast();
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const { data: sessionData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;

  const { data: companyData, isLoading: isLoadingCompany } = useQuery<{ company: any }>({
    queryKey: ["/api/settings/company"],
    enabled: !!user?.companyId,
  });

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data: customDomainData, isLoading: isLoadingCustomDomain, refetch: refetchCustomDomain } = useQuery<{
    configured: boolean;
    domain: string | null;
    status: string | null;
    sslStatus?: string;
    error?: string;
    cnameInstructions?: {
      host: string;
      value: string;
      type: string;
    };
  }>({
    queryKey: ['/api/organization/domain'],
    enabled: isAdmin && !!user?.companyId,
  });

  const [customDomainInput, setCustomDomainInput] = useState("");
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const connectDomainMutation = useMutation({
    mutationFn: async (hostname: string) => {
      return await apiRequest('POST', '/api/organization/domain', { hostname });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Domain Connected",
        description: data.message || "Please add the CNAME record to your DNS.",
      });
      setCustomDomainInput("");
      queryClient.invalidateQueries({ queryKey: ['/api/organization/domain'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectDomainMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/organization/domain');
    },
    onSuccess: () => {
      toast({
        title: "Domain Disconnected",
        description: "Custom domain has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organization/domain'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: { logo?: string | null }) => {
      return await apiRequest("PATCH", "/api/company", data);
    },
    onSuccess: () => {
      toast({ title: "Logo updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      setSavingSection(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error updating logo", description: error.message, variant: "destructive" });
      setSavingSection(null);
    },
  });

  useEffect(() => {
    if (!customDomainData?.configured) return;
    if (customDomainData.status === "active") return;
    
    const intervalId = setInterval(() => {
      refetchCustomDomain();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [customDomainData?.configured, customDomainData?.status, refetchCustomDomain]);

  const handleLogoClick = () => {
    logoFileInputRef.current?.click();
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 2.5MB", variant: "destructive" });
      return;
    }

    setSavingSection("branding");
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      updateCompanyMutation.mutate({ logo: base64String });
    };
    reader.readAsDataURL(file);

    if (e.target) e.target.value = "";
  };

  const handleDeleteLogo = () => {
    setSavingSection("branding");
    updateCompanyMutation.mutate({ logo: null });
  };

  if (isLoadingUser) {
    return <LoadingSpinner fullScreen={false} />;
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Only administrators can access White Label settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Company Logo</CardTitle>
              <CardDescription>
                Your logo appears in the navigation and emails.
              </CardDescription>
            </div>
            {companyData?.company?.logo && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteLogo}
                disabled={updateCompanyMutation.isPending && savingSection === "branding"}
                data-testid="button-delete-logo"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div 
              className="relative group cursor-pointer"
              onClick={handleLogoClick}
              data-testid="button-upload-logo"
            >
              {companyData?.company?.logo ? (
                <>
                  <div className="flex items-center justify-center rounded-md border-2 bg-muted/30 p-4">
                    <img 
                      src={companyData.company.logo} 
                      alt="Company Logo" 
                      className="max-h-24 max-w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      data-testid="img-company-logo"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/60 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <Upload className="h-6 w-6 text-white" />
                    <p className="text-sm font-medium text-white">Click to change logo</p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 rounded-md border-2 border-dashed bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-1">Click to upload logo</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG or GIF (max. 2.5MB)</p>
                  <p className="text-xs text-muted-foreground">Recommended: 516px × 142px</p>
                </div>
              )}
              
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileChange}
                data-testid="input-logo-file"
              />
            </div>
            
            {updateCompanyMutation.isPending && savingSection === "branding" && (
              <p className="text-xs text-muted-foreground text-center mt-2">Uploading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Custom Domain
              </CardTitle>
              <CardDescription>
                Connect your own domain to access the platform with your brand.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingCustomDomain ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner fullScreen={false} />
              </div>
            ) : customDomainData?.configured ? (
              <>
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{customDomainData.domain}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        customDomainData.status === "active" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      }`}>
                        {customDomainData.status !== "active" && (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        )}
                        {customDomainData.status === "active" ? "Active" : "Verifying..."}
                      </span>
                      {customDomainData.sslStatus && (
                        <span className="text-xs text-muted-foreground">
                          SSL: {customDomainData.sslStatus}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {customDomainData.status !== "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        data-testid="button-refresh-domain"
                      >
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        Auto-checking...
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={disconnectDomainMutation.isPending}
                          data-testid="button-disconnect-domain"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect Custom Domain?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the custom domain "{customDomainData.domain}" from your organization. 
                            Users will no longer be able to access the platform via this domain.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => disconnectDomainMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {customDomainData.status !== "active" && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Configure Your DNS
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                      Go to your domain registrar and add a <strong>CNAME record</strong> with these values:
                    </p>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-blue-900 p-3 rounded border">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Type</span>
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-mono font-semibold">CNAME</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText("CNAME");
                              toast({ title: "Copied!" });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-blue-900 p-3 rounded border">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Host</span>
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-mono font-semibold">{customDomainData.domain?.split('.')[0] || '@'}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              const host = customDomainData.domain?.split('.')[0] || '@';
                              navigator.clipboard.writeText(host);
                              toast({ title: "Copied!" });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-blue-900 p-3 rounded border">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Value</span>
                        <div className="flex items-center justify-between mt-1">
                          <p className="font-mono font-semibold text-sm">app.curbe.io</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              navigator.clipboard.writeText("app.curbe.io");
                              toast({ title: "Copied!" });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-sm">
                      <p className="text-amber-800 dark:text-amber-200">
                        <strong>Note:</strong> DNS changes can take up to 48 hours to propagate.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Domain Name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="customDomain"
                      placeholder="crm.yourdomain.com"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      data-testid="input-custom-domain"
                    />
                    <Button
                      onClick={() => connectDomainMutation.mutate(customDomainInput)}
                      disabled={connectDomainMutation.isPending || !customDomainInput.trim()}
                      data-testid="button-connect-domain"
                    >
                      {connectDomainMutation.isPending ? "Connecting..." : "Connect"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the domain you want to use to access this platform (e.g., crm.yourbusiness.com)
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
