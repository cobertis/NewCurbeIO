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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Pencil,
  Info,
  Library,
  CheckCircle2
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

interface LibraryTemplate {
  id: string;
  name: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  categoryLabel: string;
  description: string;
  language: string;
  headerType: "none" | "text";
  headerText: string;
  bodyText: string;
  footerText: string;
  buttonType: "none" | "quick_reply";
  buttons: string[];
}

const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // UTILITY - Appointments
  {
    id: "appt_reminder_v1",
    name: "appt_reminder_v1",
    category: "UTILITY",
    categoryLabel: "Appointments",
    description: "Appointment reminder with date/time",
    language: "en",
    headerType: "text",
    headerText: "Appointment Reminder",
    bodyText: "This is a reminder that your appointment is scheduled for {{1}} at {{2}}. Please arrive 10 minutes early to complete check-in. Our office is located at {{3}}. Reply YES to confirm or NO to reschedule.",
    footerText: "",
    buttonType: "quick_reply",
    buttons: ["Confirm", "Reschedule"],
  },
  {
    id: "booking_confirmed_v1",
    name: "booking_confirmed_v1",
    category: "UTILITY",
    categoryLabel: "Appointments",
    description: "Confirm a new appointment booking",
    language: "en",
    headerType: "text",
    headerText: "Booking Confirmed",
    bodyText: "Great news! Your appointment has been successfully scheduled for {{1}} at {{2}}. Your confirmation number is {{3}}. Please save this for your records. We look forward to seeing you.",
    footerText: "Thank you for choosing us",
    buttonType: "none",
    buttons: [],
  },
  {
    id: "recordatorio_cita",
    name: "recordatorio_cita",
    category: "UTILITY",
    categoryLabel: "Appointments",
    description: "Recordatorio de cita en español",
    language: "es",
    headerType: "text",
    headerText: "Recordatorio de Cita",
    bodyText: "Su cita esta programada para el {{1}} a las {{2}}. Por favor llegue 10 minutos antes. Nuestra direccion es {{3}}. Responda SI para confirmar o NO para reprogramar.",
    footerText: "",
    buttonType: "quick_reply",
    buttons: ["Confirmar", "Reprogramar"],
  },
  // UTILITY - Orders
  {
    id: "order_confirmation",
    name: "order_confirmation",
    category: "UTILITY",
    categoryLabel: "Orders",
    description: "Order confirmation with details",
    language: "en",
    headerType: "text",
    headerText: "Order Confirmed",
    bodyText: "Thank you for your purchase! Your order number is {{1}} with a total of {{2}}. Estimated delivery: {{3}}. You will receive tracking information once shipped.",
    footerText: "Thank you for shopping with us",
    buttonType: "quick_reply",
    buttons: ["Track Order", "Contact Support"],
  },
  {
    id: "order_shipped",
    name: "order_shipped",
    category: "UTILITY",
    categoryLabel: "Orders",
    description: "Shipping notification",
    language: "en",
    headerType: "text",
    headerText: "Order Shipped",
    bodyText: "Great news! Your order {{1}} has been shipped. Tracking number: {{2}}. Expected delivery: {{3}}. Track your package for real-time updates.",
    footerText: "",
    buttonType: "quick_reply",
    buttons: ["Track Package"],
  },
  {
    id: "confirmacion_pedido",
    name: "confirmacion_pedido",
    category: "UTILITY",
    categoryLabel: "Orders",
    description: "Confirmacion de pedido en español",
    language: "es",
    headerType: "text",
    headerText: "Pedido Confirmado",
    bodyText: "Gracias por su compra! Su numero de pedido es {{1}} con un total de {{2}}. Fecha estimada de entrega: {{3}}. Recibira informacion de seguimiento cuando sea enviado.",
    footerText: "Gracias por comprar con nosotros",
    buttonType: "quick_reply",
    buttons: ["Rastrear Pedido", "Contactar Soporte"],
  },
  // UTILITY - Payments
  {
    id: "payment_received",
    name: "payment_received",
    category: "UTILITY",
    categoryLabel: "Payments",
    description: "Payment confirmation",
    language: "en",
    headerType: "text",
    headerText: "Payment Received",
    bodyText: "We have received your payment of {{1}}. Transaction ID: {{2}}. Date: {{3}}. Thank you for your payment.",
    footerText: "",
    buttonType: "none",
    buttons: [],
  },
  {
    id: "payment_reminder",
    name: "payment_reminder",
    category: "UTILITY",
    categoryLabel: "Payments",
    description: "Payment due reminder",
    language: "en",
    headerType: "text",
    headerText: "Payment Reminder",
    bodyText: "This is a friendly reminder that your payment of {{1}} is due on {{2}}. Invoice number: {{3}}. Please ensure timely payment to avoid any service interruption.",
    footerText: "",
    buttonType: "quick_reply",
    buttons: ["Pay Now", "Contact Us"],
  },
  // UTILITY - Delivery
  {
    id: "delivery_update",
    name: "delivery_update",
    category: "UTILITY",
    categoryLabel: "Delivery",
    description: "Delivery status update",
    language: "en",
    headerType: "text",
    headerText: "Delivery Update",
    bodyText: "Your package {{1}} is out for delivery today. Expected arrival: {{2}}. The driver will leave it at {{3}} if you are not available.",
    footerText: "",
    buttonType: "quick_reply",
    buttons: ["Track", "Change Address"],
  },
  {
    id: "delivery_completed",
    name: "delivery_completed",
    category: "UTILITY",
    categoryLabel: "Delivery",
    description: "Delivery completion notification",
    language: "en",
    headerType: "text",
    headerText: "Package Delivered",
    bodyText: "Your package {{1}} has been delivered at {{2}} on {{3}}. Thank you for your order. We hope you enjoy your purchase!",
    footerText: "",
    buttonType: "quick_reply",
    buttons: ["Rate Experience"],
  },
  // MARKETING - Promotions
  {
    id: "special_offer",
    name: "special_offer",
    category: "MARKETING",
    categoryLabel: "Promotions",
    description: "Limited time offer announcement",
    language: "en",
    headerType: "text",
    headerText: "Special Offer",
    bodyText: "Exclusive offer just for you! Get {{1}} off your next purchase with code {{2}}. Valid until {{3}}. Don't miss out on these amazing savings!",
    footerText: "Reply STOP to unsubscribe",
    buttonType: "quick_reply",
    buttons: ["Shop Now", "Learn More"],
  },
  {
    id: "oferta_especial",
    name: "oferta_especial",
    category: "MARKETING",
    categoryLabel: "Promotions",
    description: "Oferta especial en español",
    language: "es",
    headerType: "text",
    headerText: "Oferta Especial",
    bodyText: "Oferta exclusiva para ti! Obtén {{1}} de descuento en tu proxima compra con el codigo {{2}}. Valido hasta {{3}}. No te pierdas estos increibles ahorros!",
    footerText: "Responde STOP para cancelar",
    buttonType: "quick_reply",
    buttons: ["Comprar Ahora", "Mas Info"],
  },
  {
    id: "flash_sale",
    name: "flash_sale",
    category: "MARKETING",
    categoryLabel: "Promotions",
    description: "Flash sale announcement",
    language: "en",
    headerType: "text",
    headerText: "Flash Sale",
    bodyText: "Flash sale starts now! Enjoy up to {{1}} off on selected items. Sale ends {{2}}. Use code {{3}} at checkout. Limited stock available!",
    footerText: "Reply STOP to unsubscribe",
    buttonType: "quick_reply",
    buttons: ["Shop Sale"],
  },
  // MARKETING - Welcome
  {
    id: "welcome_message",
    name: "welcome_message",
    category: "MARKETING",
    categoryLabel: "Welcome",
    description: "Welcome new customer",
    language: "en",
    headerType: "text",
    headerText: "Welcome!",
    bodyText: "Thanks for joining us! As a welcome gift, enjoy {{1}} off your first order with code {{2}}. Valid for {{3}}. We are excited to have you!",
    footerText: "Reply STOP to unsubscribe",
    buttonType: "quick_reply",
    buttons: ["Start Shopping"],
  },
  {
    id: "mensaje_bienvenida",
    name: "mensaje_bienvenida",
    category: "MARKETING",
    categoryLabel: "Welcome",
    description: "Mensaje de bienvenida en español",
    language: "es",
    headerType: "text",
    headerText: "Bienvenido!",
    bodyText: "Gracias por unirte! Como regalo de bienvenida, disfruta {{1}} de descuento en tu primer pedido con el codigo {{2}}. Valido por {{3}}. Estamos emocionados de tenerte!",
    footerText: "Responde STOP para cancelar",
    buttonType: "quick_reply",
    buttons: ["Comenzar a Comprar"],
  },
  // NOTE: Authentication templates removed from library - Meta requires a very specific format
  // that doesn't allow custom body text. They are auto-generated with OTP button.
];

