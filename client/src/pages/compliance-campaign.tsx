import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Check, ArrowLeft, ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ComplianceApplication } from "@shared/schema";

const steps = [
  { id: "number", label: "Number" },
  { id: "info", label: "Info" },
  { id: "brand", label: "Brand" },
  { id: "campaign", label: "Campaign" },
  { id: "review", label: "Review" },
];

const smsUseCaseOptions = [
  { value: "2FA", label: "2FA / Authentication" },
  { value: "ACCOUNT_NOTIFICATIONS", label: "Account Notifications" },
  { value: "CUSTOMER_CARE", label: "Customer Care" },
  { value: "DELIVERY_NOTIFICATIONS", label: "Delivery Notifications" },
  { value: "FRAUD_ALERTS", label: "Fraud Alert Messaging" },
  { value: "HIGHER_EDUCATION", label: "Higher Education" },
  { value: "LOW_VOLUME", label: "Low Volume Mixed" },
  { value: "MARKETING", label: "Marketing" },
  { value: "MIXED", label: "Mixed" },
  { value: "POLITICAL", label: "Political" },
  { value: "POLLING_VOTING", label: "Polling and Voting" },
  { value: "PUBLIC_SERVICE", label: "Public Service Announcement" },
  { value: "SECURITY_ALERTS", label: "Security Alerts" },
];

const estimatedVolumeOptions = [
  { value: "1-1000", label: "1 - 1,000 messages/month" },
  { value: "1001-10000", label: "1,001 - 10,000 messages/month" },
  { value: "10001-100000", label: "10,001 - 100,000 messages/month" },
  { value: "100001-250000", label: "100,001 - 250,000 messages/month" },
  { value: "250001-500000", label: "250,001 - 500,000 messages/month" },
  { value: "500001-750000", label: "500,001 - 750,000 messages/month" },
  { value: "750001-1000000", label: "750,001 - 1,000,000 messages/month" },
  { value: "1000001+", label: "1,000,001+ messages/month" },
];

