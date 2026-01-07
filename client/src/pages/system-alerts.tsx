import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Bell, Send, AlertCircle, Info, CheckCircle, AlertTriangle, RefreshCw, History, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const broadcastSchema = z.object({
  type: z.enum(["info", "success", "warning", "error"]),
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  message: z.string().min(1, "Message is required").max(500, "Message must be less than 500 characters"),
  link: z.string().optional(),
});

type BroadcastForm = z.infer<typeof broadcastSchema>;

interface BroadcastHistory {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  sentBy: string;
  totalRecipients: number;
  totalRead: number;
  createdAt: string;
}

export default function SystemAlerts() {
  const { toast } = useToast();
  const [previewType, setPreviewType] = useState<string>("info");

  // Fetch broadcast history
  const { data: historyData, isLoading: isLoadingHistory } = useQuery<{ broadcasts: BroadcastHistory[] }>({
    queryKey: ["/api/notifications/broadcast/history"],
  });

  const form = useForm<BroadcastForm>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: {
      type: "info",
      title: "",
      message: "",
      link: "",
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async (data: BroadcastForm) => {
      return await apiRequest("POST", "/api/notifications/broadcast", data) as Promise<{ success: boolean; count: number; message: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Broadcast Sent Successfully",
        description: data.message,
        duration: 3000,
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/broadcast/history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Broadcast Failed",
        description: error.message || "Failed to send broadcast notification",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest("POST", `/api/notifications/broadcast/${broadcastId}/resend`, {}) as Promise<{ success: boolean; count: number; message: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Broadcast Resent Successfully",
        description: data.message,
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/broadcast/history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Resend Failed",
        description: error.message || "Failed to resend broadcast notification",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest("DELETE", `/api/notifications/broadcast/${broadcastId}`, {}) as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Broadcast Deleted",
        description: data.message,
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/broadcast/history"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete broadcast",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const onSubmit = (data: BroadcastForm) => {
    broadcastMutation.mutate(data);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Broadcast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Type</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setPreviewType(value);
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-notification-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., System Maintenance Scheduled"
                          maxLength={200}
                          data-testid="input-notification-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Message</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter the notification message here..."
                          rows={3}
                          maxLength={500}
                          data-testid="textarea-notification-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Link (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="/dashboard or https://example.com"
                          data-testid="input-notification-link"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={broadcastMutation.isPending}
                  data-testid="button-send-broadcast"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {broadcastMutation.isPending ? "Sending..." : "Send Broadcast"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-3">
              <div className="flex gap-3">
                <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  {getTypeIcon(previewType)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <p className="text-sm font-medium line-clamp-1">
                      {form.watch("title") || "Notification Title"}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        just now
                      </span>
                      <div className="h-1.5 w-1.5 rounded-full bg-destructive"></div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {form.watch("message") || "Your notification message will appear here..."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Section */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle className="text-base">Broadcast History</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/notifications/broadcast/history"] })}
              data-testid="button-refresh-history"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading history...</div>
          ) : !historyData?.broadcasts || historyData.broadcasts.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No broadcasts sent yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Read</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.broadcasts.map((broadcast) => (
                  <TableRow key={broadcast.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(broadcast.type)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{broadcast.title}</TableCell>
                    <TableCell>{broadcast.totalRecipients}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{broadcast.totalRead}</span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round((broadcast.totalRead / broadcast.totalRecipients) * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(broadcast.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resendMutation.mutate(broadcast.id)}
                          disabled={resendMutation.isPending}
                          data-testid={`button-resend-${broadcast.id}`}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resend
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${broadcast.id}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{broadcast.title}"? This will only remove it from history. Users who received this notification will still see it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(broadcast.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
