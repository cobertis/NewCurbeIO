import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type ImessageCampaign, type ContactList, type CreateCampaignWithDetails } from "@shared/schema";
import { z } from "zod";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Brain,
  Target,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  TrendingUp,
  BarChart3,
  Send,
  Plus,
  X,
  FileText,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit,
  MoreVertical,
  Smile,
  Image,
  Video,
  Mic,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Form schema
const campaignWizardSchema = z.object({
  // Step 1: Template Selection
  templateId: z.string().optional(),
  
  // Step 2: Content Editor
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().optional(),
  messageBody: z.string().min(1, "Message is required").max(500, "Message must be 500 characters or less"),
  mediaUrl: z.string().optional(),
  targetListId: z.string().min(1, "Please select a contact list"),
  
  // Step 3: A/B Testing
  abTestingEnabled: z.boolean().default(false),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    messageBody: z.string().max(500),
    trafficPercentage: z.number().min(0).max(100),
  })).optional(),
  testMetric: z.enum(["response_rate", "conversion_rate", "click_rate"]).optional(),
  minSampleSize: z.number().min(10).optional(),
  
  // Step 4: Schedule & Automation
  scheduleType: z.enum(["immediate", "scheduled", "recurring"]).default("immediate"),
  scheduledAt: z.date().optional(),
  recurringPattern: z.string().optional(),
  throttleEnabled: z.boolean().default(false),
  messagesPerHour: z.number().min(1).max(1000).default(100),
  deliveryWindowStart: z.string().default("09:00"),
  deliveryWindowEnd: z.string().default("17:00"),
  timezone: z.string().default("America/New_York"),
  followUps: z.array(z.object({
    id: z.string(),
    trigger: z.enum(["no_response", "time_delay"]),
    delayHours: z.number().min(1),
    messageBody: z.string().max(500),
  })).default([]),
});

type CampaignWizardFormValues = z.infer<typeof campaignWizardSchema>;

interface CampaignBuilderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingCampaign?: ImessageCampaign | null;
}

