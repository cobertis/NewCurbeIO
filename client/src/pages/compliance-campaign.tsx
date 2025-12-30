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
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ArrowLeft, ChevronDown, Plus, Trash2, Upload, ChevronsUpDown, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { StepIndicator } from "@/components/compliance/step-indicator";
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
  { value: "2FA", label: "2FA" },
  { value: "App Notifications", label: "App Notifications" },
  { value: "Appointments", label: "Appointments" },
  { value: "Auctions", label: "Auctions" },
  { value: "Auto Repair Services", label: "Auto Repair Services" },
  { value: "Bank Transfers", label: "Bank Transfers" },
  { value: "Billing", label: "Billing" },
  { value: "Booking Confirmations", label: "Booking Confirmations" },
  { value: "Business Updates", label: "Business Updates" },
  { value: "COVID-19 Alerts", label: "COVID-19 Alerts" },
  { value: "Career Training", label: "Career Training" },
  { value: "Chatbot", label: "Chatbot" },
  { value: "Conversational / Alerts", label: "Conversational / Alerts" },
  { value: "Courier Services & Deliveries", label: "Courier Services & Deliveries" },
  { value: "Emergency Alerts", label: "Emergency Alerts" },
  { value: "Events & Planning", label: "Events & Planning" },
  { value: "Financial Services", label: "Financial Services" },
  { value: "Fraud Alerts", label: "Fraud Alerts" },
  { value: "Fundraising", label: "Fundraising" },
  { value: "General Marketing", label: "General Marketing" },
  { value: "General School Updates", label: "General School Updates" },
  { value: "HR / Staffing", label: "HR / Staffing" },
  { value: "Healthcare Alerts", label: "Healthcare Alerts" },
  { value: "Housing Community Updates", label: "Housing Community Updates" },
  { value: "Insurance Services", label: "Insurance Services" },
  { value: "Job Dispatch", label: "Job Dispatch" },
  { value: "Legal Services", label: "Legal Services" },
  { value: "Mixed", label: "Mixed" },
  { value: "Motivational Reminders", label: "Motivational Reminders" },
  { value: "Notary Notifications", label: "Notary Notifications" },
  { value: "Order Notifications", label: "Order Notifications" },
  { value: "Political", label: "Political" },
  { value: "Public Works", label: "Public Works" },
  { value: "Real Estate Services", label: "Real Estate Services" },
  { value: "Religious Services", label: "Religious Services" },
  { value: "Repair and Diagnostics Alerts", label: "Repair and Diagnostics Alerts" },
  { value: "Rewards Program", label: "Rewards Program" },
  { value: "Surveys", label: "Surveys" },
  { value: "System Alerts", label: "System Alerts" },
  { value: "Voting Reminders", label: "Voting Reminders" },
  { value: "Waitlist Alerts", label: "Waitlist Alerts" },
  { value: "Webinar Reminders", label: "Webinar Reminders" },
  { value: "Workshop Alerts", label: "Workshop Alerts" },
];