export default function WhatsAppTemplatesPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/settings/whatsapp/templates/:wabaId");
  const wabaId = params?.wabaId;

  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // AI assist state
  const [aiPurpose, setAiPurpose] = useState("");

  // Library state
  const [createTab, setCreateTab] = useState<"library" | "custom">("library");
  const [libraryCategory, setLibraryCategory] = useState<string>("all");
  const [selectedLibraryTemplate, setSelectedLibraryTemplate] = useState<LibraryTemplate | null>(null);

  // Get unique library categories
  const libraryCategories = Array.from(new Set(TEMPLATE_LIBRARY.map(t => t.categoryLabel)));

  // Filter library templates
  const filteredLibraryTemplates = TEMPLATE_LIBRARY.filter(t => 
    libraryCategory === "all" || t.categoryLabel === libraryCategory
  );

  // Load library template into form
  const loadLibraryTemplate = (template: LibraryTemplate) => {
    setFormData({
      name: template.name,
      language: template.language,
      category: template.category,
      headerType: template.headerType,
      headerText: template.headerText,
      bodyText: template.bodyText,
      footerText: template.footerText,
      buttonType: template.buttonType,
      buttons: template.buttons.length > 0 
        ? template.buttons.map(text => ({ type: "QUICK_REPLY", text }))
        : [{ type: "QUICK_REPLY", text: "" }],
    });
    setSelectedLibraryTemplate(template);
    setCreateTab("custom");
    toast({
      title: "Template loaded",
      description: "Customize the template and submit to Meta for approval",
    });
  };

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

  // Helper function to extract variables and generate examples
  const extractVariablesAndGenerateExamples = (text: string): string[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    const varNumbers = matches.map(m => parseInt(m.replace(/[{}]/g, '')));
    const maxVar = Math.max(0, ...varNumbers);
    
    // Generate example values for each variable
    const exampleValues: { [key: number]: string } = {
      1: "January 15, 2025",
      2: "10:30 AM",
      3: "ABC123",
      4: "$50.00",
      5: "John",
      6: "Order #12345",
      7: "3-5 business days",
      8: "support@example.com",
      9: "555-1234",
      10: "Example Business"
    };
    
    const examples: string[] = [];
    for (let i = 1; i <= maxVar; i++) {
      examples.push(exampleValues[i] || `Example ${i}`);
    }
    return examples;
  };

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // AUTHENTICATION templates have special Meta requirements - cannot use custom text
      if (data.category === "AUTHENTICATION") {
        // Meta Authentication templates must follow a strict format
        const components: any[] = [
          {
            type: "BODY",
            add_security_recommendation: true,
          },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "OTP",
                otp_type: "COPY_CODE",
              }
            ],
          }
        ];

        return apiRequest("POST", "/api/whatsapp/meta/templates", {
          wabaId,
          name: data.name.toLowerCase().replace(/\s+/g, "_"),
          language: data.language,
          category: data.category,
          components,
        });
      }

      // Standard UTILITY/MARKETING templates
      const components: any[] = [];

      // Header component
      if (data.headerType === "text" && data.headerText) {
        const headerExamples = extractVariablesAndGenerateExamples(data.headerText);
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: data.headerText,
          ...(headerExamples.length > 0 && {
            example: { header_text: headerExamples }
          }),
        });
      }

      // Body component (required) - MUST include example values for variables
      if (data.bodyText) {
        const bodyExamples = extractVariablesAndGenerateExamples(data.bodyText);
        components.push({
          type: "BODY",
          text: data.bodyText,
          ...(bodyExamples.length > 0 && {
            example: { body_text: [bodyExamples] }
          }),
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

  // Edit template mutation
  const editMutation = useMutation({
    mutationFn: async (data: { templateId: string; components: any[] }) => {
      return apiRequest("PATCH", `/api/whatsapp/meta/templates/${data.templateId}`, {
        wabaId,
        components: data.components,
      });
    },
    onSuccess: () => {
      toast({ title: "Template updated", description: "Changes submitted for review" });
      setEditSheetOpen(false);
      setEditingTemplate(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/meta/templates", wabaId] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update template",
        description: error.message || "Please try again",
      });
    },
  });

  // Helper to load template data into form for editing
  const loadTemplateForEdit = (template: Template) => {
    const headerComp = template.components.find(c => c.type === "HEADER");
    const bodyComp = template.components.find(c => c.type === "BODY");
    const footerComp = template.components.find(c => c.type === "FOOTER");
    const buttonsComp = template.components.find(c => c.type === "BUTTONS");

    setFormData({
      name: template.name,
      language: template.language,
      category: template.category,
      headerType: headerComp?.format === "TEXT" ? "text" : "none",
      headerText: headerComp?.text || "",
      bodyText: bodyComp?.text || "",
      footerText: footerComp?.text || "",
      buttonType: buttonsComp?.buttons?.length ? "quick_reply" : "none",
      buttons: buttonsComp?.buttons?.map(b => ({ type: b.type, text: b.text })) || [{ type: "QUICK_REPLY", text: "" }],
    });
    setEditingTemplate(template);
    setEditSheetOpen(true);
  };

  // Check if template can be edited
  const canEditTemplate = (status: string) => {
    const editableStatuses = ["APPROVED", "REJECTED", "PAUSED"];
    return editableStatuses.includes(status.toUpperCase());
  };

  // AI assist mutation - Pulse handles everything
  const aiAssistMutation = useMutation({
    mutationFn: async (purpose: string) => {
      return apiRequest("POST", "/api/whatsapp/meta/templates/ai-assist", { purpose });
    },
    onSuccess: (data) => {
      if (data.suggestion) {
        const s = data.suggestion;
        // Auto-populate ALL form fields from AI
        setFormData({
          name: s.name || "",
          language: s.language || "en",
          category: s.category || "UTILITY",
          headerType: s.headerType || (s.headerText ? "text" : "none"),
          headerText: s.headerText || "",
          bodyText: s.bodyText || "",
          footerText: s.footerText || "",
          buttonType: s.buttonType || (s.buttons?.length > 0 ? "quick_reply" : "none"),
          buttons: s.buttons?.map((text: string) => ({ type: "QUICK_REPLY", text })) || [{ type: "QUICK_REPLY", text: "" }],
        });
        toast({ title: "Template generated", description: "Review and create" });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Generation failed",
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
                        {canEditTemplate(template.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700"
                            onClick={() => loadTemplateForEdit(template)}
                            title="Edit"
                            data-testid={`button-edit-${template.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
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
      <Sheet open={createSheetOpen} onOpenChange={(open) => {
        setCreateSheetOpen(open);
        if (!open) {
          setSelectedLibraryTemplate(null);
          setCreateTab("library");
        }
      }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="sheet-create-template">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-emerald-500" />
              Create Template
            </SheetTitle>
            <SheetDescription>
              Choose a pre-approved template or create a custom one
            </SheetDescription>
          </SheetHeader>

          <Tabs value={createTab} onValueChange={(v) => setCreateTab(v as "library" | "custom")} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library" className="flex items-center gap-2" data-testid="tab-library">
                <Library className="h-4 w-4" />
                Library
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center gap-2" data-testid="tab-custom">
                <Sparkles className="h-4 w-4" />
                Custom
              </TabsTrigger>
            </TabsList>

            {/* Library Tab */}
            <TabsContent value="library" className="mt-4 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  These templates follow Meta's guidelines for high approval rates
                </p>
              </div>

              {/* Category Filter */}
              <Select value={libraryCategory} onValueChange={setLibraryCategory}>
                <SelectTrigger data-testid="select-library-category">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {libraryCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Template Cards */}
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {filteredLibraryTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-lg hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    onClick={() => loadLibraryTemplate(template)}
                    data-testid={`library-template-${template.id}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{template.description}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {LANGUAGES.find(l => l.code === template.language)?.name || template.language}
                          </Badge>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="shrink-0" 
                        onClick={(e) => {
                          e.stopPropagation();
                          loadLibraryTemplate(template);
                        }}
                        data-testid={`button-use-${template.id}`}
                      >
                        Use
                      </Button>
                    </div>
                    <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {template.bodyText}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Custom Tab */}
            <TabsContent value="custom" className="mt-4 space-y-6">
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
                    placeholder="Describe what you need, e.g., 'appointment reminder for dental clinic' or 'order confirmation for online store'"
                    rows={3}
                    className="text-sm"
                    data-testid="input-ai-purpose"
                  />
                  <Button
                    variant="default"
                    className="w-full"
                    disabled={!aiPurpose.trim() || aiAssistMutation.isPending}
                    onClick={() => aiAssistMutation.mutate(aiPurpose)}
                    data-testid="button-ai-generate"
                  >
                    {aiAssistMutation.isPending ? (
                      <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {aiAssistMutation.isPending ? "Generating..." : "Generate Template"}
                  </Button>
                  <p className="text-xs text-slate-500 text-center">Pulse will auto-select the best category, language, and structure</p>
                </div>
              </div>

              {selectedLibraryTemplate && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Editing: {selectedLibraryTemplate.description}
                  </p>
                </div>
              )}

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
              {formData.category === "AUTHENTICATION" && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Note:</strong> Authentication templates have strict Meta requirements. 
                    Body text will be auto-generated with a Copy Code button. Custom text is not allowed.
                  </p>
                </div>
              )}
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
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Edit Template Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={(open) => {
        setEditSheetOpen(open);
        if (!open) {
          setEditingTemplate(null);
          resetForm();
        }
      }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-edit-template">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SiWhatsapp className="h-5 w-5 text-emerald-500" />
              Edit Template
            </SheetTitle>
            <SheetDescription>
              Update the template and resubmit for review
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Edit restrictions info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium">Editing Restrictions:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• You cannot change template name, category, or language</li>
                    <li>• Max 1 edit per 24 hours</li>
                    <li>• Max 10 edits in 30 days</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Template Info (Read-only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">Template Name</label>
              <Input value={formData.name} disabled className="bg-slate-50 dark:bg-slate-800" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Category</label>
                <Input value={formData.category} disabled className="bg-slate-50 dark:bg-slate-800" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-500">Language</label>
                <Input value={formData.language} disabled className="bg-slate-50 dark:bg-slate-800" />
              </div>
            </div>

            {/* Editable Header */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Header (Optional)</label>
              <Input
                value={formData.headerText}
                onChange={(e) => setFormData(prev => ({ ...prev, headerText: e.target.value }))}
                placeholder="Header text (max 60 characters)"
                maxLength={60}
                data-testid="input-edit-header"
              />
              <p className="text-xs text-slate-500">{formData.headerText.length}/60 characters</p>
            </div>

            {/* Editable Body */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Body <span className="text-red-500">*</span></label>
              <Textarea
                value={formData.bodyText}
                onChange={(e) => setFormData(prev => ({ ...prev, bodyText: e.target.value }))}
                placeholder="Message body (max 550 characters)"
                rows={5}
                maxLength={550}
                data-testid="input-edit-body"
              />
              <p className="text-xs text-slate-500">{formData.bodyText.length}/550 characters</p>
            </div>

            {/* Editable Footer */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Footer (Optional)</label>
              <Input
                value={formData.footerText}
                onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="Footer text (max 60 characters)"
                maxLength={60}
                data-testid="input-edit-footer"
              />
              <p className="text-xs text-slate-500">{formData.footerText.length}/60 characters</p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => { 
                  setEditSheetOpen(false); 
                  setEditingTemplate(null);
                  resetForm(); 
                }} 
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editingTemplate) return;
                  
                  const components: any[] = [];

                  if (formData.headerText) {
                    components.push({
                      type: "HEADER",
                      format: "TEXT",
                      text: formData.headerText,
                    });
                  }

                  if (formData.bodyText) {
                    components.push({
                      type: "BODY",
                      text: formData.bodyText,
                    });
                  }

                  if (formData.footerText) {
                    components.push({
                      type: "FOOTER",
                      text: formData.footerText,
                    });
                  }

                  editMutation.mutate({
                    templateId: editingTemplate.id,
                    components,
                  });
                }}
                disabled={editMutation.isPending || !formData.bodyText}
                data-testid="button-submit-edit"
              >
                {editMutation.isPending ? "Updating..." : "Update Template"}
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
