import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  Phone, 
  Mail, 
  MessageSquare, 
  ChevronRight, 
  Check,
  ExternalLink,
  HelpCircle,
  Smartphone,
  Send,
  Settings,
  Plus,
  CreditCard,
  Clock,
  FileText,
  Shield,
  Calendar,
  DollarSign,
  Video,
  Loader2,
  Copy,
  X,
  Globe,
  Headphones,
  Building2,
  ArrowRight,
  SkipForward
} from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  onboardingCompleted: boolean;
  sipEnabled?: boolean;
  role?: string;
}

interface OnboardingProgress {
  profileCompleted: boolean;
  planSelected: boolean;
  phoneSetup: boolean;
  emailSetup: boolean;
  messagingSetup: boolean;
  otherCompleted?: boolean;
  allComplete: boolean;
  skippedOnboardingSteps?: string[];
}

export default function GettingStarted() {
  const [, setLocation] = useLocation();
  const [activeAccordion, setActiveAccordion] = useState<string | undefined>("profile");
  const [showNumberTypeDialog, setShowNumberTypeDialog] = useState(false);
  const [showCallSetupDialog, setShowCallSetupDialog] = useState(false);

  const { data: sessionData, isLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: progressData } = useQuery<OnboardingProgress>({
    queryKey: ["/api/onboarding/progress"],
    enabled: !!sessionData?.user,
  });

  const { data: complianceData } = useQuery<{ application: any }>({
    queryKey: ["/api/compliance/applications/active"],
    enabled: !!sessionData?.user,
  });

  const { data: subscriptionData } = useQuery<{ subscription: any }>({
    queryKey: ["/api/billing/subscription"],
    enabled: !!sessionData?.user && sessionData?.user?.role === "admin",
  });

  const activeApplication = complianceData?.application;
  const subscription = subscriptionData?.subscription;
  const selectedPlan = subscription?.plan;
  const { toast } = useToast();

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/onboarding/complete");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
      window.location.href = "/";
    },
    onError: (error: any) => {
      console.error("[Onboarding] Complete failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete onboarding",
        variant: "destructive",
      });
    },
  });

  const [browserCallingSuccess, setBrowserCallingSuccess] = useState<{ extension: string } | null>(null);

  const enableBrowserCallingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/onboarding/enable-browser-calling");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/webrtc/extension-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
      setBrowserCallingSuccess({ extension: data.extension });
    },
    onError: (error: any) => {
      toast({
        title: "Setup failed",
        description: error.message || "Please ensure your phone system is configured first.",
        variant: "destructive",
      });
    },
  });

  const skipStepMutation = useMutation({
    mutationFn: async ({ step, skip }: { step: string; skip: boolean }) => {
      return await apiRequest("POST", "/api/onboarding/skip-step", { step, skip });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update step status",
        variant: "destructive",
      });
    },
  });

  const user = sessionData?.user;
  const progress = progressData || {
    profileCompleted: false, // Requires user info + company address, determined by backend
    planSelected: false,
    phoneSetup: false,
    emailSetup: false,
    messagingSetup: false,
    otherCompleted: false,
    allComplete: false,
    skippedOnboardingSteps: [],
  };

  const skippedSteps = progress.skippedOnboardingSteps || [];

  const isStepSkipped = (step: string) => skippedSteps.includes(step);

  const handleSkipStep = (step: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isCurrentlySkipped = isStepSkipped(step);
    skipStepMutation.mutate({ step, skip: !isCurrentlySkipped });
  };

  // Auto-open the next incomplete step
  useEffect(() => {
    if (!progress.profileCompleted) {
      setActiveAccordion("profile");
    } else if (!progress.planSelected) {
      setActiveAccordion("plan");
    } else if (!progress.messagingSetup) {
      setActiveAccordion("sms");
    } else if (!progress.emailSetup) {
      setActiveAccordion("email");
    } else {
      setActiveAccordion("other");
    }
  }, [progress.profileCompleted, progress.planSelected, progress.messagingSetup, progress.emailSetup]);

  // Auto-complete onboarding when all steps are done
  useEffect(() => {
    if (progress.allComplete && !completeOnboardingMutation.isPending) {
      completeOnboardingMutation.mutate();
    }
  }, [progress.allComplete]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Welcome to Curbe!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Let's get you set up with all your communication channels in just a few steps.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-3" value={activeAccordion} onValueChange={setActiveAccordion}>
          <AccordionItem value="profile" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]>div>svg]:rotate-0" data-testid="accordion-profile">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Complete your profile</span>
                  {progress.profileCompleted && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ml-2">
                      <Check className="w-3 h-3 mr-1" />
                      {isStepSkipped('profile') ? 'Skipped' : 'Completed'}
                    </Badge>
                  )}
                </div>
                {!progress.profileCompleted && (
                  <button
                    onClick={(e) => handleSkipStep('profile', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                    data-testid="button-skip-profile"
                  >
                    <SkipForward className="w-3 h-3" />
                    Mark complete
                  </button>
                )}
                {progress.profileCompleted && isStepSkipped('profile') && (
                  <button
                    onClick={(e) => handleSkipStep('profile', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    data-testid="button-unskip-profile"
                  >
                    Undo
                  </button>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="pl-11">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Add your personal details to personalize your experience and help your team identify you.
                </p>
                <Button
                    size="sm"
                    onClick={() => setLocation("/settings/profile")}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                    data-testid="button-complete-profile"
                  >
                    {progress.profileCompleted ? "Edit profile" : "Complete profile"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="plan" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline" data-testid="accordion-plan">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Select a plan</span>
                  <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 ml-2">
                    <Gift className="w-3 h-3 mr-1" />
                    14-day free trial
                  </Badge>
                  {progress.planSelected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ml-2">
                      <Check className="w-3 h-3 mr-1" />
                      {isStepSkipped('plan') ? 'Skipped' : 'Completed'}
                    </Badge>
                  )}
                </div>
                {!progress.planSelected && (
                  <button
                    onClick={(e) => handleSkipStep('plan', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                    data-testid="button-skip-plan"
                  >
                    <SkipForward className="w-3 h-3" />
                    Mark complete
                  </button>
                )}
                {progress.planSelected && isStepSkipped('plan') && (
                  <button
                    onClick={(e) => handleSkipStep('plan', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    data-testid="button-unskip-plan"
                  >
                    Undo
                  </button>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="pl-11">
                {progress.planSelected && selectedPlan ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Your Current Plan</p>
                      {subscription?.status === 'trial' && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                          Trial
                        </Badge>
                      )}
                      {subscription?.status === 'active' && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100" data-testid="text-plan-name">
                        {selectedPlan.name}
                      </h4>
                      <span className="text-gray-500 dark:text-gray-400">
                        ${(selectedPlan.price / 100).toFixed(2)}/month
                      </span>
                    </div>
                    {selectedPlan.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {selectedPlan.description}
                      </p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setLocation("/select-plan")}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                      data-testid="button-select-plan"
                    >
                      Change plan
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Choose the plan that best fits your needs. Start with a 14-day free trial - no credit card required.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setLocation("/select-plan")}
                      className="gap-2 bg-blue-600 hover:bg-blue-700"
                      data-testid="button-select-plan"
                    >
                      Start free trial
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sms" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline" data-testid="accordion-sms">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Phone number</span>
                  {progress.messagingSetup && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ml-2">
                      <Check className="w-3 h-3 mr-1" />
                      {isStepSkipped('sms') ? 'Skipped' : 'Completed'}
                    </Badge>
                  )}
                </div>
                {!progress.messagingSetup && (
                  <button
                    onClick={(e) => handleSkipStep('sms', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                    data-testid="button-skip-sms"
                  >
                    <SkipForward className="w-3 h-3" />
                    Mark complete
                  </button>
                )}
                {progress.messagingSetup && isStepSkipped('sms') && (
                  <button
                    onClick={(e) => handleSkipStep('sms', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    data-testid="button-unskip-sms"
                  >
                    Undo
                  </button>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="space-y-6 pl-11">
                {/* Phone number compliance */}
                <div>
                  {activeApplication?.selectedPhoneNumber ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                          {activeApplication.numberType === '10dlc' ? 'Your 10DLC Number' : 'Your Toll-Free Number'}
                        </p>
                        {!['submitted', 'pending_review', 'approved', 'rejected'].includes(activeApplication.status) && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Registration in progress
                          </Badge>
                        )}
                        {(activeApplication.status === 'submitted' || activeApplication.status === 'pending_review') && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Verification in progress
                          </Badge>
                        )}
                        {activeApplication.status === 'approved' && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <Check className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                        {activeApplication.status === 'rejected' && (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                            <X className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100" data-testid="text-phone-number">
                          {formatPhoneNumber(activeApplication.selectedPhoneNumber)}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => navigator.clipboard.writeText(activeApplication.selectedPhoneNumber)}
                          data-testid="button-copy-number"
                        >
                          <Copy className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {!['submitted', 'pending_review', 'approved', 'rejected'].includes(activeApplication.status) && 
                          (activeApplication.numberType === '10dlc' 
                            ? "We've assigned a 10DLC number to your account. Please complete the registration to start texting."
                            : "We've assigned a toll-free number to your account. Please complete the registration to start texting.")}
                        {(activeApplication.status === 'submitted' || activeApplication.status === 'pending_review') && 
                          (activeApplication.numberType === '10dlc'
                            ? "We've assigned a 10DLC number to your account for 1 month for free. Please complete the verification to start texting."
                            : "We've assigned a toll-free number to your account for 1 month for free, so you can start engaging with your audience sooner. Please complete a free verification to start texting.")}
                        {activeApplication.status === 'approved' && 
                          (activeApplication.numberType === '10dlc'
                            ? "Your 10DLC number is verified and ready to use."
                            : "Your toll-free number is verified and ready to use.")}
                        {activeApplication.status === 'rejected' && 
                          "Your verification was rejected. Please contact support."}
                      </p>
                      <Button 
                          size="sm" 
                          onClick={() => {
                            // For in-progress status, navigate to the correct compliance wizard step
                            const inProgressStatuses = ['draft', 'step_1_complete', 'step_2_complete', 'step_3_complete'];
                            if (inProgressStatuses.includes(activeApplication.status) || !['submitted', 'pending_review', 'approved', 'rejected'].includes(activeApplication.status)) {
                              const appId = activeApplication.id;
                              const step = activeApplication.currentStep || 0;
                              // Step mapping: 0=number, 1=info, 2=brand, 3=campaign, 4=review
                              const stepPaths = [
                                '/compliance/choose-number',
                                `/compliance/info/${appId}`,
                                `/compliance/brand/${appId}`,
                                `/compliance/campaign/${appId}`,
                                `/compliance/review/${appId}`
                              ];
                              setLocation(stepPaths[Math.min(step, 4)]);
                            } else {
                              // For submitted/approved/rejected, go to verification status page
                              const basePath = activeApplication.numberType === '10dlc' 
                                ? "/settings/sms-voice/10dlc-verification" 
                                : "/settings/sms-voice/toll-free-verification";
                              setLocation(basePath);
                            }
                          }}
                          className="gap-2 bg-blue-600 hover:bg-blue-700" 
                          data-testid="button-view-status"
                        >
                          {!['submitted', 'pending_review', 'approved', 'rejected'].includes(activeApplication.status) ? 'Continue registration' : 'View status'}
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Get a dedicated phone number for your business. Choose from toll-free or local numbers.
                      </p>
                      <Button 
                          size="sm" 
                          onClick={() => setShowNumberTypeDialog(true)} 
                          className="gap-2 bg-blue-600 hover:bg-blue-700" 
                          data-testid="button-choose-number"
                        >
                          Choose number
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                    </>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700" />

                {/* Call configuration */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Call configuration</h4>
                    {user?.sipEnabled && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <Check className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {user?.sipEnabled 
                      ? "Your calling is configured. Incoming and outgoing calls will ring directly in your web browser. Add funds to your account to start using the service."
                      : "Set up how you want to handle calls. Choose between direct calling or PBX with IVR options."}
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => setShowCallSetupDialog(true)} 
                    className="gap-2 bg-blue-600 hover:bg-blue-700" 
                    data-testid="button-setup-calling"
                  >
                    {user?.sipEnabled ? "Change configuration" : "Configure calls"}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700" />

                {/* Port existing number */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Port your existing number</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Transfer your current phone number to Curbe.io. Keep your same number while gaining access to all platform features.
                  </p>
                  <Button 
                      size="sm" 
                      onClick={() => setLocation("/settings")} 
                      className="gap-2 bg-blue-600 hover:bg-blue-700" 
                      data-testid="button-connect-provider"
                    >
                      Start porting
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Email campaigns section - hidden, not implemented yet */}

          <AccordionItem value="other" className="border rounded-lg bg-white dark:bg-gray-800 shadow-sm">
            <AccordionTrigger className="px-5 py-4 hover:no-underline" data-testid="accordion-other">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Other channels</span>
                  {progress.otherCompleted && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ml-2">
                      <Check className="w-3 h-3 mr-1" />
                      {isStepSkipped('other') ? 'Skipped' : 'Completed'}
                    </Badge>
                  )}
                </div>
                {!progress.otherCompleted && (
                  <button
                    onClick={(e) => handleSkipStep('other', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                    data-testid="button-skip-other"
                  >
                    <SkipForward className="w-3 h-3" />
                    Mark complete
                  </button>
                )}
                {progress.otherCompleted && isStepSkipped('other') && (
                  <button
                    onClick={(e) => handleSkipStep('other', e)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    data-testid="button-unskip-other"
                  >
                    Undo
                  </button>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5">
              <div className="space-y-6 pl-11">
                {/* iMessage */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">iMessage</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Connect your Apple device to send iMessages.
                  </p>
                  <Button 
                      size="sm" 
                      onClick={() => setLocation("/imessage")} 
                      className="gap-2 bg-blue-600 hover:bg-blue-700" 
                      data-testid="button-setup-imessage"
                    >
                      Set up
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700" />

                {/* WhatsApp */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">WhatsApp Business</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Connect your WhatsApp Business account.
                  </p>
                  <Button 
                      size="sm" 
                      onClick={() => setLocation("/settings")} 
                      className="gap-2 bg-blue-600 hover:bg-blue-700" 
                      data-testid="button-setup-whatsapp"
                    >
                      Connect
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {progress.allComplete && (
          <div className="mt-8 text-center p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
              Setup Complete!
            </h3>
            <p className="text-sm text-green-600 dark:text-green-400 mb-4">
              You've completed all the onboarding steps. Ready to get started?
            </p>
            <Button
              onClick={() => completeOnboardingMutation.mutate()}
              disabled={completeOnboardingMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-complete-onboarding"
            >
              {completeOnboardingMutation.isPending ? "Completing..." : "Continue to Dashboard"}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

              </div>

      {/* Number Type Selection Dialog */}
      <Dialog open={showNumberTypeDialog} onOpenChange={setShowNumberTypeDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-semibold">Choose your texting number type</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-80px)]">
            <div className="p-6 pt-4 space-y-6">
              {/* Two options side by side */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Toll-free Option */}
                <div className="border rounded-lg p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">Toll-free numbers</h3>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
                      70-90% approval rate
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Simple & fast - perfect for getting started quicker with fewer compliance hurdles.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>Up to 5 business days approval</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>Quick 5-10 min form</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>Free to register</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-muted-foreground" />
                      <span>Preferred by Curbe.io customers</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span>Easier compliance</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setShowNumberTypeDialog(false);
                      setLocation("/compliance/choose-number?type=toll-free");
                    }}
                    data-testid="button-choose-toll-free"
                  >
                    Choose Toll-free (Recommended)
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Free for 1 month, later $10.00 / month
                  </p>
                </div>

                {/* 10DLC Option */}
                <div className="border rounded-lg p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">10DLC numbers</h3>
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-0">
                      30-60% approval rate
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Complex process - requires extensive documentation and legal compliance.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>5-10 business days review</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>EIN number & business domain required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>Monthly fee ($10 / mo)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span>Brand + campaign registration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span>SMS terms & privacy pages required</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowNumberTypeDialog(false);
                      setLocation("/compliance/choose-number?type=10dlc");
                    }}
                    data-testid="button-choose-10dlc"
                  >
                    Choose 10DLC (Advanced)
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Free for 1 month, later $10.00 / month
                  </p>
                </div>
              </div>

              {/* Detailed Comparison Table */}
              <div>
                <h4 className="font-semibold mb-4">Detailed comparison</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Aspect</th>
                        <th className="text-left p-3 font-medium">Toll-free verification (free)</th>
                        <th className="text-left p-3 font-medium">10DLC registration</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Number format</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">✓</span>
                            <span className="font-medium">8XX prefix (800-888)</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Professional appearance, works nationwide.</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-red-500">📍</span>
                            <span className="font-medium">Local area code format</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Appears as local number from specific state.</p>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Approval rate (First try)</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">📈</span>
                            <span className="font-medium">70-90%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Simpler process, fewer vetting steps.</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600">⚠️</span>
                            <span className="font-medium">30-60%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Tighter vetting on business, use case, opt-in.</p>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Form complexity</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">🟢</span>
                            <span className="font-medium">Shorter (~5-10 min)</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Business contact, address, website, use-case, sample messages.</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-orange-600">📋</span>
                            <span className="font-medium">Extensive documentation required</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Brand + campaign registration, EIN, terms & opt-in details, legal docs.</p>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Compliance demands</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">🔒</span>
                            <span className="font-medium">Basic requirements</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Explicit opt-in, use-case transparency, sample SMS.</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-red-500">🔴</span>
                            <span className="font-medium">Extensive compliance</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Company legal details, privacy/terms pages, double opt-in, campaign disclosures, legal documentation.</p>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-3 font-medium">Review timeline</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">👍</span>
                            <span className="font-medium">Up to 5 business days</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Most providers offer similar timelines.</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600">⏳</span>
                            <span className="font-medium">5-10 business days</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Brand: near instant; Campaign: manually reviewed by DCA.</p>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium">Cost / fees</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">🎉</span>
                            <span className="font-medium">Free</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">The toll-free verification is free.</p>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600">💰</span>
                            <span className="font-medium">$10 / month</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Monthly fee; extra cost for resubmission.</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Key Takeaways */}
              <div className="border rounded-lg p-5 bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h4 className="font-semibold">Key takeaways</h4>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Toll-free</strong> numbers use 8XX prefixes and work for most use-cases with professional appearance. They're faster to submit and easier to comply with, typically approved within 5 business days. Perfect for most businesses.
                  </p>
                  <p>
                    <strong className="text-foreground">10DLC</strong> numbers appear as local numbers from specific areas but require more rigorous documentation and legal requirements with manual campaign review. Only choose if you need local presence or specialized messaging features.
                  </p>
                  <p>
                    Approval rates reflect this complexity: toll-free is around <strong className="text-foreground">80%</strong>, while 10DLC often falls below <strong className="text-foreground">50%</strong>.
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Call Setup Dialog */}
      <Dialog open={showCallSetupDialog} onOpenChange={(open) => {
        setShowCallSetupDialog(open);
        if (!open) setBrowserCallingSuccess(null);
      }}>
        <DialogContent className="max-w-2xl">
          {browserCallingSuccess ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-green-700 dark:text-green-400">Browser calling enabled</DialogTitle>
              </DialogHeader>
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100">You can now make and receive calls</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Extension <span className="font-mono font-semibold">{browserCallingSuccess.extension}</span> has been configured
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground pt-2">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Inbound calls ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Outbound calls ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>WebRTC configured</span>
                  </div>
                </div>
                <Button 
                  className="mt-4 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setShowCallSetupDialog(false);
                    setBrowserCallingSuccess(null);
                  }}
                  data-testid="button-close-success"
                >
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">How do you want to receive calls?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Choose how you'd like to handle incoming calls to your Curbe number.
            </p>
            
            <div className="grid gap-4">
              {/* Direct Web Calls Option */}
              <div 
                className={`border rounded-lg p-5 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-all ${enableBrowserCallingMutation.isPending ? 'opacity-70 pointer-events-none' : ''}`}
                onClick={() => {
                  if (!enableBrowserCallingMutation.isPending) {
                    enableBrowserCallingMutation.mutate();
                  }
                }}
                data-testid="option-direct-calls"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                    {enableBrowserCallingMutation.isPending ? (
                      <Loader2 className="w-6 h-6 text-green-600 dark:text-green-400 animate-spin" />
                    ) : (
                      <Globe className="w-6 h-6 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {enableBrowserCallingMutation.isPending ? "Setting up..." : "Receive calls directly in the browser"}
                      </h3>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {enableBrowserCallingMutation.isPending 
                        ? "Creating your extension and configuring SIP credentials..."
                        : "Answer calls right from your Curbe dashboard. No additional hardware or software needed."
                      }
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Works instantly</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>No setup required</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-4 h-4 text-green-500" />
                        <span>Call from any device</span>
                      </div>
                    </div>
                  </div>
                  {enableBrowserCallingMutation.isPending ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground shrink-0 mt-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
                  )}
                </div>
              </div>

              {/* PBX Configuration Option */}
              <div 
                className="border rounded-lg p-5 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-all"
                onClick={() => {
                  setShowCallSetupDialog(false);
                  setLocation("/phone-system");
                }}
                data-testid="option-pbx-setup"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Configure a professional PBX system</h3>
                      <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                        Advanced
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Set up IVR menus, call queues, extensions, and advanced call routing for your team.
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Headphones className="w-4 h-4 text-purple-500" />
                        <span>IVR menus</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Headphones className="w-4 h-4 text-purple-500" />
                        <span>Call queues</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Headphones className="w-4 h-4 text-purple-500" />
                        <span>Team extensions</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0 mt-2" />
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground pt-2">
              You can change this setting anytime from Settings.
            </p>
          </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Gift(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}
