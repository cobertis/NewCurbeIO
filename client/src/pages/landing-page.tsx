import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Link,
  Share2,
  Video,
  Type,
  Image as ImageIcon,
  Mail,
  Minus,
  Phone,
  Plus,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Monitor,
  Smartphone,
  Check,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  MessageCircle,
  Palette,
  User,
  Settings,
  Sparkles,
  MapPin,
  UserPlus,
  Calendar as CalendarIcon,
  Star,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";

// Types
type LandingPage = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  profileName?: string;
  profileBio?: string;
  profilePhoto?: string;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    buttonColor?: string;
    buttonTextColor?: string;
  };
  seo: {
    title?: string;
    description?: string;
  };
  isPublished: boolean;
  isPasswordProtected: boolean;
  password?: string;
};

type LandingBlock = {
  id: string;
  type: string;
  content: Record<string, any>;
  position: number;
  isVisible: boolean;
  clickCount: number;
};

// Predefined themes
const PREDEFINED_THEMES = [
  {
    name: "Purple Gradient",
    theme: {
      primaryColor: "#8B5CF6",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#8B5CF6",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Clean White",
    theme: {
      primaryColor: "#000000",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      buttonColor: "#000000",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Dark Mode",
    theme: {
      primaryColor: "#60A5FA",
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
      buttonColor: "#60A5FA",
      buttonTextColor: "#0f172a",
    },
  },
  {
    name: "Sunset",
    theme: {
      primaryColor: "#F59E0B",
      backgroundColor: "#FEF3C7",
      textColor: "#78350F",
      buttonColor: "#F59E0B",
      buttonTextColor: "#ffffff",
    },
  },
];

// Social Media Platforms
const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "twitter", label: "Twitter", icon: Twitter },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "tiktok", label: "TikTok", icon: Video },
];

