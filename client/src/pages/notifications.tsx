import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Trash2, CheckCircle, AlertTriangle, AlertCircle, Info, MessageSquare, LogIn } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>("all");
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/notifications"],
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification Deleted",
        description: "The notification has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete notification.",
        variant: "destructive",
      });
    },
  });

  const markAllNotificationsAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notifications Marked as Read",
        description: "All notifications have been marked as read.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notifications as read.",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive",
      });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case "sms_received":
        return <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case "user_login":
        return <LogIn className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Center</h1>
          <p className="text-muted-foreground">View and manage all your notifications</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Your recent activity and alerts
                </CardDescription>
              </div>
              {notificationsData && notificationsData.notifications.filter((n: any) => !n.isRead).length > 0 && (
                <Button
                  onClick={() => markAllNotificationsAsReadMutation.mutate()}
                  disabled={markAllNotificationsAsReadMutation.isPending}
                  data-testid="button-mark-all-read"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark All as Read
                </Button>
              )}
            </div>

            {notificationsData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-semibold">{notificationsData.notifications.length}</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Unread</p>
                  <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                    {notificationsData.notifications.filter((n: any) => !n.isRead).length}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">Read</p>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {notificationsData.notifications.filter((n: any) => n.isRead).length}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground">This Week</p>
                  <p className="text-2xl font-semibold">
                    {notificationsData.notifications.filter((n: any) => {
                      const date = new Date(n.createdAt);
                      const weekAgo = new Date();
                      weekAgo.setDate(weekAgo.getDate() - 7);
                      return date >= weekAgo;
                    }).length}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={notificationSearch}
                  onChange={(e) => setNotificationSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-notifications"
                />
              </div>
              <select
                value={notificationTypeFilter}
                onChange={(e) => setNotificationTypeFilter(e.target.value)}
                className="flex h-10 w-full md:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="select-notification-type"
              >
                <option value="all">All Types</option>
                <option value="sms_received">SMS</option>
                <option value="user_login">Login</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="info">Info</option>
              </select>
              <select
                value={notificationStatusFilter}
                onChange={(e) => setNotificationStatusFilter(e.target.value)}
                className="flex h-10 w-full md:w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="select-notification-status"
              >
                <option value="all">All Status</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingNotifications ? (
            <LoadingSpinner message="Loading notifications..." fullScreen={false} />
          ) : !notificationsData || notificationsData.notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No notifications yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You'll see notifications about your account activity here.
              </p>
            </div>
          ) : (() => {
            const filtered = notificationsData.notifications.filter((notification: any) => {
              const searchLower = notificationSearch.toLowerCase();
              const matchesSearch = !notificationSearch || 
                notification.title.toLowerCase().includes(searchLower) ||
                (notification.message && notification.message.toLowerCase().includes(searchLower));
              
              const matchesType = notificationTypeFilter === "all" || 
                notification.type === notificationTypeFilter ||
                (notificationTypeFilter === "sms_received" && notification.title.toLowerCase().includes('sms'));
              
              const matchesStatus = notificationStatusFilter === "all" ||
                (notificationStatusFilter === "read" && notification.isRead) ||
                (notificationStatusFilter === "unread" && !notification.isRead);

              return matchesSearch && matchesType && matchesStatus;
            });

            if (filtered.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No matching notifications</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search or filters.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filtered.map((notification: any) => {
                  const isUnread = !notification.isRead;
                  
                  return (
                    <div 
                      key={notification.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        isUnread 
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" 
                          : "bg-card border-border hover:bg-muted/50"
                      }`}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className={`text-sm font-medium ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
                                {notification.title}
                              </h4>
                              {notification.message && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {notification.message}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isUnread && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markAsReadMutation.mutate(notification.id)}
                                  className="h-8 w-8 p-0"
                                  title="Mark as read"
                                  data-testid={`button-mark-read-${notification.id}`}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setNotificationToDelete(notification.id);
                                  setDeleteDialogOpen(true);
                                }}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title="Delete notification"
                                disabled={deleteNotificationMutation.isPending}
                                data-testid={`button-delete-${notification.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(notification.createdAt).toLocaleDateString()} at {new Date(notification.createdAt).toLocaleTimeString()}
                            </span>
                            {notification.isRead && notification.readAt && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                Read on {new Date(notification.readAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-notification">
          <DialogHeader>
            <DialogTitle>Delete Notification</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this notification? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (notificationToDelete) {
                  deleteNotificationMutation.mutate(notificationToDelete);
                  setDeleteDialogOpen(false);
                }
              }}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
