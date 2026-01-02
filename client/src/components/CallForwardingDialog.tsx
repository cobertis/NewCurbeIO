import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PhoneForwarded, Loader2, DollarSign } from "lucide-react";

const phoneRegex = /^[\d\s\-\(\)\+]+$/;

const callForwardingSchema = z.object({
  enabled: z.boolean(),
  destination: z.string()
    .transform(val => val.replace(/\D/g, ""))
    .refine(val => !val || val.match(/^1?\d{10}$/), {
      message: "Enter a valid US phone number (10 digits)",
    })
    .optional(),
  keepCallerId: z.boolean(),
});

type CallForwardingFormValues = z.infer<typeof callForwardingSchema>;

interface CallForwardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  phoneNumberId: string;
  telnyxPhoneNumberId: string;
  currentSettings?: {
    enabled: boolean;
    destination: string | null;
    keepCallerId: boolean;
  };
  onSuccess?: () => void;
}

export function CallForwardingDialog({
  open,
  onOpenChange,
  phoneNumber,
  phoneNumberId,
  telnyxPhoneNumberId,
  currentSettings,
  onSuccess,
}: CallForwardingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CallForwardingFormValues>({
    resolver: zodResolver(callForwardingSchema),
    defaultValues: {
      enabled: currentSettings?.enabled || false,
      destination: currentSettings?.destination || "",
      keepCallerId: currentSettings?.keepCallerId !== false,
    },
  });

  useEffect(() => {
    if (open && currentSettings) {
      form.reset({
        enabled: currentSettings.enabled,
        destination: currentSettings.destination || "",
        keepCallerId: currentSettings.keepCallerId !== false,
      });
    }
  }, [open, currentSettings, form]);

  const watchEnabled = form.watch("enabled");

  const updateForwardingMutation = useMutation({
    mutationFn: async (data: CallForwardingFormValues) => {
      const response = await apiRequest(
        "POST",
        `/api/telnyx/call-forwarding/${telnyxPhoneNumberId}`,
        {
          enabled: data.enabled,
          destination: data.enabled ? data.destination : null,
          keepCallerId: data.keepCallerId,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Call forwarding updated",
        description: watchEnabled 
          ? "Incoming calls will be forwarded to the specified number."
          : "Call forwarding has been disabled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/numbers"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update call forwarding",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CallForwardingFormValues) => {
    if (data.enabled && !data.destination) {
      form.setError("destination", {
        type: "manual",
        message: "Destination number is required when enabling call forwarding",
      });
      return;
    }
    updateForwardingMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-call-forwarding">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneForwarded className="h-5 w-5" />
            Call Forwarding Settings
          </DialogTitle>
          <DialogDescription>
            Configure call forwarding for <span className="font-semibold">{phoneNumber}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Billing Information</p>
              <p className="mt-1">
                Forwarded calls incur <strong>two charges</strong>: the incoming call rate plus 
                an outbound call rate to the forwarding destination. This covers the cost of 
                routing the call to an external number.
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enable Call Forwarding</FormLabel>
                    <FormDescription>
                      Forward all incoming calls to another phone number
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-call-forwarding-enabled"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchEnabled && (
              <>
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forwarding Destination</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="(555) 123-4567"
                          data-testid="input-forwarding-destination"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the phone number to forward calls to (US numbers only)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="keepCallerId"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Keep Original Caller ID</FormLabel>
                        <FormDescription>
                          Show the original caller's number on forwarded calls. 
                          When disabled, shows your number instead.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-keep-caller-id"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-forwarding"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateForwardingMutation.isPending}
                data-testid="button-save-forwarding"
              >
                {updateForwardingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