// SortableBlock Component
function SortableBlock({
  block,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  block: LandingBlock;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case "link":
        return <Link className="w-4 h-4" />;
      case "social":
        return <Share2 className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "text":
        return <Type className="w-4 h-4" />;
      case "image":
        return <ImageIcon className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "divider":
        return <Minus className="w-4 h-4" />;
      case "contact":
        return <Phone className="w-4 h-4" />;
      case "maps":
        return <MapPin className="w-4 h-4" />;
      case "lead-form":
        return <UserPlus className="w-4 h-4" />;
      case "calendar":
        return <CalendarIcon className="w-4 h-4" />;
      case "testimonials":
        return <Star className="w-4 h-4" />;
      case "faq":
        return <HelpCircle className="w-4 h-4" />;
      case "stats":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getBlockTitle = () => {
    switch (block.type) {
      case "link":
        return block.content.label || "Link Block";
      case "social":
        return `${block.content.platform || "Social"} Link`;
      case "video":
        return "Video Block";
      case "text":
        return "Text Block";
      case "image":
        return "Image Block";
      case "email":
        return "Email Form";
      case "divider":
        return "Divider";
      case "contact":
        return `${block.content.type || "Contact"} Block`;
      case "maps":
        return "Maps Block";
      case "lead-form":
        return "Lead Form";
      case "calendar":
        return "Scheduler";
      case "testimonials":
        return "Testimonials";
      case "faq":
        return "FAQ";
      case "stats":
        return "Stats";
      default:
        return "Block";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-900 rounded-[18px] border border-gray-200 dark:border-gray-700 p-4 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)] transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          data-testid={`drag-handle-${block.id}`}
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <div className="flex-1 flex items-center gap-2">
          <div className="text-purple-600 dark:text-purple-400">
            {getBlockIcon()}
          </div>
          <span className="font-medium text-sm">{getBlockTitle()}</span>
        </div>

        <div className="flex items-center gap-2">
          {block.clickCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {block.clickCount} clicks
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            data-testid={`edit-block-${block.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            data-testid={`toggle-visibility-${block.id}`}
          >
            {block.isVisible ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            data-testid={`delete-block-${block.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// BlockPreview Component
function BlockPreview({
  block,
  theme,
}: {
  block: LandingBlock;
  theme: any;
}) {
  if (!block.isVisible) return null;

  const buttonStyle = {
    backgroundColor: theme.buttonColor || theme.primaryColor,
    color: theme.buttonTextColor || "#ffffff",
  };

  switch (block.type) {
    case "link":
      return (
        <a
          href={block.content.url || "#"}
          target={block.content.openInNewTab ? "_blank" : "_self"}
          rel="noopener noreferrer"
          className="block rounded-[18px] px-6 py-4 text-center font-medium shadow-sm hover:shadow-md transition-shadow"
          style={buttonStyle}
          data-testid={`preview-link-${block.id}`}
        >
          {block.content.label || "Click Here"}
        </a>
      );

    case "social":
      const SocialIcon =
        SOCIAL_PLATFORMS.find((p) => p.value === block.content.platform)
          ?.icon || Share2;
      return (
        <a
          href={block.content.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-[18px] px-6 py-4 font-medium shadow-sm hover:shadow-md transition-shadow"
          style={buttonStyle}
          data-testid={`preview-social-${block.id}`}
        >
          <SocialIcon className="w-5 h-5" />
          {block.content.customLabel ||
            block.content.platform?.charAt(0).toUpperCase() +
              block.content.platform?.slice(1) ||
            "Social Media"}
        </a>
      );

    case "video":
      return (
        <div
          className="rounded-[18px] overflow-hidden shadow-sm"
          style={{ aspectRatio: block.content.aspectRatio || "16/9" }}
          data-testid={`preview-video-${block.id}`}
        >
          <iframe
            src={block.content.url || ""}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );

    case "text":
      return (
        <div
          className={`text-${block.content.alignment || "left"} ${
            block.content.size === "sm"
              ? "text-sm"
              : block.content.size === "lg"
              ? "text-lg"
              : "text-base"
          }`}
          style={{ color: theme.textColor }}
          data-testid={`preview-text-${block.id}`}
        >
          {block.content.content || "Your text here"}
        </div>
      );

    case "image":
      return (
        <div className="rounded-[18px] overflow-hidden shadow-sm" data-testid={`preview-image-${block.id}`}>
          <img
            src={block.content.url || "/placeholder.png"}
            alt={block.content.alt || "Image"}
            className="w-full h-auto"
            style={{ aspectRatio: block.content.aspectRatio }}
          />
        </div>
      );

    case "email":
      return (
        <div className="space-y-3" data-testid={`preview-email-${block.id}`}>
          <Input
            type="email"
            placeholder={block.content.placeholder || "Enter your email"}
            className="rounded-[18px]"
          />
          <Button className="w-full rounded-[18px]" style={buttonStyle}>
            {block.content.buttonText || "Subscribe"}
          </Button>
        </div>
      );

    case "divider":
      return (
        <hr
          className="my-4"
          style={{
            borderStyle: block.content.style || "solid",
            borderColor: theme.textColor,
            opacity: 0.2,
            width: block.content.width || "100%",
            margin: "0 auto",
          }}
          data-testid={`preview-divider-${block.id}`}
        />
      );

    case "contact":
      const contactIcons = {
        phone: Phone,
        email: Mail,
        whatsapp: MessageCircle,
      };
      const ContactIcon = contactIcons[block.content.type as keyof typeof contactIcons] || Phone;
      return (
        <a
          href={`${
            block.content.type === "email"
              ? "mailto:"
              : block.content.type === "whatsapp"
              ? "https://wa.me/"
              : "tel:"
          }${block.content.value || ""}`}
          className="flex items-center justify-center gap-2 rounded-[18px] px-6 py-4 font-medium shadow-sm hover:shadow-md transition-shadow"
          style={buttonStyle}
          data-testid={`preview-contact-${block.id}`}
        >
          <ContactIcon className="w-5 h-5" />
          {block.content.label || block.content.value || "Contact"}
        </a>
      );

    case "maps":
      return (
        <Card className="p-4">
          <MapPin className="h-6 w-6 mb-2" />
          <p className="text-sm text-muted-foreground">
            {block.content.address || "Map Location"}
          </p>
        </Card>
      );

    case "lead-form":
      return (
        <Card className="p-6" style={{ borderColor: theme.primaryColor }}>
          <h3 className="font-semibold mb-2">{block.content.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">{block.content.subtitle}</p>
          <div className="space-y-2">
            {block.content.fields?.map((field: any, idx: number) => (
              <div key={idx} className="h-10 bg-gray-100 rounded"></div>
            ))}
          </div>
          <Button 
            className="w-full mt-4" 
            style={{ backgroundColor: theme.buttonColor }}
          >
            {block.content.submitText}
          </Button>
        </Card>
      );

    case "calendar":
      return (
        <Card className="p-6">
          <CalendarIcon className="h-6 w-6 mb-2" />
          <h3 className="font-semibold mb-2">{block.content.title}</h3>
          <p className="text-sm text-muted-foreground">{block.content.subtitle}</p>
        </Card>
      );

    case "testimonials":
      return (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
            <div>
              <p className="font-semibold">{block.content.reviews?.[0]?.name || "Name"}</p>
              <p className="text-sm text-muted-foreground">{block.content.reviews?.[0]?.role || "Role"}</p>
            </div>
          </div>
          <div className="flex gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-sm">{block.content.reviews?.[0]?.text || "Review text"}</p>
        </Card>
      );

    case "faq":
      return (
        <Card className="p-4">
          <HelpCircle className="h-6 w-6 mb-2" />
          <p className="font-medium">{block.content.items?.[0]?.question || "Question"}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {block.content.items?.[0]?.answer || "Answer"}
          </p>
        </Card>
      );

    case "stats":
      return (
        <div className="grid grid-cols-2 gap-4">
          {block.content.stats?.map((stat: any, idx: number) => (
            <Card key={idx} className="p-6 text-center">
              <p className="text-3xl font-bold" style={{ color: theme.primaryColor }}>
                {stat.value}{stat.suffix}
              </p>
              <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
            </Card>
          ))}
        </div>
      );

    default:
      return null;
  }
}

export default function LandingPageBuilder() {
  const { toast } = useToast();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<LandingBlock[]>([]);
  const [editingBlock, setEditingBlock] = useState<LandingBlock | null>(null);
  const [isBlockEditorOpen, setIsBlockEditorOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch landing pages
  const { data: landingPagesResponse, isLoading: isPagesLoading } = useQuery<{
    landingPages: LandingPage[];
  }>({
    queryKey: ["/api/landing-pages"],
  });
  const landingPages = landingPagesResponse?.landingPages || [];

  // Fetch selected page details
  const { data: selectedPage, isLoading: isPageLoading } = useQuery<{
    landingPage: LandingPage;
    blocks: LandingBlock[];
  }>({
    queryKey: ["/api/landing-pages", selectedPageId],
    enabled: !!selectedPageId,
  });

  // Update blocks when page changes
  useEffect(() => {
    if (selectedPage) {
      setBlocks(selectedPage.blocks || []);
    }
  }, [selectedPage]);

  // Auto-create landing page if user doesn't have one
  useEffect(() => {
    if (!isPagesLoading && landingPages && landingPages.length === 0) {
      const slug = `page-${Date.now()}`;
      createPageMutation.mutate({
        title: "Mi Landing Page",
        slug,
        description: "Mi página de enlaces personalizada",
      });
    }
  }, [isPagesLoading, landingPages]);

  // Select first (and only) page by default
  useEffect(() => {
    if (landingPages && landingPages.length > 0 && !selectedPageId) {
      setSelectedPageId(landingPages[0].id);
    }
  }, [landingPages, selectedPageId]);

  // Create landing page mutation
  const createPageMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/landing-pages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing-pages"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create landing page",
      });
    },
  });

  // Update landing page mutation
  const updatePageMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<LandingPage>;
    }) => {
      return await apiRequest("PATCH", `/api/landing-pages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landing-pages"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", selectedPageId],
      });
      toast({
        title: "Changes saved",
        description: "Your changes have been saved successfully.",
      });
    },
  });

  // Create block mutation
  const createBlockMutation = useMutation({
    mutationFn: async ({
      landingPageId,
      data,
    }: {
      landingPageId: string;
      data: any;
    }) => {
      return await apiRequest(
        "POST",
        `/api/landing-pages/${landingPageId}/blocks`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", selectedPageId],
      });
    },
  });

  // Update block mutation
  const updateBlockMutation = useMutation({
    mutationFn: async ({ blockId, data }: { blockId: string; data: any }) => {
      return await apiRequest(
        "PATCH",
        `/api/landing-pages/${selectedPageId}/blocks/${blockId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", selectedPageId],
      });
      setIsBlockEditorOpen(false);
      setEditingBlock(null);
    },
  });

  // Delete block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      return await apiRequest(
        "DELETE",
        `/api/landing-pages/${selectedPageId}/blocks/${blockId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", selectedPageId],
      });
    },
  });

  // Reorder blocks mutation
  const reorderBlocksMutation = useMutation({
    mutationFn: async (blockIds: string[]) => {
      return await apiRequest(
        "POST",
        `/api/landing-pages/${selectedPageId}/blocks/reorder`,
        { blockIds }
      );
    },
  });

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

        // Update positions and save to backend
        const blockIds = newItems.map((block) => block.id);
        reorderBlocksMutation.mutate(blockIds);

        return newItems;
      });
    }
  };

  // Add block functions
  const addBlock = useCallback(
    (type: string, customContent: Record<string, any> = {}) => {
      if (!selectedPageId) return;

      const defaultContentMap: Record<string, any> = {
        maps: {
          address: "",
          latitude: null,
          longitude: null,
          zoom: 14,
          showMarker: true,
        },
        "lead-form": {
          title: "Get in Touch",
          subtitle: "We'll get back to you within 24 hours",
          fields: [
            { name: "fullName", type: "text", required: true, placeholder: "Full Name" },
            { name: "email", type: "email", required: true, placeholder: "Email Address" },
            { name: "phone", type: "tel", required: false, placeholder: "Phone Number" },
            { name: "message", type: "textarea", required: false, placeholder: "Your Message" },
          ],
          submitText: "Submit",
          successMessage: "Thank you! We'll be in touch soon.",
          sendNotification: true,
        },
        calendar: {
          title: "Schedule a Meeting",
          subtitle: "Pick a time that works for you",
          availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          availableHours: { start: "09:00", end: "17:00" },
          duration: 30,
          timezone: "America/New_York",
          successMessage: "Your appointment has been scheduled!",
        },
        testimonials: {
          reviews: [
            { name: "John Doe", role: "CEO", photo: "", rating: 5, text: "Great service!" },
          ],
          layout: "carousel",
        },
        faq: {
          items: [
            { question: "How can I help you?", answer: "We're here to assist with any questions." },
          ],
        },
        stats: {
          stats: [
            { label: "Happy Clients", value: "500", suffix: "+", icon: "users" },
            { label: "Projects", value: "100", suffix: "+", icon: "briefcase" },
          ],
        },
      };

      const defaultContent = defaultContentMap[type] || customContent;

      createBlockMutation.mutate({
        landingPageId: selectedPageId,
        data: {
          landingPageId: selectedPageId,
          type,
          content: { ...defaultContent, ...customContent },
          position: blocks.length,
          isVisible: true,
        },
      });
    },
    [selectedPageId, blocks.length]
  );

  // Auto-save with debounce
  useEffect(() => {
    if (!selectedPage) return;

    const timer = setTimeout(() => {
      // Auto-save logic here if needed
    }, 1000);

    return () => clearTimeout(timer);
  }, [selectedPage]);

  if (isPagesLoading) {
    return <LoadingSpinner message="Loading landing page builder..." />;
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Left Sidebar - Customization */}
      <div className="w-[300px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Customization Panel */}
          {selectedPage && (
            <Accordion
              type="single"
              collapsible
              defaultValue="theme"
              className="space-y-2"
            >
              <AccordionItem
                value="theme"
                className="rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)]"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    <span className="font-medium">Temas</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    {PREDEFINED_THEMES.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() =>
                          updatePageMutation.mutate({
                            id: selectedPageId!,
                            data: { theme: preset.theme },
                          })
                        }
                        className="p-3 rounded-lg border hover:border-purple-500 transition-colors text-left"
                        data-testid={`theme-${preset.name.toLowerCase().replace(" ", "-")}`}
                      >
                        <div
                          className="w-full h-8 rounded mb-2"
                          style={{
                            background: `linear-gradient(135deg, ${preset.theme.primaryColor}, ${preset.theme.backgroundColor})`,
                          }}
                        />
                        <p className="text-xs font-medium">{preset.name}</p>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="colors"
                className="rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)]"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-medium">Colores</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 space-y-4">
                  <div>
                    <Label htmlFor="primaryColor" className="text-xs">
                      Color Primario
                    </Label>
                    <Input
                      id="primaryColor"
                      type="color"
                      value={selectedPage.landingPage.theme.primaryColor}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: {
                            theme: {
                              ...selectedPage.landingPage.theme,
                              primaryColor: e.target.value,
                            },
                          },
                        })
                      }
                      className="h-10"
                      data-testid="input-primary-color"
                    />
                  </div>
                  <div>
                    <Label htmlFor="backgroundColor" className="text-xs">
                      Color de Fondo
                    </Label>
                    <Input
                      id="backgroundColor"
                      type="color"
                      value={selectedPage.landingPage.theme.backgroundColor}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: {
                            theme: {
                              ...selectedPage.landingPage.theme,
                              backgroundColor: e.target.value,
                            },
                          },
                        })
                      }
                      className="h-10"
                      data-testid="input-background-color"
                    />
                  </div>
                  <div>
                    <Label htmlFor="textColor" className="text-xs">
                      Color de Texto
                    </Label>
                    <Input
                      id="textColor"
                      type="color"
                      value={selectedPage.landingPage.theme.textColor}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: {
                            theme: {
                              ...selectedPage.landingPage.theme,
                              textColor: e.target.value,
                            },
                          },
                        })
                      }
                      className="h-10"
                      data-testid="input-text-color"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="profile"
                className="rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)]"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Perfil</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 space-y-4">
                  <div>
                    <Label htmlFor="profileName" className="text-xs">
                      Nombre
                    </Label>
                    <Input
                      id="profileName"
                      value={selectedPage.landingPage.profileName || ""}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: { profileName: e.target.value },
                        })
                      }
                      placeholder="Tu nombre"
                      data-testid="input-profile-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="profileBio" className="text-xs">
                      Bio
                    </Label>
                    <Textarea
                      id="profileBio"
                      value={selectedPage.landingPage.profileBio || ""}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: { profileBio: e.target.value },
                        })
                      }
                      placeholder="Tu biografía"
                      data-testid="input-profile-bio"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="settings"
                className="rounded-[18px] border bg-white dark:bg-slate-900 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)]"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium">Configuración</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4 space-y-4">
                  <div>
                    <Label htmlFor="slug" className="text-xs">
                      Slug (URL)
                    </Label>
                    <Input
                      id="slug"
                      value={selectedPage.landingPage.slug}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: { slug: e.target.value },
                        })
                      }
                      data-testid="input-slug"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password-protection" className="text-xs">
                      Protección con contraseña
                    </Label>
                    <Switch
                      id="password-protection"
                      checked={
                        selectedPage.landingPage.isPasswordProtected || false
                      }
                      onCheckedChange={(checked) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: { isPasswordProtected: checked },
                        })
                      }
                      data-testid="switch-password-protection"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seo-title" className="text-xs">
                      SEO Título
                    </Label>
                    <Input
                      id="seo-title"
                      value={selectedPage.landingPage.seo.title || ""}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: {
                            seo: {
                              ...selectedPage.landingPage.seo,
                              title: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder="Título para SEO"
                      data-testid="input-seo-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seo-description" className="text-xs">
                      SEO Descripción
                    </Label>
                    <Textarea
                      id="seo-description"
                      value={selectedPage.landingPage.seo.description || ""}
                      onChange={(e) =>
                        updatePageMutation.mutate({
                          id: selectedPageId!,
                          data: {
                            seo: {
                              ...selectedPage.landingPage.seo,
                              description: e.target.value,
                            },
                          },
                        })
                      }
                      placeholder="Descripción para SEO"
                      data-testid="input-seo-description"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </div>

      {/* Center - Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {isPageLoading ? (
            <LoadingSpinner
              message="Loading page..."
              fullScreen={false}
            />
          ) : selectedPage ? (
            <>
              {/* Block Toolbar */}
              <Card className="rounded-[18px] shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)]">
                <CardContent className="p-6">
                  <p className="text-sm font-medium mb-3">Agregar Bloques</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("link", { label: "My Link" })}
                      data-testid="button-add-link"
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        addBlock("social", { platform: "instagram" })
                      }
                      data-testid="button-add-social"
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Social
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("video", { aspectRatio: "16/9" })}
                      data-testid="button-add-video"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      Video
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("text", { alignment: "center" })}
                      data-testid="button-add-text"
                    >
                      <Type className="w-4 h-4 mr-2" />
                      Text
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("image", {})}
                      data-testid="button-add-image"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Image
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("email", {})}
                      data-testid="button-add-email"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("divider", { style: "solid" })}
                      data-testid="button-add-divider"
                    >
                      <Minus className="w-4 h-4 mr-2" />
                      Divider
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("contact", { type: "email" })}
                      data-testid="button-add-contact"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Contact
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("maps")}
                      data-testid="add-maps-block"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Maps
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("lead-form")}
                      data-testid="add-lead-form-block"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Lead Form
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("calendar")}
                      data-testid="add-calendar-block"
                    >
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Scheduler
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("testimonials")}
                      data-testid="add-testimonials-block"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Testimonials
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("faq")}
                      data-testid="add-faq-block"
                    >
                      <HelpCircle className="h-4 w-4 mr-2" />
                      FAQ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addBlock("stats")}
                      data-testid="add-stats-block"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Stats
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Blocks List */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {blocks.length === 0 ? (
                      <Card className="rounded-[18px] border-dashed">
                        <CardContent className="p-12 text-center">
                          <p className="text-gray-500">
                            No hay bloques aún. Agrega tu primer bloque desde
                            arriba.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      blocks.map((block) => (
                        <SortableBlock
                          key={block.id}
                          block={block}
                          onEdit={() => {
                            setEditingBlock(block);
                            setIsBlockEditorOpen(true);
                          }}
                          onToggleVisibility={() => {
                            updateBlockMutation.mutate({
                              blockId: block.id,
                              data: { isVisible: !block.isVisible },
                            });
                          }}
                          onDelete={() => {
                            if (
                              confirm(
                                "¿Estás seguro de eliminar este bloque?"
                              )
                            ) {
                              deleteBlockMutation.mutate(block.id);
                            }
                          }}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Block Editor Sheet */}
              <Sheet
                open={isBlockEditorOpen}
                onOpenChange={setIsBlockEditorOpen}
              >
                <SheetContent className="sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Editar Bloque</SheetTitle>
                    <SheetDescription>
                      Configura el contenido de tu bloque
                    </SheetDescription>
                  </SheetHeader>
                  {editingBlock && (
                    <div className="space-y-4 py-6">
                      {editingBlock.type === "link" && (
                        <>
                          <div>
                            <Label>Etiqueta</Label>
                            <Input
                              value={editingBlock.content.label || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    label: e.target.value,
                                  },
                                })
                              }
                              placeholder="Click Here"
                            />
                          </div>
                          <div>
                            <Label>URL</Label>
                            <Input
                              value={editingBlock.content.url || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    url: e.target.value,
                                  },
                                })
                              }
                              placeholder="https://example.com"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingBlock.content.openInNewTab || false}
                              onCheckedChange={(checked) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    openInNewTab: checked,
                                  },
                                })
                              }
                            />
                            <Label>Abrir en nueva pestaña</Label>
                          </div>
                        </>
                      )}

                      {editingBlock.type === "social" && (
                        <>
                          <div>
                            <Label>Plataforma</Label>
                            <Select
                              value={editingBlock.content.platform || "instagram"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    platform: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SOCIAL_PLATFORMS.map((platform) => (
                                  <SelectItem
                                    key={platform.value}
                                    value={platform.value}
                                  >
                                    {platform.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>URL</Label>
                            <Input
                              value={editingBlock.content.url || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    url: e.target.value,
                                  },
                                })
                              }
                              placeholder="https://instagram.com/username"
                            />
                          </div>
                          <div>
                            <Label>Etiqueta personalizada (opcional)</Label>
                            <Input
                              value={editingBlock.content.customLabel || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    customLabel: e.target.value,
                                  },
                                })
                              }
                              placeholder="Síguenos en Instagram"
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "video" && (
                        <>
                          <div>
                            <Label>URL del Video (YouTube/Vimeo embed)</Label>
                            <Input
                              value={editingBlock.content.url || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    url: e.target.value,
                                  },
                                })
                              }
                              placeholder="https://www.youtube.com/embed/..."
                            />
                          </div>
                          <div>
                            <Label>Aspecto de Ratio</Label>
                            <Select
                              value={editingBlock.content.aspectRatio || "16/9"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    aspectRatio: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="16/9">16:9</SelectItem>
                                <SelectItem value="1/1">1:1</SelectItem>
                                <SelectItem value="9/16">9:16</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {editingBlock.type === "text" && (
                        <>
                          <div>
                            <Label>Contenido</Label>
                            <Textarea
                              value={editingBlock.content.content || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    content: e.target.value,
                                  },
                                })
                              }
                              placeholder="Tu texto aquí"
                              rows={4}
                            />
                          </div>
                          <div>
                            <Label>Alineación</Label>
                            <Select
                              value={editingBlock.content.alignment || "left"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    alignment: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="left">Izquierda</SelectItem>
                                <SelectItem value="center">Centro</SelectItem>
                                <SelectItem value="right">Derecha</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Tamaño</Label>
                            <Select
                              value={editingBlock.content.size || "md"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    size: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sm">Pequeño</SelectItem>
                                <SelectItem value="md">Mediano</SelectItem>
                                <SelectItem value="lg">Grande</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {editingBlock.type === "image" && (
                        <>
                          <div>
                            <Label>URL de la Imagen</Label>
                            <Input
                              value={editingBlock.content.url || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    url: e.target.value,
                                  },
                                })
                              }
                              placeholder="https://example.com/image.jpg"
                            />
                          </div>
                          <div>
                            <Label>Texto Alternativo</Label>
                            <Input
                              value={editingBlock.content.alt || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    alt: e.target.value,
                                  },
                                })
                              }
                              placeholder="Descripción de la imagen"
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "email" && (
                        <>
                          <div>
                            <Label>Placeholder</Label>
                            <Input
                              value={editingBlock.content.placeholder || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    placeholder: e.target.value,
                                  },
                                })
                              }
                              placeholder="Enter your email"
                            />
                          </div>
                          <div>
                            <Label>Texto del Botón</Label>
                            <Input
                              value={editingBlock.content.buttonText || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    buttonText: e.target.value,
                                  },
                                })
                              }
                              placeholder="Subscribe"
                            />
                          </div>
                          <div>
                            <Label>Mensaje de Éxito</Label>
                            <Input
                              value={editingBlock.content.successMessage || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    successMessage: e.target.value,
                                  },
                                })
                              }
                              placeholder="Thanks for subscribing!"
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "divider" && (
                        <>
                          <div>
                            <Label>Estilo</Label>
                            <Select
                              value={editingBlock.content.style || "solid"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    style: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="solid">Sólido</SelectItem>
                                <SelectItem value="dashed">Punteado</SelectItem>
                                <SelectItem value="dotted">Puntos</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Ancho</Label>
                            <Select
                              value={editingBlock.content.width || "100%"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    width: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="25%">25%</SelectItem>
                                <SelectItem value="50%">50%</SelectItem>
                                <SelectItem value="100%">100%</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {editingBlock.type === "contact" && (
                        <>
                          <div>
                            <Label>Tipo</Label>
                            <Select
                              value={editingBlock.content.type || "email"}
                              onValueChange={(value) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    type: value,
                                  },
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="phone">Teléfono</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Valor</Label>
                            <Input
                              value={editingBlock.content.value || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    value: e.target.value,
                                  },
                                })
                              }
                              placeholder={
                                editingBlock.content.type === "email"
                                  ? "email@example.com"
                                  : "+1234567890"
                              }
                            />
                          </div>
                          <div>
                            <Label>Etiqueta</Label>
                            <Input
                              value={editingBlock.content.label || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    label: e.target.value,
                                  },
                                })
                              }
                              placeholder="Contact Me"
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "maps" && (
                        <>
                          <div>
                            <Label>Dirección</Label>
                            <Input
                              value={editingBlock.content.address || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    address: e.target.value,
                                  },
                                })
                              }
                              placeholder="123 Main St, City, State"
                            />
                          </div>
                          <div>
                            <Label>Latitud</Label>
                            <Input
                              type="number"
                              step="any"
                              value={editingBlock.content.latitude || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    latitude: e.target.value ? parseFloat(e.target.value) : null,
                                  },
                                })
                              }
                              placeholder="40.7128"
                            />
                          </div>
                          <div>
                            <Label>Longitud</Label>
                            <Input
                              type="number"
                              step="any"
                              value={editingBlock.content.longitude || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    longitude: e.target.value ? parseFloat(e.target.value) : null,
                                  },
                                })
                              }
                              placeholder="-74.0060"
                            />
                          </div>
                          <div>
                            <Label>Zoom</Label>
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              value={editingBlock.content.zoom || 14}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    zoom: parseInt(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingBlock.content.showMarker || false}
                              onCheckedChange={(checked) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    showMarker: checked,
                                  },
                                })
                              }
                            />
                            <Label>Mostrar marcador</Label>
                          </div>
                        </>
                      )}

                      {editingBlock.type === "lead-form" && (
                        <>
                          <div>
                            <Label>Título</Label>
                            <Input
                              value={editingBlock.content.title || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    title: e.target.value,
                                  },
                                })
                              }
                              placeholder="Get in Touch"
                            />
                          </div>
                          <div>
                            <Label>Subtítulo</Label>
                            <Input
                              value={editingBlock.content.subtitle || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    subtitle: e.target.value,
                                  },
                                })
                              }
                              placeholder="We'll get back to you within 24 hours"
                            />
                          </div>
                          <div>
                            <Label>Texto del botón</Label>
                            <Input
                              value={editingBlock.content.submitText || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    submitText: e.target.value,
                                  },
                                })
                              }
                              placeholder="Submit"
                            />
                          </div>
                          <div>
                            <Label>Mensaje de éxito</Label>
                            <Input
                              value={editingBlock.content.successMessage || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    successMessage: e.target.value,
                                  },
                                })
                              }
                              placeholder="Thank you! We'll be in touch soon."
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "calendar" && (
                        <>
                          <div>
                            <Label>Título</Label>
                            <Input
                              value={editingBlock.content.title || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    title: e.target.value,
                                  },
                                })
                              }
                              placeholder="Schedule a Meeting"
                            />
                          </div>
                          <div>
                            <Label>Subtítulo</Label>
                            <Input
                              value={editingBlock.content.subtitle || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    subtitle: e.target.value,
                                  },
                                })
                              }
                              placeholder="Pick a time that works for you"
                            />
                          </div>
                          <div>
                            <Label>Duración (minutos)</Label>
                            <Input
                              type="number"
                              value={editingBlock.content.duration || 30}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    duration: parseInt(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Hora de inicio</Label>
                            <Input
                              type="time"
                              value={editingBlock.content.availableHours?.start || "09:00"}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    availableHours: {
                                      ...editingBlock.content.availableHours,
                                      start: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Hora de fin</Label>
                            <Input
                              type="time"
                              value={editingBlock.content.availableHours?.end || "17:00"}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    availableHours: {
                                      ...editingBlock.content.availableHours,
                                      end: e.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Mensaje de éxito</Label>
                            <Input
                              value={editingBlock.content.successMessage || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    successMessage: e.target.value,
                                  },
                                })
                              }
                              placeholder="Your appointment has been scheduled!"
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "testimonials" && (
                        <>
                          <div>
                            <Label>Nombre</Label>
                            <Input
                              value={editingBlock.content.reviews?.[0]?.name || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    reviews: [
                                      {
                                        ...(editingBlock.content.reviews?.[0] || {}),
                                        name: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="John Doe"
                            />
                          </div>
                          <div>
                            <Label>Cargo</Label>
                            <Input
                              value={editingBlock.content.reviews?.[0]?.role || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    reviews: [
                                      {
                                        ...(editingBlock.content.reviews?.[0] || {}),
                                        role: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="CEO"
                            />
                          </div>
                          <div>
                            <Label>Calificación (1-5)</Label>
                            <Input
                              type="number"
                              min="1"
                              max="5"
                              value={editingBlock.content.reviews?.[0]?.rating || 5}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    reviews: [
                                      {
                                        ...(editingBlock.content.reviews?.[0] || {}),
                                        rating: parseInt(e.target.value),
                                      },
                                    ],
                                  },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Texto de la reseña</Label>
                            <Textarea
                              value={editingBlock.content.reviews?.[0]?.text || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    reviews: [
                                      {
                                        ...(editingBlock.content.reviews?.[0] || {}),
                                        text: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="Great service!"
                              rows={4}
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "faq" && (
                        <>
                          <div>
                            <Label>Pregunta</Label>
                            <Input
                              value={editingBlock.content.items?.[0]?.question || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    items: [
                                      {
                                        ...(editingBlock.content.items?.[0] || {}),
                                        question: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="How can I help you?"
                            />
                          </div>
                          <div>
                            <Label>Respuesta</Label>
                            <Textarea
                              value={editingBlock.content.items?.[0]?.answer || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    items: [
                                      {
                                        ...(editingBlock.content.items?.[0] || {}),
                                        answer: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="We're here to assist with any questions."
                              rows={4}
                            />
                          </div>
                        </>
                      )}

                      {editingBlock.type === "stats" && (
                        <>
                          <div>
                            <Label>Etiqueta (Estadística 1)</Label>
                            <Input
                              value={editingBlock.content.stats?.[0]?.label || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: [
                                      {
                                        ...(editingBlock.content.stats?.[0] || {}),
                                        label: e.target.value,
                                      },
                                      ...(editingBlock.content.stats?.slice(1) || []),
                                    ],
                                  },
                                })
                              }
                              placeholder="Happy Clients"
                            />
                          </div>
                          <div>
                            <Label>Valor (Estadística 1)</Label>
                            <Input
                              value={editingBlock.content.stats?.[0]?.value || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: [
                                      {
                                        ...(editingBlock.content.stats?.[0] || {}),
                                        value: e.target.value,
                                      },
                                      ...(editingBlock.content.stats?.slice(1) || []),
                                    ],
                                  },
                                })
                              }
                              placeholder="500"
                            />
                          </div>
                          <div>
                            <Label>Sufijo (Estadística 1)</Label>
                            <Input
                              value={editingBlock.content.stats?.[0]?.suffix || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: [
                                      {
                                        ...(editingBlock.content.stats?.[0] || {}),
                                        suffix: e.target.value,
                                      },
                                      ...(editingBlock.content.stats?.slice(1) || []),
                                    ],
                                  },
                                })
                              }
                              placeholder="+"
                            />
                          </div>
                          <Separator />
                          <div>
                            <Label>Etiqueta (Estadística 2)</Label>
                            <Input
                              value={editingBlock.content.stats?.[1]?.label || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: [
                                      editingBlock.content.stats?.[0] || {},
                                      {
                                        ...(editingBlock.content.stats?.[1] || {}),
                                        label: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="Projects"
                            />
                          </div>
                          <div>
                            <Label>Valor (Estadística 2)</Label>
                            <Input
                              value={editingBlock.content.stats?.[1]?.value || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: [
                                      editingBlock.content.stats?.[0] || {},
                                      {
                                        ...(editingBlock.content.stats?.[1] || {}),
                                        value: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="100"
                            />
                          </div>
                          <div>
                            <Label>Sufijo (Estadística 2)</Label>
                            <Input
                              value={editingBlock.content.stats?.[1]?.suffix || ""}
                              onChange={(e) =>
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: [
                                      editingBlock.content.stats?.[0] || {},
                                      {
                                        ...(editingBlock.content.stats?.[1] || {}),
                                        suffix: e.target.value,
                                      },
                                    ],
                                  },
                                })
                              }
                              placeholder="+"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <SheetFooter>
                    <Button
                      onClick={() => {
                        if (editingBlock) {
                          updateBlockMutation.mutate({
                            blockId: editingBlock.id,
                            data: { content: editingBlock.content },
                          });
                        }
                      }}
                      disabled={updateBlockMutation.isPending}
                      data-testid="button-save-block"
                    >
                      Guardar Cambios
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Card className="rounded-[18px] border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">
                  Selecciona una landing page o crea una nueva
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Right Sidebar - Preview */}
      <div className="w-[380px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Vista Previa</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode("desktop")}
                className={
                  previewMode === "desktop" ? "bg-purple-100" : ""
                }
                data-testid="button-preview-desktop"
              >
                <Monitor className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode("mobile")}
                className={
                  previewMode === "mobile" ? "bg-purple-100" : ""
                }
                data-testid="button-preview-mobile"
              >
                <Smartphone className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {selectedPage && (
            <>
              <div className="mb-4">
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                  onClick={() => {
                    updatePageMutation.mutate({
                      id: selectedPageId!,
                      data: {
                        isPublished: !selectedPage.landingPage.isPublished,
                      },
                    });
                  }}
                  data-testid="button-publish-page"
                >
                  {selectedPage.landingPage.isPublished
                    ? "Despublicar"
                    : "Publicar"}
                </Button>
              </div>

              <div
                className={`rounded-[18px] overflow-hidden shadow-lg ${
                  previewMode === "mobile" ? "max-w-[350px] mx-auto" : ""
                }`}
              >
                <div
                  className="p-8"
                  style={{
                    backgroundColor:
                      selectedPage.landingPage.theme.backgroundColor,
                  }}
                >
                  {/* Profile Section */}
                  <div className="text-center mb-8">
                    <Avatar className="w-24 h-24 mx-auto mb-4">
                      <AvatarImage
                        src={selectedPage.landingPage.profilePhoto || ""}
                      />
                      <AvatarFallback>
                        {(selectedPage.landingPage.profileName ||
                          selectedPage.landingPage.title ||
                          "LP")
                          .substring(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {selectedPage.landingPage.profileName && (
                      <h1
                        className="text-2xl font-bold mb-2"
                        style={{
                          color: selectedPage.landingPage.theme.textColor,
                        }}
                      >
                        {selectedPage.landingPage.profileName}
                      </h1>
                    )}
                    {selectedPage.landingPage.profileBio && (
                      <p
                        className="text-sm"
                        style={{
                          color: selectedPage.landingPage.theme.textColor,
                          opacity: 0.8,
                        }}
                      >
                        {selectedPage.landingPage.profileBio}
                      </p>
                    )}
                  </div>

                  {/* Blocks */}
                  <div className="space-y-3">
                    {blocks
                      .filter((b) => b.isVisible)
                      .map((block) => (
                        <BlockPreview
                          key={block.id}
                          block={block}
                          theme={selectedPage.landingPage.theme}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
