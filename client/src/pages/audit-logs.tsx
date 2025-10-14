import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, User, Calendar, MapPin, Globe } from "lucide-react";
import type { ActivityLog, User as UserType } from "@shared/schema";
import { format } from "date-fns";

export default function AuditLogs() {
  const { data: userData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });

  const { data: logsData, isLoading } = useQuery<{ logs: ActivityLog[] }>({
    queryKey: ["/api/audit-logs"],
  });

  const logs = logsData?.logs || [];
  const user = userData?.user;

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("create")) return "default";
    if (action.includes("update")) return "secondary";
    if (action.includes("delete")) return "destructive";
    if (action.includes("login")) return "default";
    if (action.includes("failed")) return "destructive";
    return "outline";
  };

  const formatMetadata = (metadata: any): string => {
    if (!metadata || Object.keys(metadata).length === 0) return "";
    
    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(", ");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Complete audit trail of all system activities
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Loading logs...</p>
          </CardContent>
        </Card>
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
                            {log.action}
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

                        {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                            {formatMetadata(log.metadata)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