const estimatedVolumeOptions = [
  { value: "10", label: "10 messages/month" },
  { value: "100", label: "100 messages/month" },
  { value: "1,000", label: "1,000 messages/month" },
  { value: "10,000", label: "10,000 messages/month" },
  { value: "100,000", label: "100,000 messages/month" },
  { value: "250,000", label: "250,000 messages/month" },
  { value: "500,000", label: "500,000 messages/month" },
  { value: "750,000", label: "750,000 messages/month" },
  { value: "1,000,000", label: "1,000,000 messages/month" },
  { value: "5,000,000", label: "5,000,000 messages/month" },
  { value: "10,000,000+", label: "10,000,000+ messages/month" },
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
  additionalInformation: z.string().optional(),
  
  entityType: z.string().min(1, "Please select the legal form of your organization"),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

export default function ComplianceCampaign() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/compliance/campaign/:id");
  const applicationId = params?.id;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [openStep, setOpenStep] = useState<number>(1);
  const [hasInitializedOpenStep, setHasInitializedOpenStep] = useState(false);
  const [step1Complete, setStep1Complete] = useState(false);
  const [step2Complete, setStep2Complete] = useState(false);
  const [step3Complete, setStep3Complete] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [useCaseOpen, setUseCaseOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
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
      additionalInformation: "",
      
      entityType: "",
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
      if (application.additionalInformation) form.setValue("additionalInformation", application.additionalInformation);
      
      if (application.entityType) form.setValue("entityType", application.entityType);
      
      const savedMessages = application.sampleMessages as string[] | null;
      if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
        form.setValue("sampleMessages", savedMessages);
      }
      
      const hasStep1 = application.smsUseCase && application.messageAudience && application.messageContent && application.estimatedVolume && application.canadianTraffic && application.entityType;
      const hasStep2 = application.optInDescription && application.optInEvidence;
      const hasStep3 = savedMessages && savedMessages.length > 0 && savedMessages[0];
      
      if (hasStep1) setStep1Complete(true);
      if (hasStep2) setStep2Complete(true);
      if (hasStep3) setStep3Complete(true);
      
      // Only set the initial open step once to prevent overriding user clicks
      if (!hasInitializedOpenStep) {
        if (hasStep3) setOpenStep(3);
        else if (hasStep2) setOpenStep(2);
        else if (hasStep1) setOpenStep(2);
        setHasInitializedOpenStep(true);
      }
    }
  }, [application, form, hasInitializedOpenStep]);

  const autoSaveCurrentStep = async (currentOpenStep: number) => {
    const values = form.getValues();
    try {
      if (currentOpenStep === 1) {
        const { smsUseCase, messageAudience, messageContent, estimatedVolume, canadianTraffic, entityType, additionalInformation } = values;
        if (smsUseCase || messageAudience || messageContent || estimatedVolume || canadianTraffic || entityType) {
          await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
            smsUseCase,
            messageAudience,
            messageContent,
            estimatedVolume,
            canadianTraffic,
            entityType,
            additionalInformation,
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
    const { smsUseCase, messageAudience, messageContent, estimatedVolume, canadianTraffic, entityType, additionalInformation } = form.getValues();
    const audienceValid = messageAudience.trim().split(/\s+/).length >= 5;
    const contentValid = messageContent.trim().split(/\s+/).length >= 10;
    
    if (smsUseCase && audienceValid && contentValid && estimatedVolume && canadianTraffic && entityType) {
      try {
        await apiRequest("PATCH", `/api/compliance/applications/${applicationId}`, {
          smsUseCase,
          messageAudience,
          messageContent,
          estimatedVolume,
          canadianTraffic,
          isvReseller,
          additionalInformation,
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
      form.trigger(["smsUseCase", "messageAudience", "messageContent", "estimatedVolume", "canadianTraffic", "entityType"]);
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
      
      const response = await fetch("/api/compliance/upload", {
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
    if (!isValid) {
      const errors = form.formState.errors;
      const errorFields = Object.keys(errors);
      if (errorFields.length > 0) {
        const step1Fields = ["smsUseCase", "messageAudience", "messageContent", "estimatedVolume", "canadianTraffic", "entityType"];
        const step2Fields = ["optInDescription", "optInEvidence"];
        const step3Fields = ["sampleMessages"];
        
        const hasStep1Errors = errorFields.some(f => step1Fields.includes(f));
        const hasStep2Errors = errorFields.some(f => step2Fields.includes(f));
        const hasStep3Errors = errorFields.some(f => step3Fields.includes(f));
        
        let errorStep = "";
        if (hasStep1Errors) errorStep = "Step 1";
        else if (hasStep2Errors) errorStep = "Step 2";
        else if (hasStep3Errors) errorStep = "Step 3";
        
        toast({
          title: "Please complete all required fields",
          description: errorStep ? `Check ${errorStep} for missing information` : "Some required fields are missing",
          variant: "destructive",
        });
        
        if (hasStep1Errors) setOpenStep(1);
        else if (hasStep2Errors) setOpenStep(2);
        else if (hasStep3Errors) setOpenStep(3);
      }
      return;
    }
    
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
        additionalInformation: values.additionalInformation,
        entityType: values.entityType,
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3" data-testid="text-page-title">
            {title}
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

        <StepIndicator currentStep={3} />

        <Card className="bg-white dark:bg-gray-900 shadow-sm">
          <CardContent className="p-0">
            <Collapsible open={openStep === 1}>
              <div 
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => handleStepChange(1)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleStepChange(1)}
              >
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
              </div>
              <CollapsibleContent className="px-6 pb-6">
                <div className="space-y-6 mt-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      SMS use case <span className="text-red-500">*</span>
                    </Label>
                    <Popover open={useCaseOpen} onOpenChange={setUseCaseOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={useCaseOpen}
                          className="w-full justify-between mt-1.5 font-normal"
                          data-testid="select-sms-use-case"
                        >
                          {form.watch("smsUseCase")
                            ? smsUseCaseOptions.find((option) => option.value === form.watch("smsUseCase"))?.label
                            : "- Select SMS use case -"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search use case..." />
                          <CommandList>
                            <CommandEmpty>No use case found.</CommandEmpty>
                            <CommandGroup>
                              {smsUseCaseOptions.map((option) => (
                                <CommandItem
                                  key={option.value}
                                  value={option.label}
                                  onSelect={() => {
                                    form.setValue("smsUseCase", option.value);
                                    setUseCaseOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      form.watch("smsUseCase") === option.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {option.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {form.formState.errors.smsUseCase && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.smsUseCase.message}</p>
                    )}
                  </div>

                  {form.watch("smsUseCase") && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                            Need help with your campaign content?
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                            Our AI assistant can generate compliant descriptions and sample messages for your "{smsUseCaseOptions.find(o => o.value === form.watch("smsUseCase"))?.label}" campaign.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
                            disabled={aiLoading}
                            data-testid="button-ai-assist"
                            onClick={async () => {
                              if (!applicationId) return;
                              setAiLoading(true);
                              try {
                                const result = await apiRequest("POST", `/api/compliance/applications/${applicationId}/campaign-assist`, {
                                  smsUseCase: form.watch("smsUseCase")
                                });
                                
                                if (result.messageAudience) {
                                  form.setValue("messageAudience", result.messageAudience);
                                }
                                if (result.messageContent) {
                                  form.setValue("messageContent", result.messageContent);
                                }
                                if (result.estimatedVolume) {
                                  form.setValue("estimatedVolume", result.estimatedVolume);
                                }
                                if (result.optInDescription) {
                                  form.setValue("optInDescription", result.optInDescription);
                                }
                                if (result.sampleMessages && Array.isArray(result.sampleMessages) && result.sampleMessages.length > 0) {
                                  form.setValue("sampleMessages", result.sampleMessages);
                                }
                                
                                toast({
                                  title: "Content generated",
                                  description: "AI-suggested content has been filled in. Please review and customize as needed.",
                                });
                              } catch (error) {
                                console.error("AI assist error:", error);
                                toast({
                                  title: "Generation failed",
                                  description: "Could not generate content. Please fill in the fields manually.",
                                  variant: "destructive",
                                });
                              } finally {
                                setAiLoading(false);
                              }
                            }}
                          >
                            {aiLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                Generate with AI
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

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

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      What type of legal form is the organization? <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.watch("entityType")}
                      onValueChange={(value) => form.setValue("entityType", value)}
                    >
                      <SelectTrigger className="mt-1.5" data-testid="select-entity-type">
                        <SelectValue placeholder="Select organization type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Private Company">Private Company</SelectItem>
                        <SelectItem value="Publicly Traded Company">Publicly Traded Company</SelectItem>
                        <SelectItem value="Charity/ Non-Profit Organization">Charity/ Non-Profit Organization</SelectItem>
                        <SelectItem value="Sole Proprietor">Sole Proprietor</SelectItem>
                        <SelectItem value="Government">Government</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.entityType && (
                      <p className="text-red-500 text-sm mt-1">{form.formState.errors.entityType.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">
                      Additional Information (Optional)
                    </Label>
                    <Textarea
                      placeholder="Any additional information about your messaging campaign"
                      className="mt-1.5 min-h-[80px]"
                      {...form.register("additionalInformation")}
                      data-testid="input-additional-info"
                    />
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

            <Collapsible open={openStep === 2}>
              <div 
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => handleStepChange(2)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleStepChange(2)}
              >
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
              </div>
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

            <Collapsible open={openStep === 3}>
              <div 
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => handleStepChange(3)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleStepChange(3)}
              >
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
              </div>
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
            data-testid="button-submit"
          >
            Continue to review
          </Button>
        </div>
      </div>
    </div>
  );
}
