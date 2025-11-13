import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertImessageCampaignSchema, type ImessageCampaign, type ContactList } from "@shared/schema";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";

// Form validation schema
const campaignFormSchema = insertImessageCampaignSchema.omit({
  companyId: true,
  status: true,
  scheduleType: true,
  scheduledAt: true,
  createdBy: true,
}).extend({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().optional(),
  messageBody: z.string().min(1, "Message is required").max(500, "Message must be 500 characters or less"),
  targetListId: z.string().optional(),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: ImessageCampaign | null;
  onSuccess?: () => void;
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: CampaignFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!campaign;

  // Fetch contact lists for dropdown
  const { data: listsData } = useQuery<{ lists: ContactList[] }>({
    queryKey: ["/api/contact-lists"],
  });

  const lists = listsData?.lists || [];

  // Form setup
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "",
      messageBody: "",
      targetListId: "all",
    },
  });

  // Update form when campaign changes
  useEffect(() => {
    if (campaign) {
      form.reset({
        name: campaign.name,
        description: campaign.description || "",
        messageBody: campaign.messageBody,
        targetListId: campaign.targetListId || "all",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        messageBody: "",
        targetListId: "all",
      });
    }
  }, [campaign, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CampaignFormValues) =>
      apiRequest("POST", "/api/imessage/campaigns", {
        ...data,
        targetListId: data.targetListId === "all" || !data.targetListId ? null : data.targetListId,
        description: data.description || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign created successfully",
        duration: 3000,
      });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CampaignFormValues) =>
      apiRequest("PATCH", `/api/imessage/campaigns/${campaign?.id}`, {
        ...data,
        targetListId: data.targetListId === "all" || !data.targetListId ? null : data.targetListId,
        description: data.description || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns", campaign?.id] });
      toast({
        title: "Success",
        description: "Campaign updated successfully",
        duration: 3000,
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Form submit handler
  const onSubmit = (data: CampaignFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const messageLength = form.watch("messageBody")?.length || 0;
  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-campaign-form">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit Campaign" : "New Campaign"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your iMessage campaign details"
              : "Create a new iMessage campaign to send messages to contacts"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter campaign name"
                      data-testid="input-campaign-name"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Optional campaign description"
                      data-testid="input-campaign-description"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="messageBody"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Template *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter your message (max 500 characters)"
                      rows={5}
                      className="resize-none"
                      data-testid="input-campaign-message"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <div className="flex justify-between items-center text-sm">
                    <FormMessage />
                    <span
                      className={messageLength > 500 ? "text-destructive" : "text-muted-foreground"}
                      data-testid="text-character-count"
                    >
                      {messageLength}/500
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetListId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target List</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-target-list">
                        <SelectValue placeholder="All Contacts" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Contacts</SelectItem>
                      {lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                {isEditing ? "Update Campaign" : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
