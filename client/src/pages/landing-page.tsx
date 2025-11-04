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
  Link as LinkIcon,
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
  X,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Youtube,
  MessageCircle,
  Palette,
  User,
  Settings as SettingsIcon,
  Sparkles,
  MapPin,
  UserPlus,
  Calendar as CalendarIcon,
  Star,
  HelpCircle,
  TrendingUp,
  ExternalLink,
  Undo,
  Redo,
  BarChart,
  Layers,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

// Predefined themes with gradients
const THEMES = [
  {
    name: "Purple Dream",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    category: "all",
    theme: {
      primaryColor: "#667eea",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#667eea",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Pink Sunset",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    category: "light",
    theme: {
      primaryColor: "#f093fb",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#f093fb",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Ocean Blue",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    category: "all",
    theme: {
      primaryColor: "#4facfe",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#4facfe",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Dark Night",
    gradient: "linear-gradient(135deg, #2c3e50 0%, #000000 100%)",
    category: "dark",
    theme: {
      primaryColor: "#60A5FA",
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
      buttonColor: "#60A5FA",
      buttonTextColor: "#0f172a",
    },
  },
  {
    name: "Mint Fresh",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    category: "light",
    theme: {
      primaryColor: "#43e97b",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#43e97b",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Sunset Orange",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    category: "light",
    theme: {
      primaryColor: "#fa709a",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#fa709a",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Royal Purple",
    gradient: "linear-gradient(135deg, #7f00ff 0%, #e100ff 100%)",
    category: "all",
    theme: {
      primaryColor: "#7f00ff",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#7f00ff",
      buttonTextColor: "#ffffff",
    },
  },
  {
    name: "Deep Space",
    gradient: "linear-gradient(135deg, #000428 0%, #004e92 100%)",
    category: "dark",
    theme: {
      primaryColor: "#004e92",
      backgroundColor: "#000428",
      textColor: "#f8fafc",
      buttonColor: "#004e92",
      buttonTextColor: "#ffffff",
    },
  },
];

// Social Media Platforms
const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { value: "twitter", label: "Twitter", icon: Twitter, color: "#1DA1F2" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
  { value: "youtube", label: "YouTube", icon: Youtube, color: "#FF0000" },
  { value: "tiktok", label: "TikTok", icon: Video, color: "#000000" },
];

// Block types for the sidebar
const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: Type, color: "#8B5CF6" },
  { type: "calendar", label: "Calendar", icon: CalendarIcon, color: "#F59E0B" },
  { type: "link", label: "Button", icon: LinkIcon, color: "#3B82F6" },
  { type: "image", label: "Image", icon: ImageIcon, color: "#EC4899" },
  { type: "video", label: "Video", icon: Video, color: "#EF4444" },
  { type: "social", label: "Link", icon: Share2, color: "#10B981" },
  { type: "maps", label: "Map", icon: MapPin, color: "#F97316" },
  { type: "email", label: "Newsletter", icon: Mail, color: "#6366F1" },
];

// SortableBlock Component - renders inside the device preview
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
        return <LinkIcon className="w-3 h-3" />;
      case "social":
        return <Share2 className="w-3 h-3" />;
      case "video":
        return <Video className="w-3 h-3" />;
      case "text":
        return <Type className="w-3 h-3" />;
      case "image":
        return <ImageIcon className="w-3 h-3" />;
      case "email":
        return <Mail className="w-3 h-3" />;
      case "divider":
        return <Minus className="w-3 h-3" />;
      case "contact":
        return <Phone className="w-3 h-3" />;
      case "maps":
        return <MapPin className="w-3 h-3" />;
      case "lead-form":
        return <UserPlus className="w-3 h-3" />;
      case "calendar":
        return <CalendarIcon className="w-3 h-3" />;
      case "testimonials":
        return <Star className="w-3 h-3" />;
      case "faq":
        return <HelpCircle className="w-3 h-3" />;
      case "stats":
        return <TrendingUp className="w-3 h-3" />;
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
      className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          data-testid={`drag-handle-${block.id}`}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <div className="text-purple-600 dark:text-purple-400">
            {getBlockIcon()}
          </div>
          <span className="font-medium text-xs truncate">{getBlockTitle()}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-6 w-6 p-0"
            data-testid={`edit-block-${block.id}`}
          >
            <Edit className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            className="h-6 w-6 p-0"
            data-testid={`toggle-visibility-${block.id}`}
          >
            {block.isVisible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3 text-gray-400" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            data-testid={`delete-block-${block.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// BlockPreview Component - displays the visual representation
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
          className="block rounded-lg px-4 py-3 text-center font-medium text-sm shadow-sm hover:shadow-md transition-shadow"
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
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium text-sm shadow-sm hover:shadow-md transition-shadow"
          style={buttonStyle}
          data-testid={`preview-social-${block.id}`}
        >
          <SocialIcon className="w-4 h-4" />
          {block.content.customLabel ||
            block.content.platform?.charAt(0).toUpperCase() +
              block.content.platform?.slice(1) ||
            "Social Media"}
        </a>
      );

    case "video":
      return (
        <div
          className="rounded-lg overflow-hidden shadow-sm"
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
              ? "text-xs"
              : block.content.size === "lg"
              ? "text-base"
              : "text-sm"
          }`}
          style={{ color: theme.textColor }}
          data-testid={`preview-text-${block.id}`}
        >
          {block.content.content || "Your text here"}
        </div>
      );

    case "image":
      return (
        <div className="rounded-lg overflow-hidden shadow-sm" data-testid={`preview-image-${block.id}`}>
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
        <div className="space-y-2" data-testid={`preview-email-${block.id}`}>
          <Input
            type="email"
            placeholder={block.content.placeholder || "Enter your email"}
            className="rounded-lg text-xs h-8"
          />
          <Button className="w-full rounded-lg text-xs h-8" style={buttonStyle}>
            {block.content.buttonText || "Subscribe"}
          </Button>
        </div>
      );

    case "divider":
      return (
        <hr
          className="my-3"
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
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium text-sm shadow-sm hover:shadow-md transition-shadow"
          style={buttonStyle}
          data-testid={`preview-contact-${block.id}`}
        >
          <ContactIcon className="w-4 h-4" />
          {block.content.label || block.content.value || "Contact"}
        </a>
      );

    case "maps":
      return (
        <Card className="p-3">
          <MapPin className="h-4 w-4 mb-1" />
          <p className="text-xs text-muted-foreground">
            {block.content.address || "Map Location"}
          </p>
        </Card>
      );

    case "lead-form":
      return (
        <Card className="p-4" style={{ borderColor: theme.primaryColor }}>
          <h3 className="font-semibold text-sm mb-1">{block.content.title}</h3>
          <p className="text-xs text-muted-foreground mb-3">{block.content.subtitle}</p>
          <div className="space-y-2">
            {block.content.fields?.map((field: any, idx: number) => (
              <div key={idx} className="h-8 bg-gray-100 rounded"></div>
            ))}
          </div>
          <Button 
            className="w-full mt-3 text-xs h-8" 
            style={{ backgroundColor: theme.buttonColor }}
          >
            {block.content.submitText}
          </Button>
        </Card>
      );

    case "calendar":
      return (
        <Card className="p-4">
          <CalendarIcon className="h-4 w-4 mb-1" />
          <h3 className="font-semibold text-sm mb-1">{block.content.title}</h3>
          <p className="text-xs text-muted-foreground">{block.content.subtitle}</p>
        </Card>
      );

    case "testimonials":
      return (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div>
              <p className="font-semibold text-xs">{block.content.reviews?.[0]?.name || "Name"}</p>
              <p className="text-xs text-muted-foreground">{block.content.reviews?.[0]?.role || "Role"}</p>
            </div>
          </div>
          <div className="flex gap-0.5 mb-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-xs">{block.content.reviews?.[0]?.text || "Review text"}</p>
        </Card>
      );

    case "faq":
      return (
        <Card className="p-3">
          <HelpCircle className="h-4 w-4 mb-1" />
          <p className="font-medium text-xs">{block.content.items?.[0]?.question || "Question"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {block.content.items?.[0]?.answer || "Answer"}
          </p>
        </Card>
      );

    case "stats":
      return (
        <div className="grid grid-cols-2 gap-3">
          {block.content.stats?.map((stat: any, idx: number) => (
            <Card key={idx} className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
                {stat.value}{stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
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
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [themeCategory, setThemeCategory] = useState<"all" | "light" | "dark">("all");
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);

  // Local state for Settings fields with debouncing
  const [slugInput, setSlugInput] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  
  // Undo/Redo state
  const [history, setHistory] = useState<LandingBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Fetch current user
  const { data: sessionData } = useQuery<{ user: any }>({
    queryKey: ["/api/session"],
  });
  const currentUser = sessionData?.user;

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

  // Update blocks when page changes and initialize history
  useEffect(() => {
    if (selectedPage) {
      const pageBlocks = selectedPage.blocks || [];
      setBlocks(pageBlocks);
      // Initialize history with the loaded state
      setHistory([JSON.parse(JSON.stringify(pageBlocks))]);
      setHistoryIndex(0);
    }
  }, [selectedPage]);

  // Save to history when blocks change (with debounce to avoid too many snapshots)
  useEffect(() => {
    if (blocks.length > 0 || history.length > 0) {
      const timeoutId = setTimeout(() => {
        const currentSnapshot = JSON.stringify(blocks);
        const lastSnapshot = history[historyIndex] ? JSON.stringify(history[historyIndex]) : null;
        
        // Only save if state has actually changed
        if (currentSnapshot !== lastSnapshot) {
          saveToHistory(blocks);
        }
      }, 500); // Debounce for 500ms
      
      return () => clearTimeout(timeoutId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  // Sync local state with selectedPage
  useEffect(() => {
    if (selectedPage?.landingPage) {
      setSlugInput(selectedPage.landingPage.slug);
      setSeoTitle(selectedPage.landingPage.seo.title || "");
      setSeoDescription(selectedPage.landingPage.seo.description || "");
    }
  }, [selectedPage]);

  // Debounced slug update
  useEffect(() => {
    if (!slugInput || slugInput === selectedPage?.landingPage?.slug) return;
    
    const isValid = /^[a-z0-9-]{3,50}$/.test(slugInput);
    if (!isValid) return;
    
    const timer = setTimeout(() => {
      updatePageMutation.mutate({
        id: selectedPageId!,
        data: { slug: slugInput },
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [slugInput, selectedPageId, selectedPage]);

  // Debounced SEO title update
  useEffect(() => {
    if (seoTitle === selectedPage?.landingPage?.seo.title) return;
    if (!selectedPage?.landingPage) return;
    
    const timer = setTimeout(() => {
      updatePageMutation.mutate({
        id: selectedPageId!,
        data: {
          seo: {
            ...selectedPage.landingPage.seo,
            title: seoTitle,
          },
        },
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [seoTitle, selectedPageId, selectedPage]);

  // Debounced SEO description update
  useEffect(() => {
    if (seoDescription === selectedPage?.landingPage?.seo.description) return;
    if (!selectedPage?.landingPage) return;
    
    const timer = setTimeout(() => {
      updatePageMutation.mutate({
        id: selectedPageId!,
        data: {
          seo: {
            ...selectedPage.landingPage.seo,
            description: seoDescription,
          },
        },
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [seoDescription, selectedPageId, selectedPage]);

  // Helper function to generate user-based slug
  const generateUserSlug = (user: any): string => {
    if (!user) return `page-${Date.now()}`;
    
    const firstName = user.firstName?.toLowerCase().replace(/[^a-z0-9]/g, '-') || '';
    const emailPrefix = user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') || '';
    
    const baseSlug = firstName || emailPrefix || `page-${Date.now()}`;
    return baseSlug.substring(0, 20);
  };

  // Auto-create landing page if user doesn't have one
  useEffect(() => {
    if (!isPagesLoading && landingPages && landingPages.length === 0 && currentUser) {
      const slug = generateUserSlug(currentUser);
      createPageMutation.mutate({
        title: "Mi Landing Page",
        slug,
        description: "Mi página de enlaces personalizada",
      });
    }
  }, [isPagesLoading, landingPages, currentUser]);

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
      if (selectedPage) {
        queryClient.invalidateQueries({
          queryKey: ["/l", selectedPage.landingPage.slug],
        });
      }
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
        `/api/landing-blocks/${blockId}`,
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
      console.log('[DELETE BLOCK] Sending DELETE request for blockId:', blockId);
      return await apiRequest(
        "DELETE",
        `/api/landing-blocks/${blockId}`
      );
    },
    onSuccess: () => {
      console.log('[DELETE BLOCK] Successfully deleted, invalidating queries');
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", selectedPageId],
      });
    },
    onError: (error) => {
      console.error('[DELETE BLOCK] Error deleting block:', error);
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

  // Save current state to history
  const saveToHistory = useCallback((currentBlocks: LandingBlock[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(currentBlocks)));
      // Keep only last 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setBlocks(JSON.parse(JSON.stringify(previousState)));
      setHistoryIndex(prev => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setBlocks(JSON.parse(JSON.stringify(nextState)));
      setHistoryIndex(prev => prev + 1);
    }
  }, [history, historyIndex]);

  // Can undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);

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

  if (isPagesLoading) {
    return <LoadingSpinner message="Loading landing page builder..." />;
  }

  const filteredThemes = THEMES.filter(
    (theme) => themeCategory === "all" || theme.category === themeCategory
  );

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 flex items-center px-6 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-sm hidden sm:inline">Landing Builder</span>
        </div>

        {/* URL Input */}
        {selectedPage && (
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase())}
                className={`pl-10 pr-10 h-9 text-sm ${
                  slugInput.length >= 3 && /^[a-z0-9-]{3,50}$/.test(slugInput)
                    ? "border-green-500 focus-visible:ring-green-500"
                    : slugInput.length > 0 && (slugInput.length < 3 || !/^[a-z0-9-]{3,50}$/.test(slugInput))
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                placeholder="your-page-url"
                data-testid="input-header-slug"
              />
              {slugInput.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugInput.length >= 3 && /^[a-z0-9-]{3,50}$/.test(slugInput) ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                </div>
              )}
            </div>
            {slugInput.length > 0 && slugInput.length < 3 && (
              <p className="text-xs text-red-500 mt-1">
                Slug must be at least 3 characters
              </p>
            )}
            {slugInput.length >= 3 && !/^[a-z0-9-]{3,50}$/.test(slugInput) && (
              <p className="text-xs text-red-500 mt-1">
                Only lowercase letters, numbers, and hyphens allowed
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Undo/Redo */}
          <div className="hidden sm:flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={!canUndo}
              onClick={handleUndo}
              data-testid="button-undo"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={!canRedo}
              onClick={handleRedo}
              data-testid="button-redo"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Desktop/Mobile Toggle */}
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <Button
              variant={previewMode === "desktop" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPreviewMode("desktop")}
              className="h-7 px-2"
              data-testid="button-preview-desktop"
            >
              <Monitor className="w-4 h-4" />
            </Button>
            <Button
              variant={previewMode === "mobile" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPreviewMode("mobile")}
              className="h-7 px-2"
              data-testid="button-preview-mobile"
            >
              <Smartphone className="w-4 h-4" />
            </Button>
          </div>

          {/* Publish Button */}
          {selectedPage && (
            <Button
              onClick={() => {
                updatePageMutation.mutate({
                  id: selectedPageId!,
                  data: {
                    isPublished: !selectedPage.landingPage.isPublished,
                  },
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
              data-testid="button-publish-page"
            >
              {selectedPage.landingPage.isPublished ? "Unpublish" : "Publish"}
            </Button>
          )}
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Add Blocks */}
        <div className="w-[200px] bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              {/* Add Blocks Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Add Blocks</h3>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BLOCK_TYPES.map((blockType) => {
                    const Icon = blockType.icon;
                    return (
                      <button
                        key={blockType.type}
                        onClick={() => addBlock(blockType.type, {})}
                        className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-md transition-all group"
                        data-testid={`button-add-${blockType.type}`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                          style={{ backgroundColor: `${blockType.color}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: blockType.color }} />
                        </div>
                        <span className="text-[10px] text-gray-600 dark:text-gray-300 font-medium text-center">{blockType.label}</span>
                      </button>
                    );
                  })}
                </div>
                
                <Button 
                  variant="default" 
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                  data-testid="button-see-more-blocks"
                >
                  See Another Blocks
                </Button>
              </div>

              <Separator />

              {/* Social Media Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Social Media</h3>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const Icon = platform.icon;
                    // Find if there's already a social block for this platform
                    const existingBlock = blocks.find(
                      b => b.type === "social" && b.content.platform === platform.value
                    );
                    
                    return (
                      <div
                        key={platform.value}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-all group"
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: platform.color }}
                        >
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="flex-1 text-xs text-gray-600 dark:text-gray-300">{platform.label}</span>
                        {existingBlock ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteBlockMutation.mutate(existingBlock.id)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-delete-social-${platform.value}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addBlock("social", { platform: platform.value })}
                            className="h-7 w-7 p-0 text-green-400 hover:text-green-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-add-social-${platform.value}`}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Center - Preview with Dotted Background */}
        <div className="flex-1 overflow-hidden relative">
          {/* Dotted Background Pattern */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
              backgroundColor: "#f9fafb",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Content */}
          <div className="relative h-full overflow-y-auto">
            <div className="p-6 flex flex-col items-center">
              {/* Zoom Control */}
              <div className="flex items-center gap-3 mb-6 bg-white rounded-lg px-3 py-1.5 shadow-sm border border-gray-200">
                <button 
                  onClick={() => setZoomLevel(Math.max(70, zoomLevel - 10))}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                  data-testid="button-zoom-out"
                >
                  <Minus className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-medium min-w-[50px] text-center text-gray-700">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(Math.min(120, zoomLevel + 10))}
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                  data-testid="button-zoom-in"
                >
                  <Plus className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Device Frame */}
              {selectedPage ? (
                <div
                  style={{
                    transform: `scale(${zoomLevel / 100})`,
                    transformOrigin: "top center",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <div
                    className={`relative overflow-hidden transition-all duration-300`}
                    style={{
                      width: previewMode === "mobile" ? "430px" : "100%",
                      maxWidth: previewMode === "desktop" ? "1024px" : undefined,
                      height: previewMode === "mobile" ? "932px" : "auto",
                      minHeight: previewMode === "desktop" ? "600px" : undefined,
                      backgroundColor: "#1c1c1e",
                      borderRadius: previewMode === "mobile" ? "60px" : "0",
                      padding: previewMode === "mobile" ? "12px" : "0",
                      boxShadow: previewMode === "mobile" 
                        ? "0 0 0 8px #1c1c1e, 0 0 0 12px #2c2c2e, 0 20px 60px rgba(0,0,0,0.4)"
                        : "none",
                    }}
                  >
                  {previewMode === "mobile" && (
                    <>
                      {/* iPhone 16 Pro Max Frame */}
                      <div className="absolute inset-0 pointer-events-none z-50">
                        {/* Dynamic Island */}
                        <div className="absolute top-[12px] left-1/2 -translate-x-1/2 w-[126px] h-[37px] bg-black rounded-full" />
                        
                        {/* Status Bar */}
                        <div className="absolute top-[20px] left-0 right-0 px-[32px] flex items-center justify-between text-white text-[15px] font-semibold">
                          <div>9:41</div>
                          <div className="flex items-center gap-1">
                            {/* Signal */}
                            <svg width="18" height="12" viewBox="0 0 18 12" fill="white">
                              <rect x="0" y="8" width="3" height="4" rx="1"/>
                              <rect x="5" y="5" width="3" height="7" rx="1"/>
                              <rect x="10" y="2" width="3" height="10" rx="1"/>
                              <rect x="15" y="0" width="3" height="12" rx="1"/>
                            </svg>
                            {/* WiFi */}
                            <svg width="18" height="14" viewBox="0 0 18 14" fill="white">
                              <path d="M9 13C9.552 13 10 12.552 10 12C10 11.448 9.552 11 9 11C8.448 11 8 11.448 8 12C8 12.552 8.448 13 9 13ZM9 9C10.381 9 11.673 9.562 12.627 10.515L11.214 11.929C10.635 11.349 9.854 11 9 11C8.146 11 7.365 11.349 6.786 11.929L5.373 10.515C6.327 9.562 7.619 9 9 9ZM9 5C11.209 5 13.234 5.902 14.698 7.365L13.284 8.778C12.186 7.68 10.671 7 9 7C7.329 7 5.814 7.68 4.716 8.778L3.302 7.365C4.766 5.902 6.791 5 9 5Z"/>
                            </svg>
                            {/* Battery */}
                            <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
                              <rect x="0.5" y="0.5" width="22" height="12" rx="2.5" stroke="white" strokeOpacity="0.35"/>
                              <path opacity="0.4" d="M24 4V9C25.105 8.665 25.5 7.5 25.5 6.5C25.5 5.5 25.105 4.335 24 4Z" fill="white"/>
                              <rect x="2" y="2" width="18" height="9" rx="1" fill="white"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Screen Content */}
                  <div 
                    className="relative w-full h-full bg-white rounded-[48px] overflow-hidden"
                    style={{
                      backgroundColor: previewMode === "mobile" ? "white" : "transparent",
                    }}
                  >

                    {/* Scrollable Content Area */}
                    <ScrollArea className="h-full">
                      <div
                        className="p-6"
                        style={{
                          backgroundColor: selectedPage.landingPage.theme.backgroundColor,
                          minHeight: previewMode === "mobile" ? "932px" : "600px",
                        }}
                      >
                      {/* Profile Section */}
                      <div className="text-center mb-6">
                        <Avatar className="w-20 h-20 mx-auto mb-3 ring-4 ring-white dark:ring-slate-800">
                          <AvatarImage src={selectedPage.landingPage.profilePhoto || ""} />
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
                            className="text-xl font-bold mb-1"
                            style={{ color: selectedPage.landingPage.theme.textColor }}
                          >
                            {selectedPage.landingPage.profileName}
                          </h1>
                        )}
                        {selectedPage.landingPage.profileBio && (
                          <p
                            className="text-sm"
                            style={{ color: selectedPage.landingPage.theme.textColor, opacity: 0.8 }}
                          >
                            {selectedPage.landingPage.profileBio}
                          </p>
                        )}
                      </div>

                      {/* Blocks with Drag and Drop */}
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
                              <Card className="border-dashed">
                                <CardContent className="p-8 text-center">
                                  <p className="text-gray-500 text-sm">
                                    Add your first block from the left sidebar
                                  </p>
                                </CardContent>
                              </Card>
                            ) : (
                              blocks.map((block) => (
                                <div key={block.id} className="space-y-2">
                                  {/* Editable block item */}
                                  <SortableBlock
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
                                    onDelete={() => setBlockToDelete(block.id)}
                                  />
                                  {/* Visual preview */}
                                  <div className="pl-6">
                                    <BlockPreview
                                      block={block}
                                      theme={selectedPage.landingPage.theme}
                                    />
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </SortableContext>
                      </DndContext>
                      </div>
                    </ScrollArea>
                  </div>
                  </div>
                </div>
              ) : (
                <Card className="border-dashed max-w-md">
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500">Loading...</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Design/Analytics/Settings Tabs */}
        <div className="w-[350px] bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
          <Tabs defaultValue="design" className="h-full flex flex-col">
            <TabsList className="w-full rounded-none border-b justify-start px-4">
              <TabsTrigger value="design" className="gap-2" data-testid="tab-design">
                <Palette className="w-4 h-4" />
                Design
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
                <BarChart className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
                <SettingsIcon className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Design Tab */}
            <TabsContent value="design" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {selectedPage && (
                    <>
                      {/* Select Theme Section */}
                      <div>
                        <h3 className="font-semibold mb-3">Select Theme</h3>
                        
                        {/* Theme Category Tabs */}
                        <Tabs value={themeCategory} onValueChange={(v: any) => setThemeCategory(v)} className="mb-4">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="all" className="text-xs" data-testid="theme-cat-all">All</TabsTrigger>
                            <TabsTrigger value="light" className="text-xs" data-testid="theme-cat-light">Light</TabsTrigger>
                            <TabsTrigger value="dark" className="text-xs" data-testid="theme-cat-dark">Dark</TabsTrigger>
                          </TabsList>
                        </Tabs>

                        {/* Theme Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {filteredThemes.slice(0, 4).map((themeData) => {
                            const isSelected = selectedPage.landingPage.theme.name === themeData.theme.name;
                            return (
                              <button
                                key={themeData.name}
                                onClick={() =>
                                  updatePageMutation.mutate({
                                    id: selectedPageId!,
                                    data: { theme: themeData.theme },
                                  })
                                }
                                className={`group relative rounded-xl overflow-hidden border-2 transition-all ${
                                  isSelected 
                                    ? "border-blue-500 shadow-lg" 
                                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                                }`}
                                style={{ aspectRatio: "4/3" }}
                                data-testid={`theme-${themeData.name.toLowerCase().replace(/\s+/g, "-")}`}
                              >
                                <div
                                  className="w-full h-full flex items-center justify-center p-4"
                                  style={{ background: themeData.gradient }}
                                >
                                  {/* Mini mockup */}
                                  <div className="w-full bg-white/20 backdrop-blur-sm rounded-lg p-2 space-y-1.5">
                                    <div className="w-6 h-6 rounded-full bg-white/40 mx-auto" />
                                    <div className="h-1 bg-white/40 rounded w-12 mx-auto" />
                                    <div className="h-1 bg-white/40 rounded w-8 mx-auto" />
                                    <div className="grid grid-cols-3 gap-1 mt-2">
                                      <div className="h-1 bg-white/40 rounded" />
                                      <div className="h-1 bg-white/40 rounded" />
                                      <div className="h-1 bg-white/40 rounded" />
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        <Button variant="outline" className="w-full" size="sm" data-testid="button-see-all-themes">
                          See All Themes
                        </Button>
                      </div>

                      <Separator />

                      {/* Typography Section */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Typography</h3>
                        
                        <div>
                          <Label className="text-xs mb-2 block">Font Weight</Label>
                          <Select defaultValue="regular">
                            <SelectTrigger data-testid="select-font-weight">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="regular">Regular</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="semibold">Semibold</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs mb-2 block">Font Style</Label>
                          <Select defaultValue="inter">
                            <SelectTrigger data-testid="select-font-style">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inter">Inter</SelectItem>
                              <SelectItem value="roboto">Roboto</SelectItem>
                              <SelectItem value="poppins">Poppins</SelectItem>
                              <SelectItem value="montserrat">Montserrat</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Separator />

                      {/* Custom Colors */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Custom Colors</h3>
                        
                        <div>
                          <Label htmlFor="primaryColor" className="text-xs mb-2 block">
                            Primary Color
                          </Label>
                          <div className="flex gap-2">
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
                              className="w-16 h-10 p-1"
                              data-testid="input-primary-color"
                            />
                            <Input
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
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="backgroundColor" className="text-xs mb-2 block">
                            Background Color
                          </Label>
                          <div className="flex gap-2">
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
                              className="w-16 h-10 p-1"
                              data-testid="input-background-color"
                            />
                            <Input
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
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="textColor" className="text-xs mb-2 block">
                            Text Color
                          </Label>
                          <div className="flex gap-2">
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
                              className="w-16 h-10 p-1"
                              data-testid="input-text-color"
                            />
                            <Input
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
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Profile Section */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Profile</h3>
                        
                        <div>
                          <Label htmlFor="profileName" className="text-xs mb-2 block">
                            Name
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
                            placeholder="Your name"
                            data-testid="input-profile-name"
                          />
                        </div>

                        <div>
                          <Label htmlFor="profileBio" className="text-xs mb-2 block">
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
                            placeholder="Your bio"
                            rows={3}
                            data-testid="input-profile-bio"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="flex-1 m-0">
              <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                  <BarChart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="font-semibold mb-2">Analytics Coming Soon</h3>
                  <p className="text-sm text-muted-foreground">
                    Track your page performance and visitor insights.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {selectedPage && (
                    <>
                      {/* Page Settings */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Page Settings</h3>
                        
                        <div>
                          <Label htmlFor="slug" className="text-xs mb-2 block">
                            URL Slug
                          </Label>
                          <div className="relative">
                            <Input
                              id="slug"
                              value={slugInput}
                              onChange={(e) => setSlugInput(e.target.value.toLowerCase())}
                              data-testid="input-slug"
                              className={
                                slugInput.length > 0 && slugInput.length < 3
                                  ? "border-red-500 pr-10"
                                  : /^[a-z0-9-]{3,50}$/.test(slugInput)
                                  ? "border-green-500 pr-10"
                                  : "pr-10"
                              }
                            />
                            {slugInput.length > 0 && /^[a-z0-9-]{3,50}$/.test(slugInput) && (
                              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Mínimo 3 caracteres, solo minúsculas, números y guiones
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="password-protection" className="text-sm font-medium">
                              Password Protection
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Require a password to view this page
                            </p>
                          </div>
                          <Switch
                            id="password-protection"
                            checked={selectedPage.landingPage.isPasswordProtected || false}
                            onCheckedChange={(checked) =>
                              updatePageMutation.mutate({
                                id: selectedPageId!,
                                data: { isPasswordProtected: checked },
                              })
                            }
                            data-testid="switch-password-protection"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* SEO Settings */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">SEO</h3>
                        
                        <div>
                          <Label htmlFor="seo-title" className="text-xs mb-2 block">
                            Meta Title
                          </Label>
                          <Input
                            id="seo-title"
                            value={seoTitle}
                            onChange={(e) => setSeoTitle(e.target.value)}
                            placeholder="SEO title"
                            data-testid="input-seo-title"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Título que aparecerá en resultados de búsqueda
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="seo-description" className="text-xs mb-2 block">
                            Meta Description
                          </Label>
                          <Textarea
                            id="seo-description"
                            value={seoDescription}
                            onChange={(e) => setSeoDescription(e.target.value)}
                            placeholder="SEO description"
                            rows={3}
                            data-testid="input-seo-description"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Descripción breve para motores de búsqueda
                          </p>
                        </div>
                      </div>

                      <Separator />

                      {/* Quick Actions */}
                      <div className="space-y-3">
                        <h3 className="font-semibold">Quick Actions</h3>
                        
                        {selectedPage.landingPage.isPublished && (
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => {
                              const publicUrl = `${window.location.origin}/${selectedPage.landingPage.slug}`;
                              window.open(publicUrl, '_blank');
                            }}
                            data-testid="button-open-landing-page"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Published Page
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Block Editor Sheet - Keep all existing functionality */}
      <Sheet open={isBlockEditorOpen} onOpenChange={setIsBlockEditorOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Block</SheetTitle>
            <SheetDescription>
              Configure your block content
            </SheetDescription>
          </SheetHeader>
          {editingBlock && (
            <div className="space-y-4 py-6">
              {editingBlock.type === "link" && (
                <>
                  <div>
                    <Label>Label</Label>
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
                    <Label>Open in new tab</Label>
                  </div>
                </>
              )}

              {editingBlock.type === "social" && (
                <>
                  <div>
                    <Label>Platform</Label>
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
                    <Label>Custom Label (optional)</Label>
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
                      placeholder="Follow us on Instagram"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "video" && (
                <>
                  <div>
                    <Label>Video URL (YouTube/Vimeo embed)</Label>
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
                    <Label>Aspect Ratio</Label>
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
                    <Label>Content</Label>
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
                      placeholder="Your text here"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>Alignment</Label>
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
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Size</Label>
                    <Select
                      value={editingBlock.content.size || "base"}
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
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="base">Normal</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {editingBlock.type === "image" && (
                <>
                  <div>
                    <Label>Image URL</Label>
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
                    <Label>Alt Text</Label>
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
                      placeholder="Description of image"
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
                    <Label>Button Text</Label>
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
                </>
              )}

              {editingBlock.type === "contact" && (
                <>
                  <div>
                    <Label>Type</Label>
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
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value</Label>
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
                    <Label>Label</Label>
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
                      placeholder="Contact me"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "divider" && (
                <>
                  <div>
                    <Label>Style</Label>
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
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="dashed">Dashed</SelectItem>
                        <SelectItem value="dotted">Dotted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Width</Label>
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
                        <SelectItem value="100%">Full Width</SelectItem>
                        <SelectItem value="75%">75%</SelectItem>
                        <SelectItem value="50%">50%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Add other block type editors (maps, lead-form, calendar, testimonials, faq, stats) with same pattern */}
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
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Block Confirmation Dialog */}
      <AlertDialog open={!!blockToDelete} onOpenChange={() => setBlockToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar bloque?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El bloque será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (blockToDelete) {
                  deleteBlockMutation.mutate(blockToDelete);
                  setBlockToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