export function CampaignBuilderWizard({
  open,
  onOpenChange,
  onSuccess,
  editingCampaign,
}: CampaignBuilderWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const totalSteps = 5;

  // Form setup
  const form = useForm<CampaignWizardFormValues>({
    resolver: zodResolver(campaignWizardSchema),
    defaultValues: {
      name: "",
      description: "",
      messageBody: "",
      mediaUrl: "",
      targetListId: "",
      abTestingEnabled: false,
      variants: [],
      scheduleType: "immediate",
      throttleEnabled: false,
      messagesPerHour: 100,
      deliveryWindowStart: "09:00",
      deliveryWindowEnd: "17:00",
      timezone: "America/New_York",
      followUps: [],
    },
  });

  // Fetch templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ["/api/campaign-studio/templates"],
    enabled: open && currentStep === 1,
  });

  // Fetch categories (always load when wizard is open - needed for template creation)
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/campaign-studio/categories"],
    enabled: open,
  });

  // Fetch placeholders
  const { data: placeholdersData } = useQuery({
    queryKey: ["/api/campaign-studio/placeholders"],
    enabled: open && currentStep === 2,
  });

  // Fetch contact lists
  const { data: listsData } = useQuery<{ lists: ContactList[] }>({
    queryKey: ["/api/contact-lists"],
    enabled: open,
  });

  // Backend returns arrays directly, not wrapped in objects
  const templates = Array.isArray(templatesData) ? templatesData : [];
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const placeholders = Array.isArray(placeholdersData) ? placeholdersData : [];
  const lists = listsData?.lists || [];

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && !editingCampaign) {
      form.reset({
        name: "",
        description: "",
        messageBody: "",
        mediaUrl: "",
        targetListId: "",
        abTestingEnabled: false,
        variants: [],
        scheduleType: "immediate",
        throttleEnabled: false,
        messagesPerHour: 100,
        deliveryWindowStart: "09:00",
        deliveryWindowEnd: "17:00",
        timezone: "America/New_York",
        followUps: [],
      });
      setCurrentStep(1);
      setSelectedTemplate(null);
    } else if (open && editingCampaign) {
      // Load editing campaign data
      form.reset({
        name: editingCampaign.name,
        description: editingCampaign.description || "",
        messageBody: editingCampaign.messageBody,
        targetListId: editingCampaign.targetListId || "",
        scheduleType: "immediate",
        throttleEnabled: false,
        messagesPerHour: 100,
        deliveryWindowStart: "09:00",
        deliveryWindowEnd: "17:00",
        timezone: "America/New_York",
        followUps: [],
      });
    }
  }, [open, editingCampaign, form]);

  // Helper function to extract placeholders from message body
  const extractPlaceholders = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(m => m.replace(/[{}]/g, '').trim());
  };

  // Helper to convert simple recurrence pattern to RFC 5545-like object
  const buildRecurrenceRule = (pattern: string | undefined): Record<string, any> | null => {
    if (!pattern) return null;
    
    // Explicit mapping to RFC 5545-like format (backend expects lowercase after 'by')
    switch (pattern.toLowerCase()) {
      case "daily":
        return {
          frequency: "DAILY",
          interval: 1,
        };
      
      case "weekly":
        return {
          frequency: "WEEKLY",
          interval: 1,
          byweekday: ["MO", "TU", "WE", "TH", "FR"], // lowercase after 'by'
        };
      
      case "biweekly":
        return {
          frequency: "WEEKLY",
          interval: 2,
          byweekday: ["MO", "TU", "WE", "TH", "FR"], // lowercase after 'by'
        };
      
      case "monthly":
        return {
          frequency: "MONTHLY",
          interval: 1,
          bymonthday: [1], // lowercase after 'by'
        };
      
      default:
        return null;
    }
  };

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: (data: CampaignWizardFormValues) => {
      // Build complete payload matching CreateCampaignWithDetails structure
      const payload: CreateCampaignWithDetails = {
        campaign: {
          name: data.name,
          description: data.description || null,
          messageBody: data.messageBody,
          targetListId: data.targetListId,
          templateId: data.templateId || null,
          hasVariants: data.abTestingEnabled || false,
          abTestMetric: data.testMetric || null,
          abTestMinSample: data.minSampleSize || null,
          personalizedFields: extractPlaceholders(data.messageBody),
          complianceScore: null,
        },
        schedule: {
          scheduleType: data.scheduleType || "immediate",
          startDate: data.scheduledAt ? format(data.scheduledAt, "yyyy-MM-dd") : null,
          startTime: data.scheduledAt ? format(data.scheduledAt, "HH:mm") : null,
          timezone: data.timezone || "UTC",
          recurrenceRule: data.scheduleType === "recurring" ? buildRecurrenceRule(data.recurringPattern) : null,
          endDate: null,
          rateLimit: data.throttleEnabled ? data.messagesPerHour : null,
          quietHoursStart: data.deliveryWindowStart || null,
          quietHoursEnd: data.deliveryWindowEnd || null,
          throttleDelayMin: null,
          throttleDelayMax: null,
          respectContactTimezone: false,
        },
        variants: data.abTestingEnabled && data.variants ? data.variants.map((v, index) => ({
          variantLetter: String.fromCharCode(65 + index) as "A" | "B" | "C" | "D" | "E",
          messageBody: v.messageBody,
          mediaUrls: [],
          splitPercentage: v.trafficPercentage,
        })) : [],
        followups: data.followUps ? data.followUps.map((f, index) => ({
          sequence: index + 1,
          triggerType: f.trigger === "no_response" ? "no_response" : "time_delay",
          waitDays: Math.floor((f.delayHours || 0) / 24),
          waitHours: (f.delayHours || 0) % 24,
          messageBody: f.messageBody,
          mediaUrls: [],
          targetSegment: "all",
          isActive: true,
        })) : [],
      };

      if (editingCampaign) {
        return apiRequest("PATCH", `/api/imessage/campaigns/${editingCampaign.id}`, payload);
      } else {
        return apiRequest("POST", "/api/imessage/campaigns", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/imessage/campaigns"] });
      toast({
        title: "Success",
        description: editingCampaign ? "Campaign updated successfully" : "Campaign created successfully",
        duration: 3000,
      });
      onOpenChange(false);
      form.reset();
      setCurrentStep(1);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save campaign",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Navigation handlers
  const handleNext = async () => {
    let isValid = false;

    // Validate current step
    if (currentStep === 1) {
      isValid = true; // Template selection is optional
    } else if (currentStep === 2) {
      isValid = await form.trigger(["name", "messageBody", "targetListId"]);
    } else if (currentStep === 3) {
      isValid = true; // A/B testing is optional
    } else if (currentStep === 4) {
      isValid = await form.trigger(["scheduleType"]);
    } else if (currentStep === 5) {
      isValid = await form.trigger();
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (data: CampaignWizardFormValues) => {
    saveMutation.mutate(data);
  };

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[1024px] h-[90vh] min-w-[1024px] max-w-[1024px] min-h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0" data-testid="dialog-campaign-wizard">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle data-testid="text-wizard-title">
                {editingCampaign ? "Edit Campaign" : "Campaign Builder"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Step {currentStep} of {totalSteps}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-sm" data-testid="badge-step-indicator">
              {currentStep === 1 && "Template Selection"}
              {currentStep === 2 && "Content Editor"}
              {currentStep === 3 && "A/B Testing"}
              {currentStep === 4 && "Schedule & Automation"}
              {currentStep === 5 && "Review & Launch"}
            </Badge>
          </div>
          <Progress value={progressPercentage} className="mt-4" data-testid="progress-wizard" />
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {currentStep === 1 && (
                <TemplateSelectionStep
                  templates={templates}
                  categories={categories}
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={(templateId, template) => {
                    setSelectedTemplate(templateId);
                    if (template) {
                      form.setValue("messageBody", template.messageBody);
                      form.setValue("name", template.name);
                      if (template.description) {
                        form.setValue("description", template.description);
                      }
                    }
                  }}
                  isLoading={loadingTemplates}
                />
              )}

              {currentStep === 2 && (
                <ContentEditorStep
                  form={form}
                  placeholders={placeholders}
                  lists={lists}
                />
              )}

              {currentStep === 3 && (
                <ABTestingStep form={form} />
              )}

              {currentStep === 4 && (
                <ScheduleAutomationStep form={form} />
              )}

              {currentStep === 5 && (
                <ReviewLaunchStep form={form} lists={lists} />
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between w-full">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saveMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>

                <div className="flex items-center gap-2">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      disabled={saveMutation.isPending}
                      data-testid="button-back"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}

                  {currentStep < totalSteps ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      data-testid="button-next"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={saveMutation.isPending}
                      data-testid="button-launch"
                    >
                      {saveMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                      <Send className="h-4 w-4 mr-2" />
                      {editingCampaign ? "Update Campaign" : "Launch Campaign"}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// STEP 1: Template Selection
// =====================================================
interface TemplateSelectionStepProps {
  templates: any[];
  categories: any[];
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string | null, template?: any) => void;
  isLoading: boolean;
}

function TemplateSelectionStep({
  templates,
  categories,
  selectedTemplate,
  onSelectTemplate,
  isLoading,
}: TemplateSelectionStepProps) {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") return templates;
    return templates.filter((t) => t.categoryId === selectedCategory);
  }, [templates, selectedCategory]);

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/campaign-studio/templates", data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-studio/templates"] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      
      // Switch to the category of the newly created template to make it visible
      if (response?.categoryId) {
        setSelectedCategory(response.categoryId);
      } else {
        // If no categoryId, show all templates
        setSelectedCategory("all");
      }
      
      toast({ 
        title: "Template created successfully",
        duration: 3000,
      });
    },
    onError: () => {
      toast({ 
        title: "Failed to create template", 
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/campaign-studio/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-studio/templates"] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaign-studio/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-studio/templates"] });
      setDeletingTemplateId(null);
      toast({ title: "Template deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setIsTemplateDialogOpen(true);
  };

  const handleDeleteTemplate = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingTemplateId(templateId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner message="Loading templates..." fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-2">Choose a Template</h3>
          <p className="text-sm text-muted-foreground">
            Start with a pre-built template or create from scratch
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreateTemplate}
          data-testid="button-create-template"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" data-testid="tab-category-all">All</TabsTrigger>
            {categories.map((cat: any) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                data-testid={`tab-category-${cat.id}`}
              >
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Blank Template Card */}
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-md border-2",
            selectedTemplate === null ? "border-primary bg-primary/5" : "border-border"
          )}
          onClick={() => onSelectTemplate(null)}
          data-testid="card-template-blank"
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Blank Template
                </CardTitle>
                <CardDescription className="mt-1">
                  Start from scratch
                </CardDescription>
              </div>
              {selectedTemplate === null && (
                <Check className="h-5 w-5 text-primary" data-testid="icon-selected-blank" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              Create your own custom message
            </p>
          </CardContent>
        </Card>

        {/* Template Cards */}
        {filteredTemplates.map((template: any) => (
          <Card
            key={template.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md border-2 group relative",
              selectedTemplate === template.id ? "border-primary bg-primary/5" : "border-border"
            )}
            onClick={() => onSelectTemplate(template.id, template)}
            data-testid={`card-template-${template.id}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription className="mt-1">
                      {template.description}
                    </CardDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedTemplate === template.id && (
                    <Check className="h-5 w-5 text-primary" data-testid={`icon-selected-${template.id}`} />
                  )}
                  {/* Allow edit/delete for all templates including system templates */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-menu-${template.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => handleEditTemplate(template, e)}
                        data-testid={`button-edit-${template.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className="text-destructive"
                        data-testid={`button-delete-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {template.categoryName && (
                <Badge variant="secondary" className="mb-2">
                  {template.categoryName}
                </Badge>
              )}
              <p className="text-sm text-muted-foreground line-clamp-3">
                {template.messageBody}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No templates found in this category</p>
        </div>
      )}

      {/* Template Create/Edit Dialog */}
      <TemplateFormDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        template={editingTemplate}
        categories={categories}
        onSave={(data) => {
          if (editingTemplate) {
            updateTemplateMutation.mutate({ id: editingTemplate.id, data });
          } else {
            createTemplateMutation.mutate(data);
          }
        }}
        isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTemplateId} onOpenChange={() => setDeletingTemplateId(null)}>
        <AlertDialogContent data-testid="dialog-delete-template">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingTemplateId) {
                  deleteTemplateMutation.mutate(deletingTemplateId);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteTemplateMutation.isPending && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =====================================================
// Template Form Dialog Component
// =====================================================
interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: any;
  categories: any[];
  onSave: (data: any) => void;
  isLoading: boolean;
}

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  categories,
  onSave,
  isLoading,
}: TemplateFormDialogProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);

  const templateFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    messageBody: z.string().min(1, "Message is required").max(500, "Message too long"),
  });

  const templateForm = useForm({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      messageBody: template?.messageBody || "",
    },
  });

  // Common placeholders for templates
  const commonPlaceholders = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phoneNumber", label: "Phone" },
    { key: "companyName", label: "Company" },
    { key: "policyNumber", label: "Policy #" },
    { key: "agentName", label: "Agent Name" },
  ];

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      templateForm.reset({
        name: template.name,
        description: template.description || "",
        messageBody: template.messageBody,
      });
    } else {
      templateForm.reset({
        name: "",
        description: "",
        messageBody: "",
      });
    }
  }, [template, templateForm]);

  const insertTemplatePlaceholder = (placeholder: string) => {
    const currentText = templateForm.getValues("messageBody") || "";
    templateForm.setValue("messageBody", currentText + `{{${placeholder}}}`);
  };

  const insertTemplateEmoji = (emoji: any) => {
    const currentText = templateForm.getValues("messageBody") || "";
    const textarea = templateTextareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = currentText.substring(0, start) + emoji.native + currentText.substring(end);
      templateForm.setValue("messageBody", newText);
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length;
        textarea.focus();
      }, 0);
    } else {
      templateForm.setValue("messageBody", currentText + emoji.native);
    }
    
    setShowEmojiPicker(false);
  };

  const handleSave = (data: any) => {
    // Get category ID: use existing template category or first available category
    const categoryId = template?.categoryId || categories[0]?.id;
    
    // Validate that we have a category
    if (!categoryId) {
      console.error("No category available for template");
      return;
    }
    
    // Auto-assign category
    const dataWithCategory = {
      ...data,
      categoryId,
    };
    onSave(dataWithCategory);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-template-form">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescription>
            {template ? "Update your template details" : "Create a reusable template for your campaigns"}
          </DialogDescription>
        </DialogHeader>

        <Form {...templateForm}>
          <form onSubmit={templateForm.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={templateForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Welcome Message"
                      data-testid="input-template-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={templateForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description of this template"
                      data-testid="input-template-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={templateForm.control}
              name="messageBody"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Template *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        {...field}
                        ref={templateTextareaRef}
                        placeholder="Enter your message template... Use {{placeholders}} for personalization"
                        rows={6}
                        className="resize-none font-mono text-sm pr-12"
                        data-testid="input-template-message"
                      />
                      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-2 h-8 w-8 p-0"
                            data-testid="button-template-emoji-picker"
                          >
                            <Smile className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0 border-0" align="end">
                          <Picker
                            data={data}
                            onEmojiSelect={insertTemplateEmoji}
                            theme="light"
                            previewPosition="none"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </FormControl>
                  <div className="flex justify-between items-center mt-2">
                    <FormMessage />
                    <span className="text-xs text-muted-foreground">
                      {field.value?.length || 0}/500
                    </span>
                  </div>
                </FormItem>
              )}
            />

            {/* Placeholders for Templates */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Insert Placeholders</Label>
              <div className="flex flex-wrap gap-2">
                {commonPlaceholders.map((p) => (
                  <Button
                    key={p.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertTemplatePlaceholder(p.key)}
                    data-testid={`button-template-placeholder-${p.key}`}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Media Info for Templates */}
            <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-3 rounded border border-amber-200 dark:border-amber-900">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">Media Attachments:</p>
                  <p className="text-amber-800 dark:text-amber-200">
                    You can add images, videos, or audio recordings when you use this template to create a campaign. 
                    Templates store the message text and placeholders only.
                  </p>
                </div>
              </div>
            </div>

            {/* Warning if no categories available */}
            {!template && categories.length === 0 && (
              <div className="text-xs text-muted-foreground bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-200 dark:border-red-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100 mb-1">No Categories Available</p>
                    <p className="text-red-800 dark:text-red-200">
                      Template categories are loading. Please wait a moment and try again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                data-testid="button-cancel-template"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (!template && categories.length === 0)}
                data-testid="button-save-template"
              >
                {isLoading && <LoadingSpinner fullScreen={false} className="mr-2 h-4 w-4" />}
                {template ? "Update Template" : "Create Template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// MEDIA UPLOAD FIELD
// =====================================================
interface MediaUploadFieldProps {
  form: any;
}

function MediaUploadField({ form }: MediaUploadFieldProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaUrl = form.watch("mediaUrl");

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 100MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/heif',
      'video/mp4', 'video/quicktime', 'video/x-m4v',
      'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-caf', 'audio/x-m4a'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select an image, video, or audio file",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // Upload file
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('media', file);

      const response = await fetch('/api/imessage/campaigns/upload-media', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const data = await response.json();
      
      // Update form with uploaded file URL
      form.setValue('mediaUrl', data.mediaUrl);

      toast({
        title: "File uploaded",
        description: `${file.name} uploaded successfully`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
      setSelectedFile(null);
      setPreview(null);
      // Reset file input to allow retry with same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setPreview(null);
    form.setValue('mediaUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        <Image className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Media Attachments (Optional)</Label>
      </div>

      <div className="space-y-3">
        {/* File Input */}
        <div>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleFileSelect}
            disabled={isUploading || !!mediaUrl}
            className="cursor-pointer"
            data-testid="input-media-file"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Upload an image, video, or audio file (max 100MB)
          </p>
        </div>

        {/* Loading State */}
        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner fullScreen={false} className="h-4 w-4" />
            Uploading...
          </div>
        )}

        {/* Preview */}
        {preview && mediaUrl && (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-w-xs rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemove}
              data-testid="button-remove-media"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* File Info (non-image files) */}
        {selectedFile && !preview && mediaUrl && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              {selectedFile.type.startsWith('video/') && <Video className="h-4 w-4" />}
              {selectedFile.type.startsWith('audio/') && <Mic className="h-4 w-4" />}
              <div className="text-sm">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              data-testid="button-remove-media"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Supported Formats Info */}
        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Supported Media Types:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li><strong>Images:</strong> JPG, PNG, GIF, HEIC</li>
                <li><strong>Videos:</strong> MP4, MOV, M4V (max 100MB)</li>
                <li><strong>Audio:</strong> MP3, M4A, WAV, CAF (voice memos)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// STEP 2: Content Editor
// =====================================================
interface ContentEditorStepProps {
  form: any;
  placeholders: any[];
  lists: ContactList[];
}

function ContentEditorStep({ form, placeholders, lists }: ContentEditorStepProps) {
  const messageBody = form.watch("messageBody") || "";
  const messageLength = messageBody.length;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Common placeholders that are always available
  const commonPlaceholders = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phoneNumber", label: "Phone" },
    { key: "companyName", label: "Company" },
    { key: "policyNumber", label: "Policy #" },
    { key: "agentName", label: "Agent Name" },
  ];

  // Merge with backend placeholders, giving priority to backend data
  const allPlaceholders = placeholders.length > 0 ? placeholders : commonPlaceholders;

  // AI Content Coach - Mock Analysis
  const contentAnalysis = useMemo(() => {
    const text = messageBody.toLowerCase();
    
    // Tone analysis
    const professionalWords = ["please", "thank you", "regards", "sincerely", "professional"];
    const casualWords = ["hey", "hi", "thanks", "cool", "awesome"];
    const urgentWords = ["urgent", "asap", "immediately", "now", "hurry"];
    
    const professionalScore = professionalWords.filter(w => text.includes(w)).length;
    const casualScore = casualWords.filter(w => text.includes(w)).length;
    const urgentScore = urgentWords.filter(w => text.includes(w)).length;
    
    let tone = "Professional";
    if (casualScore > professionalScore && casualScore > urgentScore) tone = "Casual";
    if (urgentScore > professionalScore && urgentScore > casualScore) tone = "Urgent";
    
    // Readability score (based on sentence length)
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 
      ? text.split(/\s+/).length / sentences.length 
      : 0;
    const readabilityScore = Math.max(0, Math.min(100, 100 - avgSentenceLength * 2));
    
    // Suggestions
    const suggestions = [];
    if (messageLength > 450) {
      suggestions.push("Consider shortening your message for better readability");
    }
    if (messageLength < 50) {
      suggestions.push("Add more context to make your message clearer");
    }
    if (!text.includes("{{")) {
      suggestions.push("Add personalization using placeholders like {{firstName}}");
    }
    if (sentences.length === 1) {
      suggestions.push("Break your message into multiple sentences for clarity");
    }
    
    return { tone, readabilityScore, suggestions };
  }, [messageBody, messageLength]);

  const insertPlaceholder = (placeholder: string) => {
    const currentText = form.getValues("messageBody") || "";
    form.setValue("messageBody", currentText + `{{${placeholder}}}`);
  };

  const insertEmoji = (emoji: any) => {
    const currentText = form.getValues("messageBody") || "";
    const textarea = textareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = currentText.substring(0, start) + emoji.native + currentText.substring(end);
      form.setValue("messageBody", newText);
      
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length;
        textarea.focus();
      }, 0);
    } else {
      form.setValue("messageBody", currentText + emoji.native);
    }
    
    setShowEmojiPicker(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Create Your Message</h3>
        <p className="text-sm text-muted-foreground">
          Craft your campaign message with AI-powered assistance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign Name *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g., Summer Promotion 2024"
                    data-testid="input-campaign-name"
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
                    placeholder="Optional internal description"
                    data-testid="input-campaign-description"
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
                  <div className="relative">
                    <Textarea
                      {...field}
                      ref={textareaRef}
                      placeholder="Enter your message here..."
                      rows={8}
                      className="resize-none font-mono text-sm pr-12"
                      data-testid="input-message-body"
                    />
                    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-8 w-8 p-0"
                          data-testid="button-emoji-picker"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 border-0" align="end">
                        <Picker
                          data={data}
                          onEmojiSelect={insertEmoji}
                          theme="light"
                          previewPosition="none"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </FormControl>
                <div className="flex justify-between items-center text-sm mt-2">
                  <FormMessage />
                  <span
                    className={cn(
                      "font-medium",
                      messageLength > 500 ? "text-destructive" : "text-muted-foreground"
                    )}
                    data-testid="text-char-count"
                  >
                    {messageLength}/500 characters
                  </span>
                </div>
              </FormItem>
            )}
          />

          {/* Placeholders */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Insert Placeholders</Label>
            <div className="flex flex-wrap gap-2">
              {allPlaceholders.map((p: any) => (
                <Button
                  key={p.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertPlaceholder(p.key)}
                  data-testid={`button-placeholder-${p.key}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Media Section */}
          <MediaUploadField form={form} />

          <FormField
            control={form.control}
            name="targetListId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Audience *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-target-list">
                      <SelectValue placeholder="Select a contact list" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lists.map((list: any) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.memberCount || 0} {list.memberCount === 1 ? 'contact' : 'contacts'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* AI Content Coach */}
        <div className="lg:col-span-1">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Content Coach
              </CardTitle>
              <CardDescription>Real-time message analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tone Analysis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Tone</span>
                  <Badge variant="outline" data-testid="badge-tone">
                    {contentAnalysis.tone}
                  </Badge>
                </div>
              </div>

              {/* Readability Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Readability</span>
                  <span className="text-sm font-semibold" data-testid="text-readability">
                    {Math.round(contentAnalysis.readabilityScore)}/100
                  </span>
                </div>
                <Progress value={contentAnalysis.readabilityScore} className="h-2" />
              </div>

              {/* Suggestions */}
              {contentAnalysis.suggestions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Suggestions</span>
                  <ul className="space-y-2">
                    {contentAnalysis.suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                        data-testid={`text-suggestion-${index}`}
                      >
                        <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Character Count Optimization */}
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 text-xs">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">
                    {messageLength < 160 ? "Optimal for SMS" : "May split into multiple messages"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Message Preview */}
          {messageBody && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {messageBody.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
                    const placeholder = placeholders.find((p: any) => p.key === key);
                    return placeholder?.example || `{{${key}}}`;
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// STEP 3: A/B Testing
// =====================================================
interface ABTestingStepProps {
  form: any;
}

function ABTestingStep({ form }: ABTestingStepProps) {
  const abTestingEnabled = form.watch("abTestingEnabled");
  const variants = form.watch("variants") || [];

  const addVariant = () => {
    const variantCount = variants.length;
    if (variantCount >= 3) {
      return; // Max 3 variants (A, B, C)
    }

    const newVariant = {
      id: `variant-${Date.now()}`,
      name: String.fromCharCode(66 + variantCount), // B, C
      messageBody: form.getValues("messageBody") || "",
      trafficPercentage: 0,
    };

    form.setValue("variants", [...variants, newVariant]);
  };

  const removeVariant = (id: string) => {
    form.setValue("variants", variants.filter((v: any) => v.id !== id));
  };

  const updateVariant = (id: string, field: string, value: any) => {
    const updated = variants.map((v: any) =>
      v.id === id ? { ...v, [field]: value } : v
    );
    form.setValue("variants", updated);
  };

  // Auto-distribute traffic
  const distributeTraffic = () => {
    const totalVariants = variants.length + 1; // +1 for control (A)
    const percentageEach = Math.floor(100 / totalVariants);
    const remainder = 100 - (percentageEach * totalVariants);

    const updated = variants.map((v: any, index: number) => ({
      ...v,
      trafficPercentage: percentageEach + (index === 0 ? remainder : 0),
    }));

    form.setValue("variants", updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">A/B Testing Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Test different message variants to optimize your campaign performance
        </p>
      </div>

      {/* Enable A/B Testing Toggle */}
      <FormField
        control={form.control}
        name="abTestingEnabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Enable A/B Testing</FormLabel>
              <FormDescription>
                Compare multiple message variants to find the best performing version
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="switch-ab-testing"
              />
            </FormControl>
          </FormItem>
        )}
      />

      {abTestingEnabled && (
        <div className="space-y-4">
          {/* Control Variant (A) */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Variant A (Control)
              </CardTitle>
              <CardDescription>
                Original message from Step 2
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded p-3 text-sm">
                {form.watch("messageBody") || "No message set"}
              </div>
            </CardContent>
          </Card>

          {/* Additional Variants */}
          {variants.map((variant: any) => (
            <Card key={variant.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Variant {variant.name}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariant(variant.id)}
                    data-testid={`button-remove-variant-${variant.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={variant.messageBody}
                  onChange={(e) => updateVariant(variant.id, "messageBody", e.target.value)}
                  placeholder="Enter variant message..."
                  rows={4}
                  className="resize-none"
                  data-testid={`input-variant-${variant.id}`}
                />
                <div className="text-xs text-muted-foreground">
                  {variant.messageBody.length}/500 characters
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Variant Button */}
          {variants.length < 3 && (
            <Button
              type="button"
              variant="outline"
              onClick={addVariant}
              className="w-full"
              data-testid="button-add-variant"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Variant {String.fromCharCode(66 + variants.length)}
            </Button>
          )}

          {/* Test Configuration */}
          {variants.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="testMetric"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Success Metric</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-test-metric">
                            <SelectValue placeholder="Select metric" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="response_rate">Response Rate</SelectItem>
                          <SelectItem value="conversion_rate">Conversion Rate</SelectItem>
                          <SelectItem value="click_rate">Click Rate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minSampleSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Sample Size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="10"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          placeholder="100"
                          data-testid="input-sample-size"
                        />
                      </FormControl>
                      <FormDescription>
                        Messages per variant before declaring a winner
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Traffic Split */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Traffic Split</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={distributeTraffic}
                      data-testid="button-distribute-traffic"
                    >
                      Auto-Distribute
                    </Button>
                  </div>
                  <CardDescription>
                    Allocate percentage of traffic to each variant
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Variant A (Control)</span>
                      <span className="font-medium">
                        {100 - variants.reduce((sum: number, v: any) => sum + (v.trafficPercentage || 0), 0)}%
                      </span>
                    </div>
                  </div>

                  {variants.map((variant: any) => (
                    <div key={variant.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Variant {variant.name}</span>
                        <span className="font-medium">{variant.trafficPercentage || 0}%</span>
                      </div>
                      <Slider
                        value={[variant.trafficPercentage || 0]}
                        onValueChange={([value]) => updateVariant(variant.id, "trafficPercentage", value)}
                        max={100}
                        step={5}
                        data-testid={`slider-traffic-${variant.id}`}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {!abTestingEnabled && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center">
              Enable A/B testing to compare different message variants<br />
              and optimize your campaign performance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// STEP 4: Schedule & Automation
// =====================================================
interface ScheduleAutomationStepProps {
  form: any;
}

function ScheduleAutomationStep({ form }: ScheduleAutomationStepProps) {
  const scheduleType = form.watch("scheduleType");
  const throttleEnabled = form.watch("throttleEnabled");
  const followUps = form.watch("followUps") || [];

  const addFollowUp = () => {
    const newFollowUp = {
      id: `followup-${Date.now()}`,
      trigger: "no_response" as const,
      delayHours: 24,
      messageBody: "",
    };
    form.setValue("followUps", [...followUps, newFollowUp]);
  };

  const removeFollowUp = (id: string) => {
    form.setValue("followUps", followUps.filter((f: any) => f.id !== id));
  };

  const updateFollowUp = (id: string, field: string, value: any) => {
    const updated = followUps.map((f: any) =>
      f.id === id ? { ...f, [field]: value } : f
    );
    form.setValue("followUps", updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Schedule & Automation</h3>
        <p className="text-sm text-muted-foreground">
          Configure when and how your campaign will be delivered
        </p>
      </div>

      {/* Schedule Type */}
      <FormField
        control={form.control}
        name="scheduleType"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel>Send Schedule</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <Label
                  htmlFor="immediate"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    field.value === "immediate" && "border-primary"
                  )}
                >
                  <RadioGroupItem value="immediate" id="immediate" className="sr-only" />
                  <Zap className="h-6 w-6 mb-3" />
                  <span className="text-sm font-medium">Immediate</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    Send right away
                  </span>
                </Label>

                <Label
                  htmlFor="scheduled"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    field.value === "scheduled" && "border-primary"
                  )}
                >
                  <RadioGroupItem value="scheduled" id="scheduled" className="sr-only" />
                  <CalendarIcon className="h-6 w-6 mb-3" />
                  <span className="text-sm font-medium">Scheduled</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    Pick a date & time
                  </span>
                </Label>

                <Label
                  htmlFor="recurring"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    field.value === "recurring" && "border-primary"
                  )}
                >
                  <RadioGroupItem value="recurring" id="recurring" className="sr-only" />
                  <Clock className="h-6 w-6 mb-3" />
                  <span className="text-sm font-medium">Recurring</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    Repeat automatically
                  </span>
                </Label>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Scheduled Date/Time */}
      {scheduleType === "scheduled" && (
        <FormField
          control={form.control}
          name="scheduledAt"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Schedule Date & Time</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      data-testid="button-schedule-date"
                    >
                      {field.value ? (
                        format(field.value, "PPP p")
                      ) : (
                        <span>Pick a date and time</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Recurring Pattern */}
      {scheduleType === "recurring" && (
        <FormField
          control={form.control}
          name="recurringPattern"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repeat Pattern</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-recurring-pattern">
                    <SelectValue placeholder="Select pattern" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Smart Throttling */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Smart Throttling
              </CardTitle>
              <CardDescription className="mt-1">
                Control message delivery rate and timing
              </CardDescription>
            </div>
            <Switch
              checked={throttleEnabled}
              onCheckedChange={(checked) => form.setValue("throttleEnabled", checked)}
              data-testid="switch-throttling"
            />
          </div>
        </CardHeader>

        {throttleEnabled && (
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="messagesPerHour"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Messages Per Hour</FormLabel>
                    <span className="text-sm font-medium">{field.value}</span>
                  </div>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                      min={1}
                      max={1000}
                      step={10}
                      data-testid="slider-messages-per-hour"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deliveryWindowStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        data-testid="input-delivery-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryWindowEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        data-testid="input-delivery-end"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-timezone">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        )}
      </Card>

      {/* Follow-up Sequence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Follow-up Sequence
          </CardTitle>
          <CardDescription>
            Automatically send follow-up messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {followUps.map((followUp: any, index: number) => (
            <Card key={followUp.id} className="border-muted">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Follow-up #{index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFollowUp(followUp.id)}
                    data-testid={`button-remove-followup-${followUp.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Trigger</Label>
                    <Select
                      value={followUp.trigger}
                      onValueChange={(value) => updateFollowUp(followUp.id, "trigger", value)}
                    >
                      <SelectTrigger data-testid={`select-trigger-${followUp.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_response">No Response</SelectItem>
                        <SelectItem value="time_delay">Time Delay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Delay (hours)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={followUp.delayHours}
                      onChange={(e) => updateFollowUp(followUp.id, "delayHours", parseInt(e.target.value))}
                      data-testid={`input-delay-${followUp.id}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    value={followUp.messageBody}
                    onChange={(e) => updateFollowUp(followUp.id, "messageBody", e.target.value)}
                    placeholder="Follow-up message..."
                    rows={3}
                    className="resize-none text-sm"
                    data-testid={`input-followup-message-${followUp.id}`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addFollowUp}
            className="w-full"
            data-testid="button-add-followup"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Follow-up
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// STEP 5: Review & Launch
// =====================================================
interface ReviewLaunchStepProps {
  form: any;
  lists: ContactList[];
}

function ReviewLaunchStep({ form }: ReviewLaunchStepProps, lists: ContactList[]) {
  const formValues = form.watch();
  const messageBody = formValues.messageBody || "";

  // Mock Deliverability Heatmap Data
  const heatmapData = [
    { day: "Mon", hours: [0, 0, 0, 0, 0, 0, 0, 0, 60, 80, 90, 85, 75, 70, 80, 85, 90, 70, 40, 20, 0, 0, 0, 0] },
    { day: "Tue", hours: [0, 0, 0, 0, 0, 0, 0, 0, 65, 85, 95, 90, 80, 75, 85, 90, 95, 75, 45, 25, 0, 0, 0, 0] },
    { day: "Wed", hours: [0, 0, 0, 0, 0, 0, 0, 0, 70, 90, 100, 95, 85, 80, 90, 95, 100, 80, 50, 30, 0, 0, 0, 0] },
    { day: "Thu", hours: [0, 0, 0, 0, 0, 0, 0, 0, 65, 85, 95, 90, 80, 75, 85, 90, 95, 75, 45, 25, 0, 0, 0, 0] },
    { day: "Fri", hours: [0, 0, 0, 0, 0, 0, 0, 0, 60, 80, 90, 85, 75, 70, 80, 85, 70, 50, 30, 15, 0, 0, 0, 0] },
    { day: "Sat", hours: [0, 0, 0, 0, 0, 0, 0, 0, 30, 40, 50, 60, 65, 70, 65, 60, 50, 40, 30, 15, 0, 0, 0, 0] },
    { day: "Sun", hours: [0, 0, 0, 0, 0, 0, 0, 0, 20, 30, 40, 50, 55, 60, 55, 50, 40, 30, 20, 10, 0, 0, 0, 0] },
  ];

  // Calculate Compliance Score (Mock)
  const complianceScore = useMemo(() => {
    let score = 100;
    
    // Deduct points for various issues
    if (messageBody.toLowerCase().includes("free")) score -= 10;
    if (messageBody.toLowerCase().includes("click here")) score -= 15;
    if (messageBody.length > 400) score -= 10;
    if (!messageBody.includes("unsubscribe") && !messageBody.includes("stop")) score -= 20;
    
    return Math.max(0, score);
  }, [messageBody]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getCellColor = (value: number) => {
    if (value === 0) return "bg-muted";
    if (value < 40) return "bg-red-200 dark:bg-red-900/30";
    if (value < 70) return "bg-yellow-200 dark:bg-yellow-900/30";
    return "bg-green-200 dark:bg-green-900/30";
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review & Launch</h3>
        <p className="text-sm text-muted-foreground">
          Review your campaign details and premium insights before launching
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Campaign Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="col-span-2 font-medium" data-testid="text-review-name">
                  {formValues.name || "Untitled"}
                </span>

                <span className="text-muted-foreground">Target:</span>
                <span className="col-span-2 font-medium">
                  {formValues.targetListId === "all" ? "All Contacts" : "Contact List"}
                </span>

                <span className="text-muted-foreground">Schedule:</span>
                <span className="col-span-2 font-medium capitalize">
                  {formValues.scheduleType}
                </span>

                {formValues.abTestingEnabled && (
                  <>
                    <span className="text-muted-foreground">Variants:</span>
                    <span className="col-span-2 font-medium">
                      {(formValues.variants?.length || 0) + 1} ({String.fromCharCode(65, ...(formValues.variants || []).map((_: any, i: number) => 66 + i))})
                    </span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Message Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap" data-testid="text-review-message">
                  {messageBody || "No message"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Score */}
          <Card className={cn(
            "border-2",
            complianceScore >= 80 ? "border-green-500/20 bg-green-500/5" :
            complianceScore >= 60 ? "border-yellow-500/20 bg-yellow-500/5" :
            "border-red-500/20 bg-red-500/5"
          )}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {complianceScore >= 80 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                Compliance Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className={cn("text-4xl font-bold", getScoreColor(complianceScore))} data-testid="text-compliance-score">
                  {complianceScore}
                </span>
                <span className="text-muted-foreground">/100</span>
              </div>
              <Progress value={complianceScore} className="mt-3" />
              {complianceScore < 80 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Consider adding an unsubscribe option and avoiding spam trigger words
                </p>
              )}
            </CardContent>
          </Card>

          {/* Test Send */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                Test Send Simulator
              </CardTitle>
              <CardDescription>
                Send a test message to verify delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled
                data-testid="button-test-send"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Test Message
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Test sends are disabled in demo mode
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Deliverability Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Deliverability Heatmap
              </CardTitle>
              <CardDescription>
                Optimal send times based on engagement data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {heatmapData.map((row) => (
                  <div key={row.day} className="flex items-center gap-1">
                    <span className="text-xs font-medium w-8 text-muted-foreground">
                      {row.day}
                    </span>
                    <div className="flex gap-0.5 flex-1">
                      {row.hours.map((value, hourIndex) => (
                        <div
                          key={hourIndex}
                          className={cn(
                            "h-4 flex-1 rounded-sm",
                            getCellColor(value)
                          )}
                          title={`${row.day} ${hourIndex}:00 - ${value}% engagement`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>12am</span>
                <span>12pm</span>
                <span>11pm</span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/30" />
                  <span className="text-muted-foreground">High</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-yellow-200 dark:bg-yellow-900/30" />
                  <span className="text-muted-foreground">Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-900/30" />
                  <span className="text-muted-foreground">Low</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Visualizer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Timeline Visualizer
              </CardTitle>
              <CardDescription>
                Campaign execution timeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="w-0.5 h-12 bg-border" />
                  </div>
                  <div className="flex-1 pt-0">
                    <p className="text-sm font-medium">Initial Send</p>
                    <p className="text-xs text-muted-foreground">
                      {formValues.scheduleType === "immediate" ? "Immediately" : "Scheduled time"}
                    </p>
                  </div>
                </div>

                {formValues.followUps && formValues.followUps.length > 0 && (
                  formValues.followUps.map((followUp: any, index: number) => (
                    <div key={followUp.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        {index < formValues.followUps.length - 1 && (
                          <div className="w-0.5 h-12 bg-border" />
                        )}
                      </div>
                      <div className="flex-1 pt-0">
                        <p className="text-sm font-medium">Follow-up #{index + 1}</p>
                        <p className="text-xs text-muted-foreground">
                          +{followUp.delayHours}h ({followUp.trigger === "no_response" ? "No Response" : "Time Delay"})
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {(!formValues.followUps || formValues.followUps.length === 0) && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No follow-ups configured
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
