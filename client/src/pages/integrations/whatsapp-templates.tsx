import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { SiWhatsapp } from "react-icons/si";
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft,
  Trash2, 
  Eye,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb
} from "lucide-react";

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

interface Template {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: TemplateComponent[];
}

interface TemplatesResponse {
  templates: Template[];
  paging?: { cursors?: { before?: string; after?: string } };
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "en_US", name: "English (US)" },
  { code: "es", name: "Spanish" },
  { code: "es_MX", name: "Spanish (Mexico)" },
  { code: "pt_BR", name: "Portuguese (Brazil)" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "zh_CN", name: "Chinese (Simplified)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
];

const CATEGORIES = [
  { value: "MARKETING", label: "Marketing", description: "Promotional messages, offers, announcements" },
  { value: "UTILITY", label: "Utility", description: "Transaction updates, confirmations, reminders" },
  { value: "AUTHENTICATION", label: "Authentication", description: "One-time passcodes, verification" },
];

export default function WhatsAppTemplatesPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/settings/whatsapp/templates/:wabaId");
  const wabaId = params?.wabaId;

  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // AI assist state
  const [aiPurpose, setAiPurpose] = useState("");
  const [aiBusinessType, setAiBusinessType] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<{
    name?: string;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    tips?: string[];
    warnings?: string[];
  } | null>(null);

  // Form state for creating template
  const [formData, setFormData] = useState({
    name: "",
    language: "en",
    category: "UTILITY",
    headerType: "none",
    headerText: "",
    bodyText: "",
    footerText: "",
    buttonType: "none",
    buttons: [{ type: "QUICK_REPLY", text: "" }],
  });

  // Fetch templates
  const { data: templatesData, isLoading, refetch } = useQuery<TemplatesResponse>({
    queryKey: ["/api/whatsapp/meta/templates", wabaId],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/meta/templates?wabaId=${wabaId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
    enabled: !!wabaId,
  });

  const templates = templatesData?.templates || [];

  // Filter templates
  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / parseInt(rowsPerPage));
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * parseInt(rowsPerPage),
    currentPage * parseInt(rowsPerPage)
  );

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const components: any[] = [];

      // Header component
      if (data.headerType === "text" && data.headerText) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: data.headerText,
        });
      }

      // Body component (required)
      if (data.bodyText) {
        components.push({
          type: "BODY",
          text: data.bodyText,
        });
      }

      // Footer component
      if (data.footerText) {
        components.push({
          type: "FOOTER",
          text: data.footerText,
        });
      }

      // Buttons
      if (data.buttonType === "quick_reply" && data.buttons.some(b => b.text)) {
        components.push({
          type: "BUTTONS",
          buttons: data.buttons
            .filter(b => b.text)
            .map(b => ({ type: "QUICK_REPLY", text: b.text })),
        });
      }

      return apiRequest("POST", "/api/whatsapp/meta/templates", {
        wabaId,
        name: data.name.toLowerCase().replace(/\s+/g, "_"),
        language: data.language,
        category: data.category,
        components,
      });
    },
    onSuccess: () => {
      toast({ title: "Template created", description: "Template submitted for review" });
      setCreateSheetOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/meta/templates", wabaId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: error.message || "Please try again",
      });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (templateName: string) => {
      return apiRequest("DELETE", `/api/whatsapp/meta/templates/${templateName}?wabaId=${wabaId}`);
    },
    onSuccess: () => {
      toast({ title: "Template deleted" });
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/meta/templates", wabaId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: error.message || "Please try again",
      });
    },
  });

  // AI assist mutation
  const aiAssistMutation = useMutation({
    mutationFn: async (data: { purpose: string; category: string; language: string; businessType: string }) => {
      const res = await apiRequest("POST", "/api/whatsapp/meta/templates/ai-assist", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.suggestion) {
        setAiSuggestion(data.suggestion);
        // Auto-populate form with AI suggestions
        setFormData(prev => ({
          ...prev,
          name: data.suggestion.name || prev.name,
          headerType: data.suggestion.headerText ? "text" : "none",
          headerText: data.suggestion.headerText || "",
          bodyText: data.suggestion.bodyText || "",
          footerText: data.suggestion.footerText || "",
        }));
        toast({ title: "Template generated", description: "Review and adjust before submitting" });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "AI generation failed",
        description: error.message || "Please try again",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      language: "en",
      category: "UTILITY",
      headerType: "none",
      headerText: "",
      bodyText: "",
      footerText: "",
      buttonType: "none",
      buttons: [{ type: "QUICK_REPLY", text: "" }],
    });
    setAiPurpose("");
    setAiBusinessType("");
    setAiSuggestion(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Approved</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Pending</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Rejected</Badge>;
      case "PAUSED":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">Paused</Badge>;
      case "DISABLED":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category.toUpperCase()) {
      case "MARKETING":
        return <Badge variant="outline" className="border-purple-300 text-purple-700">Marketing</Badge>;
      case "UTILITY":
        return <Badge variant="outline" className="border-blue-300 text-blue-700">Utility</Badge>;
      case "AUTHENTICATION":
        return <Badge variant="outline" className="border-green-300 text-green-700">Authentication</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const getBodyText = (template: Template) => {
    const bodyComponent = template.components.find(c => c.type === "BODY");
    return bodyComponent?.text || "";
  };

  if (!wabaId) {
    return (
      <SettingsLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Invalid WhatsApp account ID</p>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings/whatsapp">
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <SiWhatsapp className="h-6 w-6 text-emerald-500" />
              <div>
                <h1 className="text-xl font-semibold">Message Templates</h1>
                <p className="text-sm text-slate-500">WABA ID: {wabaId}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-templates"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => setCreateSheetOpen(true)}
              data-testid="button-create-template"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>

        {/* Templates Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800">
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <LoadingSpinner fullScreen={false} />
                  </TableCell>
                </TableRow>
              ) : paginatedTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    {searchQuery ? "No templates match your search" : "No templates yet. Create your first template."}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTemplates.map((template) => (
                  <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-slate-500 truncate max-w-xs">
                          {getBodyText(template).substring(0, 50)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryBadge(template.category)}</TableCell>
                    <TableCell>
                      <span className="text-sm">{template.language}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(template.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setPreviewDialogOpen(true);
                          }}
                          title="Preview"
                          data-testid={`button-preview-${template.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setDeleteDialogOpen(true);
                          }}
                          title="Delete"
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-500">
              {filteredTemplates.length > 0
                ? `${(currentPage - 1) * parseInt(rowsPerPage) + 1}-${Math.min(currentPage * parseInt(rowsPerPage), filteredTemplates.length)} of ${filteredTemplates.length} templates`
                : "0 templates"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Show</span>
            <Select value={rowsPerPage} onValueChange={(value) => { setRowsPerPage(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-20" data-testid="select-rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Create Template Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-create-template">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-emerald-500" />
              Create Template
            </SheetTitle>
            <SheetDescription>
              Templates must be approved by Meta before you can use them
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* AI Assist Section */}
            <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm">Generate with Pulse</span>
              </div>
              <div className="space-y-3">
                <Textarea
                  value={aiPurpose}
                  onChange={(e) => setAiPurpose(e.target.value)}
                  placeholder="Describe your template purpose, e.g., 'appointment reminder for dental clinic' or 'order confirmation for online store'"
                  rows={2}
                  className="text-sm"
                  data-testid="input-ai-purpose"
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={aiBusinessType}
                    onChange={(e) => setAiBusinessType(e.target.value)}
                    placeholder="Business type (optional)"
                    className="flex-1 text-sm"
                    data-testid="input-ai-business-type"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={!aiPurpose.trim() || aiAssistMutation.isPending}
                    onClick={() => aiAssistMutation.mutate({
                      purpose: aiPurpose,
                      category: formData.category,
                      language: formData.language,
                      businessType: aiBusinessType,
                    })}
                    data-testid="button-ai-generate"
                  >
                    {aiAssistMutation.isPending ? (
                      <LoadingSpinner fullScreen={false} className="h-4 w-4" />
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* AI Tips and Warnings */}
              {aiSuggestion && (
                <div className="mt-4 space-y-2">
                  {aiSuggestion.tips && aiSuggestion.tips.length > 0 && (
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-1 text-green-700 dark:text-green-300 text-xs font-medium mb-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Tips for approval
                      </div>
                      <ul className="text-xs text-green-600 dark:text-green-400 space-y-1">
                        {aiSuggestion.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiSuggestion.warnings && aiSuggestion.warnings.length > 0 && (
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-center gap-1 text-yellow-700 dark:text-yellow-300 text-xs font-medium mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Potential issues
                      </div>
                      <ul className="text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
                        {aiSuggestion.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Template Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
                placeholder="order_confirmation"
                data-testid="input-template-name"
              />
              <p className="text-xs text-slate-500">Lowercase letters, numbers, and underscores only</p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                <SelectTrigger data-testid="select-template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <p className="font-medium">{cat.label}</p>
                        <p className="text-xs text-slate-500">{cat.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <Select value={formData.language} onValueChange={(v) => setFormData(prev => ({ ...prev, language: v }))}>
                <SelectTrigger data-testid="select-template-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Header */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Header (Optional)</label>
              <Select value={formData.headerType} onValueChange={(v) => setFormData(prev => ({ ...prev, headerType: v }))}>
                <SelectTrigger data-testid="select-header-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No header</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
              {formData.headerType === "text" && (
                <Input
                  value={formData.headerText}
                  onChange={(e) => setFormData(prev => ({ ...prev, headerText: e.target.value }))}
                  placeholder="Header text"
                  maxLength={60}
                  data-testid="input-header-text"
                />
              )}
            </div>

            {/* Body */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Body <span className="text-slate-400">({formData.bodyText.length}/1024)</span>
              </label>
              <Textarea
                value={formData.bodyText}
                onChange={(e) => setFormData(prev => ({ ...prev, bodyText: e.target.value.slice(0, 1024) }))}
                placeholder="Hello {{1}}, your order {{2}} is ready!"
                rows={4}
                maxLength={1024}
                data-testid="input-body-text"
              />
              <p className="text-xs text-slate-500">Use {"{{1}}"}, {"{{2}}"}, etc. for variables</p>
            </div>

            {/* Footer */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Footer (Optional)</label>
              <Input
                value={formData.footerText}
                onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="Thank you for your business"
                maxLength={60}
                data-testid="input-footer-text"
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Buttons (Optional)</label>
              <Select value={formData.buttonType} onValueChange={(v) => setFormData(prev => ({ ...prev, buttonType: v }))}>
                <SelectTrigger data-testid="select-button-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No buttons</SelectItem>
                  <SelectItem value="quick_reply">Quick Reply Buttons</SelectItem>
                </SelectContent>
              </Select>
              {formData.buttonType === "quick_reply" && (
                <div className="space-y-2">
                  {formData.buttons.map((btn, idx) => (
                    <Input
                      key={idx}
                      value={btn.text}
                      onChange={(e) => {
                        const newButtons = [...formData.buttons];
                        newButtons[idx] = { ...btn, text: e.target.value };
                        setFormData(prev => ({ ...prev, buttons: newButtons }));
                      }}
                      placeholder={`Button ${idx + 1} text`}
                      maxLength={25}
                      data-testid={`input-button-${idx}`}
                    />
                  ))}
                  {formData.buttons.length < 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        buttons: [...prev.buttons, { type: "QUICK_REPLY", text: "" }]
                      }))}
                      data-testid="button-add-quick-reply"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Button
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setCreateSheetOpen(false); resetForm(); }} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.name || !formData.bodyText}
                data-testid="button-submit-template"
              >
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-preview-template">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-emerald-500" />
              Template Preview
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - {selectedTemplate?.language}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getCategoryBadge(selectedTemplate.category)}
                {getStatusBadge(selectedTemplate.status)}
              </div>

              {/* WhatsApp-style preview */}
              <div className="bg-[#e5ddd5] dark:bg-slate-700 rounded-lg p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 max-w-[280px] shadow-sm">
                  {selectedTemplate.components.map((comp, idx) => (
                    <div key={idx}>
                      {comp.type === "HEADER" && (
                        <p className="font-semibold text-sm mb-2">{comp.text}</p>
                      )}
                      {comp.type === "BODY" && (
                        <p className="text-sm whitespace-pre-wrap">{comp.text}</p>
                      )}
                      {comp.type === "FOOTER" && (
                        <p className="text-xs text-slate-500 mt-2">{comp.text}</p>
                      )}
                      {comp.type === "BUTTONS" && comp.buttons && (
                        <div className="mt-3 space-y-1 border-t pt-2">
                          {comp.buttons.map((btn, bidx) => (
                            <div key={bidx} className="text-center text-sm text-blue-600 py-1 border rounded">
                              {btn.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-template">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.name)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
