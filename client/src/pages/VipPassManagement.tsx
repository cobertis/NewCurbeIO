import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { 
  Plus, Download, Bell, Trash2, CreditCard, Users, 
  Smartphone, BarChart3, Send, RefreshCw 
} from "lucide-react";
import { format } from "date-fns";

interface VipPassStats {
  totalPasses: number;
  activePasses: number;
  revokedPasses: number;
  registeredDevices: number;
  totalDownloads: number;
}

interface VipPassInstance {
  id: string;
  serialNumber: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  memberId: string | null;
  tierLevel: string;
  status: string;
  downloadCount: number;
  createdAt: string;
}

interface NotificationHistory {
  id: string;
  targetType: string;
  message: string | null;
  sentCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
}

export default function VipPassManagement() {
  const { toast } = useToast();
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState("");
  const [pushTarget, setPushTarget] = useState<"single" | "all">("all");
  
  const [newPass, setNewPass] = useState({
    recipientName: "",
    recipientEmail: "",
    recipientPhone: "",
    memberId: "",
    tierLevel: "Gold",
  });

  const { data: stats, isLoading: statsLoading } = useQuery<VipPassStats>({
    queryKey: ["/api/vip-pass/stats"],
  });

  const { data: instances, isLoading: instancesLoading } = useQuery<VipPassInstance[]>({
    queryKey: ["/api/vip-pass/instances"],
  });

  const { data: notificationHistory, isLoading: historyLoading } = useQuery<NotificationHistory[]>({
    queryKey: ["/api/vip-pass/notifications/history"],
  });

  const createPassMutation = useMutation({
    mutationFn: async (data: typeof newPass) => {
      return await apiRequest("POST", "/api/vip-pass/instances", data);
    },
    onSuccess: () => {
      toast({ title: "Pass Created", description: "VIP Pass has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/stats"] });
      setIssueDialogOpen(false);
      setNewPass({ recipientName: "", recipientEmail: "", recipientPhone: "", memberId: "", tierLevel: "Gold" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revokePassMutation = useMutation({
    mutationFn: async (passId: string) => {
      await apiRequest("DELETE", `/api/vip-pass/instances/${passId}`);
    },
    onSuccess: () => {
      toast({ title: "Pass Revoked", description: "VIP Pass has been revoked." });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/instances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendPushMutation = useMutation({
    mutationFn: async ({ passInstanceId, message }: { passInstanceId?: string; message: string }) => {
      return await apiRequest("POST", "/api/vip-pass/notifications/send", {
        passInstanceId,
        message,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Push Notification Sent",
        description: `Sent: ${data.sentCount || 0}, Success: ${data.successCount || 0}, Failed: ${data.failedCount || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/vip-pass/notifications/history"] });
      setPushDialogOpen(false);
      setPushMessage("");
      setSelectedPassId(null);
      setPushTarget("all");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleDownload = (passId: string) => {
    window.open(`/api/vip-pass/instances/${passId}/download`, "_blank");
  };

  const handleOpenPushDialog = (passId?: string) => {
    if (passId) {
      setSelectedPassId(passId);
      setPushTarget("single");
    } else {
      setSelectedPassId(null);
      setPushTarget("all");
    }
    setPushDialogOpen(true);
  };

  const handleSendPush = () => {
    sendPushMutation.mutate({
      passInstanceId: pushTarget === "single" ? selectedPassId || undefined : undefined,
      message: pushMessage,
    });
  };

  const handleCreatePass = () => {
    createPassMutation.mutate(newPass);
  };

  if (statsLoading || instancesLoading) {
    return <LoadingSpinner message="Loading VIP Pass data..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">VIP Pass Management</h1>
          <p className="text-muted-foreground">Manage VIP passes and push notifications for your members</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenPushDialog()}
            data-testid="button-send-push-all"
          >
            <Bell className="h-4 w-4 mr-2" />
            Send Push to All
          </Button>
          <Button onClick={() => setIssueDialogOpen(true)} data-testid="button-issue-pass">
            <Plus className="h-4 w-4 mr-2" />
            Issue New Pass
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-passes">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Passes</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-passes">{stats?.totalPasses || 0}</div>
            <p className="text-xs text-muted-foreground">All issued passes</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-passes">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Passes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-passes">{stats?.activePasses || 0}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card data-testid="card-registered-devices">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Registered Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-registered-devices">{stats?.registeredDevices || 0}</div>
            <p className="text-xs text-muted-foreground">Devices with passes</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-downloads">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-downloads">{stats?.totalDownloads || 0}</div>
            <p className="text-xs text-muted-foreground">Pass downloads</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="passes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="passes" data-testid="tab-passes">Issued Passes</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Notification History</TabsTrigger>
        </TabsList>

        <TabsContent value="passes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Issued Passes</CardTitle>
            </CardHeader>
            <CardContent>
              {instances && instances.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Recipient Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Downloads</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instances.map((instance) => (
                        <TableRow key={instance.id} data-testid={`row-pass-${instance.id}`}>
                          <TableCell className="font-mono text-sm" data-testid={`text-serial-${instance.id}`}>
                            {instance.serialNumber}
                          </TableCell>
                          <TableCell data-testid={`text-name-${instance.id}`}>
                            {instance.recipientName || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-email-${instance.id}`}>
                            {instance.recipientEmail || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={instance.status === "active" ? "default" : "destructive"}
                              className={instance.status === "active" ? "bg-green-500 hover:bg-green-600" : ""}
                              data-testid={`badge-status-${instance.id}`}
                            >
                              {instance.status}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-downloads-${instance.id}`}>
                            {instance.downloadCount}
                          </TableCell>
                          <TableCell data-testid={`text-created-${instance.id}`}>
                            {format(new Date(instance.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(instance.id)}
                                data-testid={`button-download-${instance.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPushDialog(instance.id)}
                                disabled={instance.status !== "active"}
                                data-testid={`button-push-${instance.id}`}
                              >
                                <Bell className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => revokePassMutation.mutate(instance.id)}
                                disabled={instance.status !== "active" || revokePassMutation.isPending}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-revoke-${instance.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No VIP passes issued yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIssueDialogOpen(true)}
                    data-testid="button-issue-first-pass"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Issue Your First Pass
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner fullScreen={false} className="h-8 w-8" />
                </div>
              ) : notificationHistory && notificationHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Success</TableHead>
                        <TableHead>Failed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notificationHistory.map((notification) => (
                        <TableRow key={notification.id} data-testid={`row-notification-${notification.id}`}>
                          <TableCell data-testid={`text-notification-date-${notification.id}`}>
                            {format(new Date(notification.createdAt), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`badge-target-${notification.id}`}>
                              {notification.targetType === "single" ? "Single Pass" : "All Passes"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate" data-testid={`text-message-${notification.id}`}>
                            {notification.message || "(refresh trigger)"}
                          </TableCell>
                          <TableCell data-testid={`text-sent-count-${notification.id}`}>
                            {notification.sentCount}
                          </TableCell>
                          <TableCell className="text-green-600" data-testid={`text-success-count-${notification.id}`}>
                            {notification.successCount}
                          </TableCell>
                          <TableCell className="text-red-600" data-testid={`text-failed-count-${notification.id}`}>
                            {notification.failedCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications sent yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue New VIP Pass</DialogTitle>
            <DialogDescription>
              Create a new VIP pass for a member. They will receive a .pkpass file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipientName">Recipient Name</Label>
              <Input
                id="recipientName"
                placeholder="John Doe"
                value={newPass.recipientName}
                onChange={(e) => setNewPass({ ...newPass, recipientName: e.target.value })}
                data-testid="input-recipient-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Recipient Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="john@example.com"
                value={newPass.recipientEmail}
                onChange={(e) => setNewPass({ ...newPass, recipientEmail: e.target.value })}
                data-testid="input-recipient-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientPhone">Recipient Phone</Label>
              <Input
                id="recipientPhone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={newPass.recipientPhone}
                onChange={(e) => setNewPass({ ...newPass, recipientPhone: e.target.value })}
                data-testid="input-recipient-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberId">Member ID (optional)</Label>
              <Input
                id="memberId"
                placeholder="MEM-12345"
                value={newPass.memberId}
                onChange={(e) => setNewPass({ ...newPass, memberId: e.target.value })}
                data-testid="input-member-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tierLevel">Tier Level</Label>
              <Select
                value={newPass.tierLevel}
                onValueChange={(value) => setNewPass({ ...newPass, tierLevel: value })}
              >
                <SelectTrigger data-testid="select-tier-level">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gold" data-testid="option-tier-gold">Gold</SelectItem>
                  <SelectItem value="Platinum" data-testid="option-tier-platinum">Platinum</SelectItem>
                  <SelectItem value="Diamond" data-testid="option-tier-diamond">Diamond</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIssueDialogOpen(false)}
              data-testid="button-cancel-issue"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePass}
              disabled={createPassMutation.isPending}
              data-testid="button-confirm-issue"
            >
              {createPassMutation.isPending && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Push Notification</DialogTitle>
            <DialogDescription>
              Send a push notification to trigger a pass refresh on user devices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target</Label>
              <Select
                value={pushTarget}
                onValueChange={(value: "single" | "all") => {
                  setPushTarget(value);
                  if (value === "all") setSelectedPassId(null);
                }}
              >
                <SelectTrigger data-testid="select-push-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-target-all">All Active Passes</SelectItem>
                  <SelectItem value="single" data-testid="option-target-single">Single Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pushTarget === "single" && (
              <div className="space-y-2">
                <Label>Select Pass</Label>
                <Select
                  value={selectedPassId || ""}
                  onValueChange={(value) => setSelectedPassId(value)}
                >
                  <SelectTrigger data-testid="select-pass-instance">
                    <SelectValue placeholder="Select a pass" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances?.filter(i => i.status === "active").map((instance) => (
                      <SelectItem key={instance.id} value={instance.id} data-testid={`option-pass-${instance.id}`}>
                        {instance.recipientName || instance.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pushMessage">Message (optional)</Label>
              <Input
                id="pushMessage"
                placeholder="Pass updated - check your wallet"
                value={pushMessage}
                onChange={(e) => setPushMessage(e.target.value)}
                data-testid="input-push-message"
              />
              <p className="text-xs text-muted-foreground">
                APNs for Wallet passes triggers a refresh. Message is for logging purposes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPushDialogOpen(false)}
              data-testid="button-cancel-push"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendPush}
              disabled={sendPushMutation.isPending || (pushTarget === "single" && !selectedPassId)}
              data-testid="button-confirm-push"
            >
              {sendPushMutation.isPending && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
