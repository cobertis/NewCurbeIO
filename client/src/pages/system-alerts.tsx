import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Send, AlertCircle, Info, CheckCircle, AlertTriangle } from "lucide-react";

const broadcastSchema = z.object({
  type: z.enum(["info", "success", "warning", "error"]),
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  message: z.string().min(1, "Message is required").max(500, "Message must be less than 500 characters"),
  link: z.string().optional(),
});

type BroadcastForm = z.infer<typeof broadcastSchema>;

export default function SystemAlerts() {
  const { toast } = useToast();
  const [previewType, setPreviewType] = useState<string>("info");

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
      const response = await apiRequest("POST", "/api/notifications/broadcast", data);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to send broadcast" }));
        throw new Error(errorData.message || "Failed to send broadcast notification");
      }
      
      return response.json() as Promise<{ success: boolean; count: number; message: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Broadcast Sent Successfully",
        description: data.message,
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Broadcast Failed",
        description: error.message || "Failed to send broadcast notification",
        variant: "destructive",
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
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <Card>
          <CardHeader>
            <CardTitle>Create Broadcast Notification</CardTitle>
            <CardDescription>
              This notification will be sent to all active users in the system immediately
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notification Type</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setPreviewType(value);
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-notification-type">
                            <SelectValue placeholder="Select notification type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the type of notification to send
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., System Maintenance Scheduled"
                          maxLength={200}
                          data-testid="input-notification-title"
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value.length}/200 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter the notification message here..."
                          rows={4}
                          maxLength={500}
                          data-testid="textarea-notification-message"
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value.length}/500 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="/dashboard or https://example.com"
                          data-testid="input-notification-link"
                        />
                      </FormControl>
                      <FormDescription>
                        Optional URL to navigate when notification is clicked
                      </FormDescription>
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
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This is how the notification will appear to users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4">
              <div className="flex gap-3">
                <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  {getTypeIcon(form.watch("type") || "info")}
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

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-medium">Tips for Effective Notifications</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Keep titles concise and descriptive</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Use the appropriate notification type for context</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Provide a link for actionable notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Test the message clarity before sending</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
