import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export const quoteStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "submitted", label: "Submitted" },
  { value: "converted_to_policy", label: "Converted To Policy" },
];

export const policyStatusOptions = [
  { value: "new", label: "New" },
  { value: "waiting_on_agent", label: "Waiting On Agent" },
  { value: "waiting_for_approval", label: "Waiting For Approval" },
  { value: "updated_by_client", label: "Updated By Client" },
  { value: "completed", label: "Completed" },
  { value: "renewed", label: "Renewed" },
  { value: "canceled", label: "Canceled" },
];

export const documentsStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
];

export const paymentStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "auto_pay", label: "Auto pay" },
  { value: "failed", label: "Failed" },
  { value: "paid", label: "Paid" },
  { value: "not_applicable", label: "Not applicable ($0)" },
];

export const statusFormSchema = z.object({
  status: z.string().min(1, "Status is required"),
  documentsStatus: z.string().min(1, "Documents status is required"),
  paymentStatus: z.string().min(1, "Payment status is required"),
});

export type StatusFormValues = z.infer<typeof statusFormSchema>;

export function useUpdateStatuses(type: "quote" | "policy", id: string) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: StatusFormValues) => {
      const endpoint = type === "quote" 
        ? `/api/quotes/${id}/statuses` 
        : `/api/policies/${id}/statuses`;
      
      return await apiRequest("PATCH", endpoint, data);
    },
    onSuccess: () => {
      if (type === "quote") {
        queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
        queryClient.invalidateQueries({ queryKey: ["/api/quotes", id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
        queryClient.invalidateQueries({ queryKey: ["/api/policies", id, "detail"] });
      }
      
      toast({
        title: "Success",
        description: "Statuses updated successfully",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update statuses",
        variant: "destructive",
        duration: 3000,
      });
    },
  });
}
