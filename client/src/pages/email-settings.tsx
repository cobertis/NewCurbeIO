import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Settings,
  BarChart3,
  Shield,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";

interface EmailSettings {
  id: string;
  companyId: string;
  sendingDomain: string;
  identityArn?: string;
  verificationStatus: string;
  dkimStatus?: string;
  mailFromDomain?: string;
  mailFromStatus?: string;
  configurationSetName?: string;
  isActive: boolean;
  isPaused: boolean;
  pauseReason?: string;
  dailyLimit: number;
  hourlyLimit: number;
  minuteLimit: number;
  warmupStage: number;
  bounceRate: number;
  complaintRate: number;
  maxBounceRate: number;
  maxComplaintRate: number;
  createdAt: string;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  purpose: string;
  status?: string;
}

interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalComplaints: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
}

interface SuppressionEntry {
  id: string;
  email: string;
  reason: string;
  createdAt: string;
}

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const [newDomain, setNewDomain] = useState("");
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showSuppressionDialog, setShowSuppressionDialog] = useState(false);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState("");

  const { data: settingsResponse, isLoading: loadingSettings } = useQuery<{ configured: boolean; settings: EmailSettings | null }>({
    queryKey: ["/api/ses/settings"],
  });

  const settings = settingsResponse?.settings;

  const { data: dnsRecordsResponse, isLoading: loadingDns, refetch: refetchDns } = useQuery<{ records: DnsRecord[] }>({
    queryKey: ["/api/ses/domain/dns-records"],
    enabled: !!settings?.sendingDomain,
  });

  const dnsRecords = dnsRecordsResponse?.records;

  const { data: metrics, isLoading: loadingMetrics } = useQuery<EmailMetrics>({
    queryKey: ["/api/ses/metrics"],
    enabled: !!settings?.isActive,
  });

  const { data: suppressionData } = useQuery<{ suppression: SuppressionEntry[]; total: number }>({
    queryKey: ["/api/ses/suppression"],
    enabled: showSuppressionDialog,
  });

  const setupDomainMutation = useMutation({
    mutationFn: async (domain: string) => {
      return apiRequest("POST", "/api/ses/domain/setup", { domain });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      setShowSetupDialog(false);
      setNewDomain("");
      toast({
        title: "Domain setup initiated",
        description: "Please add the DNS records to verify your domain.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/ses/domain/verify");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ses/domain/dns-records"] });
      toast({
        title: "Verification check complete",
        description: "Domain status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      return apiRequest("PATCH", "/api/ses/settings", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      toast({
        title: "Settings updated",
        description: "Email sending status has been updated.",
      });
    },
  });

  const resumeSendingMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/ses/resume");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/settings"] });
      toast({
        title: "Sending resumed",
        description: "Email sending has been resumed.",
      });
    },
  });

  const addSuppressionMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/ses/suppression", { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/suppression"] });
      setNewSuppressionEmail("");
      toast({
        title: "Email added",
        description: "Email has been added to suppression list.",
      });
    },
  });

  const removeSuppressionMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("DELETE", `/api/ses/suppression/${encodeURIComponent(email)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ses/suppression"] });
      toast({
        title: "Email removed",
        description: "Email has been removed from suppression list.",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Value copied to clipboard.",
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "SUCCESS":
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Unknown</Badge>;
    }
  };

  if (loadingSettings) {
    return <LoadingSpinner message="Loading email settings..." />;
  }

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm" data-testid="button-back-settings">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Settings</h1>
          <p className="text-muted-foreground">Configure your domain for sending emails via AWS SES</p>
        </div>
        {!settings?.sendingDomain && (
          <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-setup-domain">
                <Globe className="w-4 h-4 mr-2" />
                Setup Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Setup Email Domain</DialogTitle>
                <DialogDescription>
                  Enter your domain to enable custom email sending. You will need to add DNS records to verify ownership.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    data-testid="input-domain-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => setupDomainMutation.mutate(newDomain)}
                  disabled={!newDomain || setupDomainMutation.isPending}
                  data-testid="button-confirm-setup"
                >
                  {setupDomainMutation.isPending && <LoadingSpinner fullScreen={false} />}
                  Setup Domain
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {settings?.isPaused && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <CardTitle className="text-yellow-800">Email Sending Paused</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700 mb-4">{settings.pauseReason || "Email sending has been automatically paused due to high bounce or complaint rates."}</p>
            <Button
              variant="outline"
              onClick={() => resumeSendingMutation.mutate()}
              disabled={resumeSendingMutation.isPending}
              data-testid="button-resume-sending"
            >
              {resumeSendingMutation.isPending && <LoadingSpinner fullScreen={false} />}
              Resume Sending
            </Button>
          </CardContent>
        </Card>
      )}

      {settings?.sendingDomain ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle>{settings.sendingDomain}</CardTitle>
                    <CardDescription>Primary sending domain</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="active-toggle">Active</Label>
                    <Switch
                      id="active-toggle"
                      checked={settings.isActive}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate(checked)}
                      disabled={toggleActiveMutation.isPending}
                      data-testid="switch-email-active"
                    />
                  </div>
                  {getStatusBadge(settings.verificationStatus)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">DKIM Status:</span>
                  <span className="ml-2">{getStatusBadge(settings.dkimStatus)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">MAIL FROM Status:</span>
                  <span className="ml-2">{getStatusBadge(settings.mailFromStatus)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Warmup Stage:</span>
                  <span className="ml-2 font-medium">{settings.warmupStage}/10</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Daily Limit:</span>
                  <span className="ml-2 font-medium">{settings.dailyLimit.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle>DNS Records</CardTitle>
                    <CardDescription>Add these records to your DNS provider to verify your domain</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => verifyDomainMutation.mutate()}
                  disabled={verifyDomainMutation.isPending}
                  data-testid="button-verify-domain"
                >
                  {verifyDomainMutation.isPending ? (
                    <LoadingSpinner fullScreen={false} />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Verify DNS
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDns ? (
                <LoadingSpinner message="Loading DNS records..." fullScreen={false} />
              ) : dnsRecords && dnsRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dnsRecords.map((record, index) => (
                      <TableRow key={index} data-testid={`row-dns-record-${index}`}>
                        <TableCell className="font-mono text-sm">{record.type}</TableCell>
                        <TableCell className="font-mono text-xs max-w-xs truncate">{record.name}</TableCell>
                        <TableCell className="font-mono text-xs max-w-xs truncate">{record.value}</TableCell>
                        <TableCell>{record.purpose}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(record.value)}
                            data-testid={`button-copy-dns-${index}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">No DNS records available.</p>
              )}
            </CardContent>
          </Card>

          {settings.isActive && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Email Metrics</CardTitle>
                    <CardDescription>Delivery statistics for the past 30 days</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMetrics ? (
                  <LoadingSpinner message="Loading metrics..." fullScreen={false} />
                ) : metrics ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{metrics.totalSent.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total Sent</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-700">{metrics.deliveryRate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Delivery Rate</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-700">{metrics.bounceRate.toFixed(2)}%</div>
                      <div className="text-sm text-muted-foreground">Bounce Rate</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-700">{metrics.complaintRate.toFixed(3)}%</div>
                      <div className="text-sm text-muted-foreground">Complaint Rate</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No metrics available yet.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Suppression List</CardTitle>
                    <CardDescription>Emails that will not receive messages</CardDescription>
                  </div>
                </div>
                <Dialog open={showSuppressionDialog} onOpenChange={setShowSuppressionDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-manage-suppression">
                      Manage List
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Suppression List</DialogTitle>
                      <DialogDescription>
                        Emails in this list will not receive any messages. Hard bounces and complaints are automatically added.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="email@example.com"
                          value={newSuppressionEmail}
                          onChange={(e) => setNewSuppressionEmail(e.target.value)}
                          data-testid="input-suppression-email"
                        />
                        <Button
                          onClick={() => addSuppressionMutation.mutate(newSuppressionEmail)}
                          disabled={!newSuppressionEmail || addSuppressionMutation.isPending}
                          data-testid="button-add-suppression"
                        >
                          Add
                        </Button>
                      </div>
                      <Separator />
                      {suppressionData?.suppression && suppressionData.suppression.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Added</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {suppressionData.suppression.map((entry) => (
                              <TableRow key={entry.id} data-testid={`row-suppression-${entry.id}`}>
                                <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                                <TableCell>{entry.reason}</TableCell>
                                <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSuppressionMutation.mutate(entry.email)}
                                    disabled={removeSuppressionMutation.isPending}
                                    data-testid={`button-remove-suppression-${entry.id}`}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-muted-foreground text-sm text-center py-4">No suppressed emails.</p>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Max Bounce Rate:</span>
                  <span className="ml-2 font-medium">{(settings.maxBounceRate * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Complaint Rate:</span>
                  <span className="ml-2 font-medium">{(settings.maxComplaintRate * 100).toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Bounce Rate:</span>
                  <span className={`ml-2 font-medium ${settings.bounceRate > settings.maxBounceRate ? 'text-red-600' : ''}`}>
                    {(settings.bounceRate * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Complaint Rate:</span>
                  <span className={`ml-2 font-medium ${settings.complaintRate > settings.maxComplaintRate ? 'text-red-600' : ''}`}>
                    {(settings.complaintRate * 100).toFixed(3)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Domain Configured</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Set up a custom sending domain to start sending emails through AWS SES.
              You will need access to your domain's DNS settings.
            </p>
            <Button onClick={() => setShowSetupDialog(true)} data-testid="button-setup-domain-cta">
              <Globe className="w-4 h-4 mr-2" />
              Setup Domain
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
