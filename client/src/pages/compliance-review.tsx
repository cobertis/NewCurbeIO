import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StepIndicator } from "@/components/compliance/step-indicator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import type { ComplianceApplication } from "@shared/schema";

const steps = [
  { id: "number", label: "Number" },
  { id: "info", label: "Info" },
  { id: "brand", label: "Brand" },
  { id: "campaign", label: "Campaign" },
  { id: "review", label: "Review" },
];


function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export default function ComplianceReview() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/compliance/review/:id");
  const applicationId = params?.id;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: application, isLoading } = useQuery<ComplianceApplication>({
    queryKey: [`/api/compliance/applications/${applicationId}`],
    enabled: !!applicationId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
      toast({
        title: "Application Submitted",
        description: "Your toll-free verification application has been submitted successfully.",
      });
      setLocation("/phone-system");
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-gray-600 dark:text-gray-400">Application not found</p>
        </div>
      </div>
    );
  }

  const sampleMessages = (application.sampleMessages as string[] | null) || [];
  const useCaseLabel = application.smsUseCase || "";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3" data-testid="text-page-title">
            Submit toll-free verification
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            For more information about filling out this form, watch our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-video-guide">
              video guide
            </a>
            {" "}or read our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-support-article">
              support article
            </a>.
          </p>
        </div>

        <StepIndicator currentStep={4} />

        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-6">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                1. Summary
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/compliance/choose-number`)}
                data-testid="button-edit-summary"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Selected number</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {formatPhoneNumber(application.selectedPhoneNumber)} (Two-way SMS, MMS & Calls)
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Brand name</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {application.brandDisplayName || application.businessName || ""}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Contact email address</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {application.contactEmail || ""}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Contact phone</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {formatPhoneNumber(application.contactPhone)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Use case</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {useCaseLabel}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Campaign description</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {application.messageContent || application.campaignDescription || ""}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Opt-in flow description</div>
                <div className="col-span-2 text-gray-900 dark:text-white">
                  {application.optInDescription || ""}
                </div>
              </div>

              {sampleMessages.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-gray-500 dark:text-gray-400">Sample messages</div>
                  <div className="col-span-2">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                      {sampleMessages.map((msg, idx) => (
                        <p key={idx} className="text-gray-900 dark:text-white mb-2 last:mb-0">
                          {msg}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-8">
          <CardContent className="p-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              2. Costs and terms
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-gray-500 dark:text-gray-400">Toll-free verification</div>
                <div className="col-span-2 text-gray-900 dark:text-white">FREE</div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-gray-500 dark:text-gray-400 font-medium">Total</div>
                  <div className="col-span-2 text-gray-900 dark:text-white font-medium">$0.00</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setLocation(`/compliance/campaign/${applicationId}`)}
            data-testid="button-back-bottom"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-submit-form"
          >
            {isSubmitting ? (
              <LoadingSpinner fullScreen={false} />
            ) : (
              "Submit form"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
