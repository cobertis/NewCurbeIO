import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Edit, Trash2, Eye, Code } from "lucide-react";
import type { EmailTemplate } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTabsState } from "@/hooks/use-tabs-state";

export function EmailTemplatesManager() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const { data: templatesData, isLoading } = useQuery<{ templates: EmailTemplate[] }>({
    queryKey: ["/api/email-templates"],
  });

  const templates = templatesData?.templates || [];

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/email-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Template created",
        description: "Email template has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create email template.",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/email-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
      toast({
        title: "Template updated",
        description: "Email template has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update email template.",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({
        title: "Template deleted",
        description: "Email template has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete email template.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setIsEditDialogOpen(true);
  };

  const handlePreview = (html: string) => {
    setPreviewHtml(html);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Email Templates</h2>
          <p className="text-sm text-muted-foreground">
            Manage email templates with HTML editor and preview
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Email Template</DialogTitle>
              <DialogDescription>
                Create a new email template for automated communications
              </DialogDescription>
            </DialogHeader>
            <TemplateForm
              onSubmit={(data) => createTemplateMutation.mutate(data)}
              isPending={createTemplateMutation.isPending}
              onPreview={handlePreview}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Loading templates...</p>
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No email templates yet</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {templates.map((template) => (
                <div key={template.id} className="p-4 hover-elevate">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{template.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {template.slug}
                        </Badge>
                        {template.isActive && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {template.subject}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        data-testid={`button-edit-template-${template.id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(template.htmlContent)}
                        data-testid={`button-preview-template-${template.id}`}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this template?")) {
                            deleteTemplateMutation.mutate(template.id);
                          }
                        }}
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogDescription>
              Update the email template content and settings
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TemplateForm
              defaultValues={selectedTemplate}
              onSubmit={(data) => updateTemplateMutation.mutate({ id: selectedTemplate.id, data })}
              isPending={updateTemplateMutation.isPending}
              onPreview={handlePreview}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml("")}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview how your email will look to recipients
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 overflow-auto max-h-[70vh]">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateFormProps {
  defaultValues?: EmailTemplate;
  onSubmit: (data: any) => void;
  isPending: boolean;
  onPreview: (html: string) => void;
}

function TemplateForm({ defaultValues, onSubmit, isPending, onPreview }: TemplateFormProps) {
  const [contentTab, setContentTab] = useTabsState(["html", "text"], "html");
  const [formData, setFormData] = useState({
    name: defaultValues?.name || "",
    slug: defaultValues?.slug || "",
    subject: defaultValues?.subject || "",
    htmlContent: defaultValues?.htmlContent || "",
    textContent: defaultValues?.textContent || "",
    variables: defaultValues?.variables || [],
    isActive: defaultValues?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Welcome Email"
            required
            data-testid="input-template-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            placeholder="welcome"
            required
            data-testid="input-template-slug"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Email Subject</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Welcome to {{company_name}}!"
          required
          data-testid="input-template-subject"
        />
      </div>

      <Tabs value={contentTab} onValueChange={setContentTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="html">
            <Code className="h-4 w-4 mr-2" />
            HTML Content
          </TabsTrigger>
          <TabsTrigger value="text">Plain Text</TabsTrigger>
        </TabsList>

        <TabsContent value="html" className="space-y-2">
          <Label htmlFor="htmlContent">HTML Content</Label>
          <Textarea
            id="htmlContent"
            value={formData.htmlContent}
            onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
            placeholder="Paste your HTML email template here..."
            className="font-mono text-sm min-h-[300px]"
            required
            data-testid="input-template-html"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPreview(formData.htmlContent)}
            data-testid="button-preview-html"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview HTML
          </Button>
        </TabsContent>

        <TabsContent value="text" className="space-y-2">
          <Label htmlFor="textContent">Plain Text Content (Optional)</Label>
          <Textarea
            id="textContent"
            value={formData.textContent}
            onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
            placeholder="Plain text fallback..."
            className="min-h-[300px]"
            data-testid="input-template-text"
          />
        </TabsContent>
      </Tabs>

      <div className="flex gap-4 pt-4">
        <Button type="submit" disabled={isPending} data-testid="button-save-template">
          {isPending ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </form>
  );
}