const campaignFormSchema = z.object({
  smsUseCase: z.string().min(1, "Use case is required"),
  messageAudience: z.string().min(1, "This field is required").refine(
    (val) => val.trim().split(/\s+/).length >= 5,
    "Please provide at least 5 words"
  ),
  messageContent: z.string().min(1, "This field is required").refine(
    (val) => val.trim().split(/\s+/).length >= 10,
    "Please provide at least 10 words"
  ),
  estimatedVolume: z.string().min(1, "Estimated volume is required"),
  canadianTraffic: z.string().min(1, "Please select an option"),
  optInDescription: z.string().min(1, "This field is required"),
  optInScreenshotUrl: z.string().optional(),
  optInEvidence: z.string().min(1, "This field is required"),
  smsTermsUrl: z.string().optional(),
  privacyPolicyUrl: z.string().optional(),
  sampleMessages: z.array(z.string().min(1, "Sample message is required")).min(1, "At least one sample message is required"),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

export default function ComplianceCampaign() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/compliance/campaign/:id");
  const applicationId = params?.id;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [openStep, setOpenStep] = useState<number>(1);
  const [step1Complete, setStep1Complete] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);
  const [step3Complete, setStep3Complete] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const { data: application, isLoading } = useQuery<ComplianceApplication>({
    queryKey: [`/api/compliance/applications/${applicationId}`],
    enabled: !!applicationId,
  });

  const currentStep = 3;
  const isTollFree = application?.numberType === "toll_free";
  
  const title = isTollFree 
    ? "Register toll-free texting campaign" 
    : "Register 10DLC texting campaign";

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      smsUseCase: "",
      messageAudience: "",
      messageContent: "",
      estimatedVolume: "",
      canadianTraffic: "",
      optInDescription: "",
      optInScreenshotUrl: "",
      optInEvidence: "",
      smsTermsUrl: "",
      privacyPolicyUrl: "",
      sampleMessages: [""],
    },
  });

  useEffect(() => {
    if (application) {
      if (application.smsUseCase) form.setValue("smsUseCase", application.smsUseCase);
      if (application.messageAudience) form.setValue("messageAudience", application.messageAudience);
      if (application.messageContent) form.setValue("messageContent", application.messageContent);
      if (application.estimatedVolume) form.setValue("estimatedVolume", application.estimatedVolume);
      if (application.canadianTraffic) form.setValue("canadianTraffic", application.canadianTraffic);
      if (application.optInDescription) form.setValue("optInDescription", application.optInDescription);
      if (application.optInScreenshotUrl) form.setValue("optInScreenshotUrl", application.optInScreenshotUrl);
      if (application.optInEvidence) form.setValue("optInEvidence", application.optInEvidence);
      if (application.smsTermsUrl) form.setValue("smsTermsUrl", application.smsTermsUrl);
      if (application.privacyPolicyUrl) form.setValue("privacyPolicyUrl", application.privacyPolicyUrl);
      
      const savedMessages = application.sampleMessages as string[] | null;
      if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
        form.setValue("sampleMessages", savedMessages);
      }
      
      const hasStep1 = application.smsUseCase && application.messageAudience && application.messageContent && application.estimatedVolume && application.canadianTraffic;
      const hasStep2 = application.optInDescription && application.optInEvidence;
      const hasStep3 = savedMessages && savedMessages.length > 0 && savedMessages[0];
      
      if (hasStep1) setStep1Complete(true);
      if (hasStep2) setStep2Complete(true);
      if (hasStep3) setStep3Complete(true);
      
      if (hasStep3) setOpenStep(3);
      else if (hasStep2) setOpenStep(3);
      else if (hasStep1) setOpenStep(2);
    }
  }, [application, form]);

  const autoSaveCurrentStep = async (currentOpenStep: number) => {
    const values = form.getValues();
    try {
      if (currentOpenStep === 1) {
        const { smsUseCase, messageAudience, messageContent, estimatedVolume, canadianTraffic } = values;
        if (smsUseCase || messageAudience || messageContent || estimatedVolume || canadianTraffic) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            smsUseCase,
            messageAudience,
            messageContent,
            estimatedVolume,
            canadianTraffic,
          });
        }
      } else if (currentOpenStep === 2) {
        const { optInDescription, optInScreenshotUrl, optInEvidence, smsTermsUrl, privacyPolicyUrl } = values;
        if (optInDescription || optInEvidence) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            optInDescription,
            optInScreenshotUrl,
            optInEvidence,
            smsTermsUrl,
            privacyPolicyUrl,
          });
        }
      } else if (currentOpenStep === 3) {
        const { sampleMessages } = values;
        if (sampleMessages && sampleMessages.some(m => m)) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            sampleMessages,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
    } catch (error) {
      console.error("Auto-save error:", error);
    }
  };

  const handleStepChange = async (stepNumber: number) => {
    if (openStep !== stepNumber && openStep > 0) {
      await autoSaveCurrentStep(openStep);
    }
    setOpenStep(openStep === stepNumber ? 0 : stepNumber);
  };

  const handleStep1Save = async () => {
    const { smsUseCase, messageAudience, messageContent, estimatedVolume, canadianTraffic } = form.getValues();
    const audienceValid = messageAudience.trim().split(/\s+/).length >= 5;
    const contentValid = messageContent.trim().split(/\s+/).length >= 10;
    
    if (smsUseCase && audienceValid && contentValid && estimatedVolume && canadianTraffic) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          smsUseCase,
          messageAudience,
          messageContent,
          estimatedVolume,
          canadianTraffic,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        setStep1Complete(true);
        setOpenStep(0);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } else {
      form.trigger(["smsUseCase", "messageAudience", "messageContent", "estimatedVolume", "canadianTraffic"]);
    }
  };

  const handleStep2Save = async () => {
    const { optInDescription, optInScreenshotUrl, optInEvidence, smsTermsUrl, privacyPolicyUrl } = form.getValues();
    if (optInDescription && optInEvidence) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          optInDescription,
          optInScreenshotUrl,
          optInEvidence,
          smsTermsUrl,
          privacyPolicyUrl,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        setStep2Complete(true);
        setOpenStep(0);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } else {
      form.trigger(["optInDescription", "optInEvidence"]);
    }
  };

  const handleStep3Save = async () => {
    const { sampleMessages } = form.getValues();
    const hasValidMessage = sampleMessages.some(m => m.trim().length > 0);
    
    if (hasValidMessage) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          sampleMessages: sampleMessages.filter(m => m.trim()),
        });
        queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
        setStep3Complete(true);
        setOpenStep(0);
      } catch (error: any) {
        toast({
          title: "Error saving data",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } else {
      form.trigger(["sampleMessages"]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, GIF, or PDF file",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }
    
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "compliance");
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      form.setValue("optInScreenshotUrl", data.url);
      toast({
        title: "File uploaded",
        description: "Screenshot uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const addSampleMessage = () => {
    const currentMessages = form.getValues("sampleMessages");
    form.setValue("sampleMessages", [...currentMessages, ""]);
  };

  const removeSampleMessage = (index: number) => {
    const currentMessages = form.getValues("sampleMessages");
    if (currentMessages.length > 1) {
      form.setValue("sampleMessages", currentMessages.filter((_, i) => i !== index));
    }
  };

  const updateSampleMessage = (index: number, value: string) => {
    const currentMessages = form.getValues("sampleMessages");
    const updated = [...currentMessages];
    updated[index] = value;
    form.setValue("sampleMessages", updated);
  };

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;
    
    try {
      const values = form.getValues();
      await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
        smsUseCase: values.smsUseCase,
        messageAudience: values.messageAudience,
        messageContent: values.messageContent,
        estimatedVolume: values.estimatedVolume,
        canadianTraffic: values.canadianTraffic,
        optInDescription: values.optInDescription,
        optInScreenshotUrl: values.optInScreenshotUrl,
        optInEvidence: values.optInEvidence,
        smsTermsUrl: values.smsTermsUrl,
        privacyPolicyUrl: values.privacyPolicyUrl,
        sampleMessages: values.sampleMessages.filter(m => m.trim()),
        currentStep: 5,
        status: "step_4_complete",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/compliance/applications/${applicationId}`] });
      toast({
        title: "Campaign saved",
        description: "Your campaign information has been saved.",
      });
      setLocation(`/compliance/review/${applicationId}`);
    } catch (error: any) {
      toast({
        title: "Error saving campaign",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const allStepsComplete = step1Complete && step2Complete && step3Complete;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          onClick={() => setLocation(`/compliance/brand/${applicationId}`)}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6" data-testid="text-page-title">
          {title}
        </h1>

        <div className="flex items-center justify-between mb-8 px-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                  index < currentStep
                    ? "bg-green-600 border-green-600 text-white"
                    : index === currentStep
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                )}
                data-testid={`step-indicator-${index + 1}`}
              >
                {index < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  index <= currentStep
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <Card className="bg-white dark:bg-gray-900 shadow-sm">
          <CardContent className="p-0">
            <Collapsible open={openStep === 1} onOpenChange={() => handleStepChange(1)}>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Step 1: Campaign details
                </span>
                <div className="flex items-center gap-2">
                  {step1Complete && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openStep === 1 && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <div className="space-y-6 mt-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      SMS use case <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("smsUseCase")}
                      onValueChange={(value) => form.setValue("smsUseCase", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-sms-use-case">
                        <SelectValue placeholder="- Select SMS use case -" />
                      </SelectTrigger>
                      <SelectContent>
                        {smsUseCaseOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.smsUseCase && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.smsUseCase.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Who are you sending messages to and why? <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder="Describe your audience and the purpose of your messages (minimum 5 words)"
                      className="mt-1.5 min-h-[100px]"
                      {...form.register("messageAudience")}
                      data-testid="input-message-audience"
                    />
                    {form.formState.errors.messageAudience && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.messageAudience.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Describe the content of your messages <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder="Describe the type of content you will be sending (minimum 10 words)"
                      className="mt-1.5 min-h-[100px]"
                      {...form.register("messageContent")}
                      data-testid="input-message-content"
                    />
                    {form.formState.errors.messageContent && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.messageContent.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Estimated monthly message volume <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("estimatedVolume")}
                      onValueChange={(value) => form.setValue("estimatedVolume", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-estimated-volume">
                        <SelectValue placeholder="- Select estimated volume -" />
                      </SelectTrigger>
                      <SelectContent>
                        {estimatedVolumeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.estimatedVolume && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.estimatedVolume.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Will you be sending messages to Canadian phone numbers? <span className="text-red-500">*</span>
                    </Label>
                    <RadioGroup
                      value={form.watch("canadianTraffic")}
                      onValueChange={(value) => form.setValue("canadianTraffic", value)}
                      className="flex gap-6 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="canadian-yes" data-testid="radio-canadian-yes" />
                        <Label htmlFor="canadian-yes" className="font-normal">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="canadian-no" data-testid="radio-canadian-no" />
                        <Label htmlFor="canadian-no" className="font-normal">No</Label>
                      </div>
                    </RadioGroup>
                    {form.formState.errors.canadianTraffic && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.canadianTraffic.message}</p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-6 bg-blue-600 hover:bg-blue-700"
                  onClick={handleStep1Save}
                  data-testid="button-save-step1"
                >
                  Save and continue
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            <Collapsible open={openStep === 2} onOpenChange={() => handleStepChange(2)}>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Step 2: Opt-in flow
                </span>
                <div className="flex items-center gap-2">
                  {step2Complete && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openStep === 2 && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <div className="space-y-6 mt-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      How do recipients opt in to receive your texts? <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder="Describe how users consent to receive your messages (e.g., web form, checkbox, verbal consent)"
                      className="mt-1.5 min-h-[100px]"
                      {...form.register("optInDescription")}
                      data-testid="input-opt-in-description"
                    />
                    {form.formState.errors.optInDescription && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.optInDescription.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Opt-in screenshot
                    </Label>
                    <div className="mt-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="input-file-upload"
                      />
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                          data-testid="button-upload-file"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingFile ? "Uploading..." : "Upload screenshot"}
                        </Button>
                        {form.watch("optInScreenshotUrl") && (
                          <span className="text-sm text-green-600 dark:text-green-400">
                            File uploaded
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs mt-1">Accepted formats: JPG, PNG, GIF, PDF (max 10MB)</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Supporting opt-in evidence, documentation, or links <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      placeholder="Provide links to your opt-in page, consent language, or other documentation"
                      className="mt-1.5 min-h-[100px]"
                      {...form.register("optInEvidence")}
                      data-testid="input-opt-in-evidence"
                    />
                    {form.formState.errors.optInEvidence && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.optInEvidence.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      SMS terms URL <span className="text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      placeholder="https://www.example.com/sms-terms"
                      className="mt-1.5"
                      {...form.register("smsTermsUrl")}
                      data-testid="input-sms-terms-url"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Privacy policy URL <span className="text-gray-400">(Optional)</span>
                    </Label>
                    <Input
                      placeholder="https://www.example.com/privacy"
                      className="mt-1.5"
                      {...form.register("privacyPolicyUrl")}
                      data-testid="input-privacy-policy-url"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-6 bg-blue-600 hover:bg-blue-700"
                  onClick={handleStep2Save}
                  data-testid="button-save-step2"
                >
                  Save and continue
                </Button>
              </CollapsibleContent>
            </Collapsible>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            <Collapsible open={openStep === 3} onOpenChange={() => handleStepChange(3)}>
              <CollapsibleTrigger className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Step 3: Sample messages
                </span>
                <div className="flex items-center gap-2">
                  {step3Complete && (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={cn("w-5 h-5 text-gray-500 transition-transform", openStep === 3 && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-6 pb-6">
                <p className="text-gray-500 text-sm mt-4 mb-4">
                  Provide sample messages that represent the content you will send to recipients.
                </p>
                <div className="space-y-4">
                  {form.watch("sampleMessages").map((message, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-gray-700 dark:text-gray-300">
                          Sample message {index + 1} {index === 0 && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                          placeholder="Enter a sample message"
                          className="mt-1.5"
                          value={message}
                          onChange={(e) => updateSampleMessage(index, e.target.value)}
                          data-testid={`input-sample-message-${index}`}
                        />
                      </div>
                      {form.watch("sampleMessages").length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-7 text-red-500 hover:text-red-700"
                          onClick={() => removeSampleMessage(index)}
                          data-testid={`button-remove-message-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={addSampleMessage}
                  data-testid="button-add-sample-message"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add another sample message
                </Button>
                <div className="mt-6">
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleStep3Save}
                    data-testid="button-save-step3"
                  >
                    Save and continue
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setLocation(`/compliance/brand/${applicationId}`)}
            data-testid="button-previous"
          >
            Previous step
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit}
            disabled={!allStepsComplete}
            data-testid="button-submit"
          >
            Continue to review
          </Button>
        </div>
      </div>
    </div>
  );
}
