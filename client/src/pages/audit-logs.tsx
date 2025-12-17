import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Activity, User, Calendar, MapPin, Globe, Mail, Eye, Send, DollarSign, Users, Clock, CreditCard } from "lucide-react";
import type { ActivityLog, User as UserType } from "@shared/schema";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function AuditLogs() {
  const { toast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState<ActivityLog | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: userData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });

  const { data: logsData, isLoading } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ["/api/audit-logs"],
  });

  const resendMutation = useMutation({
    mutationFn: async (logId: string) => {
      return apiRequest("POST", "/api/email/resend", { logId });
    },
    onSuccess: () => {
      toast({
        title: "Email Resent",
        description: "The email has been resent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Resend Failed",
        description: error.message || "Failed to resend email",
        variant: "destructive",
      });
    },
  });

  const logs = logsData?.logs || [];
  const user = userData?.user;

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("create") || action === "company_registered") return "default";
    if (action.includes("update")) return "secondary";
    if (action.includes("delete")) return "destructive";
    if (action.includes("login") || action === "account_activated") return "default";
    if (action.includes("failed")) return "destructive";
    if (action === "email_sent" || action === "otp_sent") return "outline";
    if (action === "plan_selected") return "default";
    return "outline";
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      company_registered: "Company Registered",
      account_activated: "Account Activated",
      otp_sent: "OTP Code Sent",
      login_with_otp: "Login with OTP",
      plan_selected: "Plan Selected",
      email_sent: "Email Sent",
      login: "Login",
      logout: "Logout",
    };
    return labels[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const isEmailLog = (log: ActivityLog): boolean => {
    const metadata = log.metadata as any;
    return log.action === "email_sent" || 
           (metadata?.htmlContent && metadata?.recipient) ||
           log.action === "otp_sent" ||
           log.action === "account_activated";
  };

  const isPlanLog = (log: ActivityLog): boolean => {
    return log.action === "plan_selected";
  };

  const formatPrice = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined) return "N/A";
    return `$${(cents / 100).toFixed(2)}`;
  };

  const renderEmailDetails = (log: ActivityLog) => {
    const metadata = log.metadata as any;
    if (!metadata) return null;

    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">To:</span>
          <span className="text-muted-foreground">{metadata.recipient || metadata.email || "Unknown"}</span>
        </div>
        {metadata.subject && (
          <div className="flex items-start gap-2 text-sm">
            <span className="font-medium min-w-[60px]">Subject:</span>
            <span className="text-muted-foreground">{metadata.subject}</span>
          </div>
        )}
        {metadata.templateSlug && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Template:</span>
            <Badge variant="secondary" className="text-xs">{metadata.templateSlug}</Badge>
          </div>
        )}
        {metadata.method && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Method:</span>
            <Badge variant="outline" className="text-xs">{metadata.method.toUpperCase()}</Badge>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          {metadata.htmlContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedEmail(log);
                setIsViewDialogOpen(true);
              }}
              data-testid={`btn-view-email-${log.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Email
            </Button>
          )}
          {metadata.htmlContent && user?.role === "superadmin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resendMutation.mutate(log.id)}
              disabled={resendMutation.isPending}
              data-testid={`btn-resend-email-${log.id}`}
            >
              {resendMutation.isPending ? (
                <LoadingSpinner fullScreen={false} />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Resend
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderPlanDetails = (log: ActivityLog) => {
    const metadata = log.metadata as any;
    if (!metadata) return null;

    return (
      <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="font-semibold text-base">{metadata.planName || "Unknown Plan"}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {metadata.monthlyPrice !== undefined && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Monthly:</span>
              <span className="font-medium">{formatPrice(metadata.monthlyPrice)}</span>
            </div>
          )}
          {metadata.annualPrice !== undefined && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Annual:</span>
              <span className="font-medium">{formatPrice(metadata.annualPrice)}</span>
            </div>
          )}
          {metadata.billingPeriod && (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Billing:</span>
              <Badge variant="outline" className="text-xs capitalize">{metadata.billingPeriod}</Badge>
            </div>
          )}
          {metadata.trialDays !== undefined && metadata.trialDays > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Trial:</span>
              <span className="font-medium">{metadata.trialDays} days</span>
            </div>
          )}
          {metadata.maxUsers !== undefined && (
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Users:</span>
              <span className="font-medium">{metadata.maxUsers || "Unlimited"}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGenericMetadata = (log: ActivityLog) => {
    const metadata = log.metadata as any;
    if (!metadata || Object.keys(metadata).length === 0) return null;
    
    const skipKeys = ["htmlContent", "textContent"];
    const filteredMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key]) => !skipKeys.includes(key))
    );
    
    if (Object.keys(filteredMetadata).length === 0) return null;

    return (
      <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
        {Object.entries(filteredMetadata).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-muted-foreground">{key}:</span>
            <span className="truncate max-w-[300px]">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Complete audit trail of all system activities
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen={true} />
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No activity logs yet</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
            <CardDescription>
              Showing {logs.length} recent activities{user?.role !== "superadmin" && " for your company"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-border rounded-lg p-4 hover-elevate"
                    data-testid={`log-${log.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                          <span className="text-sm font-medium">{log.entity}</span>
                          {log.entityId && (
                            <span className="text-xs text-muted-foreground font-mono">
                              #{log.entityId.slice(0, 8)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          {log.userId && (
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span className="font-mono text-xs">{log.userId.slice(0, 8)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(log.createdAt), "PPpp")}</span>
                          </div>
                          {log.ipAddress && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              <span className="font-mono text-xs">{log.ipAddress}</span>
                            </div>
                          )}
                          {log.userAgent && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-3 w-3" />
                              <span className="truncate text-xs">{log.userAgent}</span>
                            </div>
                          )}
                        </div>

                        {isEmailLog(log) && renderEmailDetails(log)}
                        {isPlanLog(log) && renderPlanDetails(log)}
                        {!isEmailLog(log) && !isPlanLog(log) && renderGenericMetadata(log)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Content</DialogTitle>
            <DialogDescription>
              {selectedEmail && (
                <>
                  To: {(selectedEmail.metadata as any)?.recipient || "Unknown"} | 
                  Subject: {(selectedEmail.metadata as any)?.subject || "No subject"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg p-4 bg-white">
            {selectedEmail && (
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: (selectedEmail.metadata as any)?.htmlContent || "<p>No content available</p>" 
                }} 
              />
            )}
          </div>
          {selectedEmail && user?.role === "superadmin" && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsViewDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  resendMutation.mutate(selectedEmail.id);
                  setIsViewDialogOpen(false);
                }}
                disabled={resendMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Resend Email
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
