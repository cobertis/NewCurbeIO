import { useState, useEffect, useCallback } from "react";
import { formatPhoneInput } from "@shared/phone";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getCompanyQueryOptions } from "@/lib/queryClient";
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
  Pencil,
  Loader2,
  Menu,
  Upload,
  Quote,
  Home,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
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
import { GeoapifyAddressAutocomplete } from "@/components/geoapify-address-autocomplete";
import { MapBlockDisplay } from "@/components/map-block-display";
import { RichTextEditor } from "@/components/rich-text-editor";
import { PublicBlock } from "@/components/public-block-renderer";
import { AppointmentBookingInline } from "@/components/appointment-booking-inline";

// Types
type LandingPage = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  profileName?: string;
  profileBio?: string;
  profilePhoto?: string;
  profilePhone?: string;
  profileEmail?: string;
  theme: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    buttonColor?: string;
    buttonTextColor?: string;
    fontFamily?: string;
    font?: string;
    fontWeight?: string;
    backgroundGradient?: string;
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
      backgroundGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #2c3e50 0%, #000000 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #7f00ff 0%, #e100ff 100%)",
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
      backgroundGradient: "linear-gradient(135deg, #000428 0%, #004e92 100%)",
    },
  },
  {
    name: "Lime Green",
    gradient: "linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)",
    category: "light",
    theme: {
      primaryColor: "#56ab2f",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#56ab2f",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)",
    },
  },
  {
    name: "Fire Red",
    gradient: "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
    category: "all",
    theme: {
      primaryColor: "#eb3349",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#eb3349",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)",
    },
  },
  {
    name: "Sky Blue",
    gradient: "linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)",
    category: "light",
    theme: {
      primaryColor: "#2196F3",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#2196F3",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #2196F3 0%, #64B5F6 100%)",
    },
  },
  {
    name: "Golden Hour",
    gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    category: "light",
    theme: {
      primaryColor: "#f7971e",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#f7971e",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    },
  },
  {
    name: "Midnight Blue",
    gradient: "linear-gradient(135deg, #141E30 0%, #243B55 100%)",
    category: "dark",
    theme: {
      primaryColor: "#3B82F6",
      backgroundColor: "#141E30",
      textColor: "#f8fafc",
      buttonColor: "#3B82F6",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #141E30 0%, #243B55 100%)",
    },
  },
  {
    name: "Rose Pink",
    gradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    category: "light",
    theme: {
      primaryColor: "#ff9a9e",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#ff9a9e",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    },
  },
  {
    name: "Emerald",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    category: "light",
    theme: {
      primaryColor: "#11998e",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#11998e",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    },
  },
  {
    name: "Grape Purple",
    gradient: "linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)",
    category: "all",
    theme: {
      primaryColor: "#5f2c82",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#5f2c82",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)",
    },
  },
  {
    name: "Cherry Red",
    gradient: "linear-gradient(135deg, #c31432 0%, #240b36 100%)",
    category: "dark",
    theme: {
      primaryColor: "#c31432",
      backgroundColor: "#240b36",
      textColor: "#f8fafc",
      buttonColor: "#c31432",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #c31432 0%, #240b36 100%)",
    },
  },
  {
    name: "Aqua Marine",
    gradient: "linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)",
    category: "all",
    theme: {
      primaryColor: "#26d0ce",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#26d0ce",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)",
    },
  },
  {
    name: "Peach",
    gradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    category: "light",
    theme: {
      primaryColor: "#fcb69f",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#fcb69f",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    },
  },
  {
    name: "Cosmic",
    gradient: "linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)",
    category: "all",
    theme: {
      primaryColor: "#8e2de2",
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      buttonColor: "#8e2de2",
      buttonTextColor: "#ffffff",
      backgroundGradient: "linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)",
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
  { value: "tiktok", label: "TikTok", icon: SiTiktok, color: "#000000" },
  { value: "email", label: "Email", icon: Mail, color: "#EA4335" },
];

// Block types for the sidebar
const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: Type, color: "#8B5CF6" },
  { type: "calendar", label: "Meetings", icon: CalendarIcon, color: "#F59E0B" },
  { type: "link", label: "Button", icon: LinkIcon, color: "#3B82F6" },
  { type: "image", label: "Image", icon: ImageIcon, color: "#EC4899" },
  { type: "video", label: "Video", icon: Video, color: "#EF4444" },
  { type: "maps", label: "Map", icon: MapPin, color: "#F97316" },
  { type: "email", label: "Newsletter", icon: Mail, color: "#6366F1" },
];

// Social media block types for sidebar
const SOCIAL_BLOCK_TYPES = SOCIAL_PLATFORMS.map(platform => ({
  type: "social",
  platform: platform.value,
  label: platform.label,
  icon: platform.icon,
  color: platform.color,
}));

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
        return "Request Quote";
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
          className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-center font-medium text-sm shadow-sm hover:shadow-md transition-shadow"
          style={buttonStyle}
          data-testid={`preview-link-${block.id}`}
        >
          <Globe className="w-4 h-4" />
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
          className="flex items-center justify-center w-12 h-12 bg-black rounded-full shadow-sm hover:shadow-md transition-shadow"
          data-testid={`preview-social-${block.id}`}
        >
          <SocialIcon className="w-5 h-5 text-white" />
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
          className={`prose prose-sm max-w-none ${
            block.content.size === "sm"
              ? "text-xs"
              : block.content.size === "lg"
              ? "text-base"
              : "text-sm"
          }`}
          style={{ color: theme.textColor }}
          dangerouslySetInnerHTML={{ __html: block.content.content || "<p>Your text here</p>" }}
          data-testid={`preview-text-${block.id}`}
        />
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
      };
      const ContactIcon = contactIcons[block.content.type as keyof typeof contactIcons] || Phone;
      return (
        <a
          href={`${
            block.content.type === "email"
              ? "mailto:"
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
        <MapBlockDisplay
          placeId={block.content?.placeId}
          latitude={Number(block.content?.latitude)}
          longitude={Number(block.content?.longitude)}
          formattedAddress={block.content?.formattedAddress || block.content?.address}
          zoomLevel={Number(block.content?.zoom) || 15}
          height="100px"
          showButton={true}
          buttonColor={theme?.primaryColor || "#2563EB"}
        />
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
        <div 
          className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {block.content.title || "Programar llamada"}
              </h2>
              {block.content.description && (
                <p className="text-sm text-gray-600">
                  {block.content.description}
                </p>
              )}
            </div>
            
            <button
              className="px-4 py-2 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all duration-200 group flex items-center gap-2 font-semibold pointer-events-none"
              style={{
                backgroundColor: `${theme.primaryColor || '#000000'}15`,
                color: theme.primaryColor || '#000000',
              }}
            >
              <CalendarIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Agendar</span>
            </button>
          </div>
        </div>
      );

    case "testimonials":
      return (
        <Card className="p-6 rounded-[18px] shadow-lg transition-all duration-300 hover:shadow-xl">
          <div className="flex items-start gap-4">
            <Quote className="h-8 w-8 text-gray-300 flex-shrink-0" />
            <div>
              <p className="text-lg italic mb-4" style={{ color: theme.textColor }}>
                "{block.content.quote || "¡Excelente servicio!"}"
              </p>
              <div className="flex items-center gap-3">
                {block.content.avatar && (
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={block.content.avatar} />
                    <AvatarFallback>{block.content.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <p className="font-semibold">{block.content.name || "Anónimo"}</p>
                  {block.content.role && (
                    <p className="text-sm text-gray-600">{block.content.role}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
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
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontWeight, setFontWeight] = useState("regular");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [themeCategory, setThemeCategory] = useState<"all" | "light" | "dark">("all");
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [loadingTheme, setLoadingTheme] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);

  // Local state for Settings fields with debouncing
  const [pageTitle, setPageTitle] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  
  // Undo/Redo state
  const [history, setHistory] = useState<LandingBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Social Media Dialog
  const [isAddSocialOpen, setIsAddSocialOpen] = useState(false);
  const [newSocialPlatform, setNewSocialPlatform] = useState("instagram");
  const [newSocialUsername, setNewSocialUsername] = useState("");
  
  // Appointment booking state for preview
  const [showAppointmentInline, setShowAppointmentInline] = useState(false);

  // Fetch current user
  const { data: sessionData } = useQuery<{ user: any }>({
    queryKey: ["/api/session"],
  });
  const currentUser = sessionData?.user;

  // Fetch company data to get logo
  const { data: companyData } = useQuery<{ company: any }>({
    ...getCompanyQueryOptions(currentUser?.companyId),
  });

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
    queryFn: async () => {
      if (!selectedPageId) throw new Error("Landing page ID not found");
      const response = await fetch(`/api/landing-pages/${selectedPageId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch landing page');
      return response.json();
    },
    enabled: !!selectedPageId,
  });

  // Check slug availability in real-time
  const isSlugValidFormat = slugInput.length >= 3 && /^[a-z0-9-]{3,50}$/.test(slugInput);
  const shouldCheckSlug = isSlugValidFormat && slugInput !== selectedPage?.landingPage?.slug;
  
  const { data: slugCheckData, isLoading: isCheckingSlug } = useQuery<{ available: boolean }>({
    queryKey: ["/api/landing-pages/check-slug", slugInput],
    enabled: shouldCheckSlug,
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
      setPageTitle(selectedPage.landingPage.title || "");
      setSlugInput(selectedPage.landingPage.slug);
      setSeoTitle(selectedPage.landingPage.seo.title || "");
      setSeoDescription(selectedPage.landingPage.seo.description || "");
      setProfileName(selectedPage.landingPage.profileName || "");
      setProfileBio(selectedPage.landingPage.profileBio || "");
      setProfilePhone(selectedPage.landingPage.profilePhone || "");
      setProfileEmail(selectedPage.landingPage.profileEmail || "");
      setFontFamily(selectedPage.landingPage.theme?.fontFamily || selectedPage.landingPage.theme?.font || "Inter");
      setFontWeight(selectedPage.landingPage.theme?.fontWeight || "regular");
    }
  }, [selectedPage?.landingPage?.id]); // Only sync when page changes, not on every update

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

  // Save handlers for profile fields (save on blur, not on change)
  const handleProfileNameSave = () => {
    if (profileName !== selectedPage?.landingPage?.profileName && selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { profileName },
      });
    }
  };

  const handleProfileBioSave = () => {
    if (profileBio !== selectedPage?.landingPage?.profileBio && selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { profileBio },
      });
    }
  };

  const handleProfilePhoneSave = () => {
    if (profilePhone !== selectedPage?.landingPage?.profilePhone && selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { profilePhone },
      });
    }
  };

  const handleProfileEmailSave = () => {
    if (profileEmail !== selectedPage?.landingPage?.profileEmail && selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { profileEmail },
      });
    }
  };

  // Format phone number as (XXX) XXX-XXXX
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    
    const [, area, prefix, line] = match;
    if (line) {
      return `(${area}) ${prefix}-${line}`;
    } else if (prefix) {
      return `(${area}) ${prefix}`;
    } else if (area) {
      return area.length === 3 ? `(${area})` : area;
    }
    return '';
  };

  // Build social media URL based on platform and username
  const buildSocialUrl = (platform: string, username: string): string => {
    const cleanUsername = username.trim().replace('@', '');
    
    switch (platform) {
      case 'instagram':
        return `https://instagram.com/${cleanUsername}`;
      case 'facebook':
        return `https://facebook.com/${cleanUsername}`;
      case 'twitter':
        return `https://twitter.com/${cleanUsername}`;
      case 'linkedin':
        return `https://linkedin.com/in/${cleanUsername}`;
      case 'youtube':
        return `https://youtube.com/@${cleanUsername}`;
      case 'tiktok':
        return `https://tiktok.com/@${cleanUsername}`;
      default:
        return cleanUsername;
    }
  };

  // Add social media block with formatted URL
  const handleAddSocial = () => {
    if (!newSocialUsername.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a username",
      });
      return;
    }

    const url = buildSocialUrl(newSocialPlatform, newSocialUsername);
    
    addBlock("social", { 
      platform: newSocialPlatform,
      url: url,
    });

    // Reset and close
    setNewSocialUsername("");
    setNewSocialPlatform("instagram");
    setIsAddSocialOpen(false);
  };

  const handlePageTitleSave = () => {
    if (pageTitle !== selectedPage?.landingPage?.title && selectedPageId) {
      updatePageMutation.mutate({
        id: selectedPageId,
        data: { title: pageTitle },
      });
    }
  };

  // Reusable avatar upload handler
  const handleAvatarUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setIsUploadingAvatar(true);
        const reader = new FileReader();
        reader.onload = () => {
          updatePageMutation.mutate(
            {
              id: selectedPageId!,
              data: { profilePhoto: reader.result as string },
            },
            {
              onSettled: () => {
                setIsUploadingAvatar(false);
              },
            }
          );
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

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
      themeName,
    }: {
      id: string;
      data: Partial<LandingPage>;
      themeName?: string;
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
    onSettled: (data, error, variables) => {
      // Clear theme loading state only if this specific theme update completed
      if (variables.themeName && loadingTheme === variables.themeName) {
        setLoadingTheme(null);
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
    onMutate: async ({ landingPageId, data }) => {
      await queryClient.cancelQueries({ 
        queryKey: ["/api/landing-pages", landingPageId] 
      });
      
      const previous = queryClient.getQueryData(["/api/landing-pages", landingPageId]);
      
      queryClient.setQueryData(
        ["/api/landing-pages", landingPageId],
        (old: any) => {
          if (!old) return old;
          
          const tempId = `temp-${Date.now()}-${Math.random()}`;
          const newBlock: LandingBlock = {
            id: tempId,
            type: data.type,
            content: data.content,
            position: data.position,
            isVisible: data.isVisible ?? true,
            clickCount: 0,
          };
          
          return {
            ...old,
            blocks: [...(old.blocks || []), newBlock],
          };
        }
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/landing-pages", variables.landingPageId],
          context.previous
        );
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create block. Please try again.",
      });
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", variables.landingPageId],
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
    onMutate: async ({ blockId, data }) => {
      await queryClient.cancelQueries({ 
        queryKey: ["/api/landing-pages", selectedPageId] 
      });
      
      const previous = queryClient.getQueryData(["/api/landing-pages", selectedPageId]);
      
      queryClient.setQueryData(
        ["/api/landing-pages", selectedPageId],
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            blocks: (old.blocks || []).map((block: LandingBlock) =>
              block.id === blockId
                ? { ...block, ...data }
                : block
            ),
          };
        }
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/landing-pages", selectedPageId],
          context.previous
        );
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update block. Please try again.",
      });
    },
    onSettled: () => {
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
        `/api/landing-blocks/${blockId}`
      );
    },
    onMutate: async (blockId: string) => {
      await queryClient.cancelQueries({ 
        queryKey: ["/api/landing-pages", selectedPageId] 
      });
      
      const previous = queryClient.getQueryData(["/api/landing-pages", selectedPageId]);
      
      queryClient.setQueryData(
        ["/api/landing-pages", selectedPageId],
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            blocks: (old.blocks || []).filter((block: LandingBlock) => block.id !== blockId),
          };
        }
      );
      
      return { previous };
    },
    onError: (err, blockId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/landing-pages", selectedPageId],
          context.previous
        );
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete block. Please try again.",
      });
    },
    onSettled: () => {
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

  // Sync blocks mutation (for undo/redo persistence)
  const syncBlocksMutation = useMutation({
    mutationFn: async (blocks: LandingBlock[]) => {
      if (!selectedPageId) {
        throw new Error("No landing page selected");
      }
      return await apiRequest(
        "POST",
        `/api/landing-pages/${selectedPageId}/blocks/sync`,
        { blocks }
      );
    },
    onMutate: async (blocks: LandingBlock[]) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ 
        queryKey: ["/api/landing-pages", selectedPageId] 
      });
      
      // Save previous state
      const previous = queryClient.getQueryData(["/api/landing-pages", selectedPageId]);
      
      // Optimistically update cache
      queryClient.setQueryData(
        ["/api/landing-pages", selectedPageId],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            blocks,
          };
        }
      );
      
      return { previous };
    },
    onError: (err, blocks, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/landing-pages", selectedPageId],
          context.previous
        );
      }
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Failed to sync blocks with server. Your changes may not persist.",
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["/api/landing-pages", selectedPageId],
      });
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
      const clonedState = JSON.parse(JSON.stringify(previousState));
      setBlocks(clonedState);
      setHistoryIndex(prev => prev - 1);
      
      // Sync with server to persist undo operation
      if (selectedPageId) {
        syncBlocksMutation.mutate(clonedState);
      }
    }
  }, [history, historyIndex, selectedPageId, syncBlocksMutation]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      const clonedState = JSON.parse(JSON.stringify(nextState));
      setBlocks(clonedState);
      setHistoryIndex(prev => prev + 1);
      
      // Sync with server to persist redo operation
      if (selectedPageId) {
        syncBlocksMutation.mutate(clonedState);
      }
    }
  }, [history, historyIndex, selectedPageId, syncBlocksMutation]);

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

      // Get company address for maps default
      const companyAddress = companyData?.company?.address || "";

      const defaultContentMap: Record<string, any> = {
        maps: {
          address: companyAddress,
          latitude: null,
          longitude: null,
          zoom: 15,
          showMarker: true,
        },
        "lead-form": {
          title: "Solicita una Cotización Gratis",
          subtitle: "Obtén tu cotización personalizada en minutos",
          fields: [
            { name: "fullName", type: "text", required: true, placeholder: "Nombre Completo" },
            { name: "email", type: "email", required: true, placeholder: "Correo Electrónico" },
            { name: "phone", type: "tel", required: true, placeholder: "Número de Teléfono" },
            { name: "message", type: "textarea", required: false, placeholder: "Cuéntanos sobre tus necesidades de seguro" },
          ],
          submitText: "Obtener Cotización Gratis",
          successMessage: "¡Gracias! Te contactaremos en 24 horas con tu cotización personalizada.",
          sendNotification: true,
        },
        calendar: {
          title: "Programar llamada",
          description: "Elige un horario que te funcione",
          availableDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          availableHours: { start: "09:00", end: "17:00" },
          duration: 30,
          timezone: "America/New_York",
          successMessage: "¡Tu cita ha sido agendada!",
        },
        testimonials: {
          quote: "¡Excelente servicio!",
          name: "Juan Pérez",
          role: "CEO",
          avatar: "",
        },
        faq: {
          items: [
            { question: "¿Cómo puedo ayudarte?", answer: "Estamos aquí para asistirte con cualquier pregunta." },
          ],
        },
        stats: {
          stats: [
            { label: "Clientes Felices", value: "500", suffix: "+", icon: "users" },
            { label: "Proyectos", value: "100", suffix: "+", icon: "briefcase" },
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
    [selectedPageId, blocks.length, companyData]
  );

  if (isPagesLoading || isPageLoading) {
    return <LoadingSpinner message="Loading landing page builder..." />;
  }

  if (!selectedPage || !selectedPage.landingPage) {
    return <LoadingSpinner message="Loading page data..." />;
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
                disabled={updatePageMutation.isPending}
                className={`pl-10 pr-10 h-9 text-sm ${
                  isSlugValidFormat && (slugInput === selectedPage.landingPage.slug || slugCheckData?.available === true)
                    ? "border-green-500 focus-visible:ring-green-500"
                    : slugInput.length > 0 && (!isSlugValidFormat || slugCheckData?.available === false)
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                placeholder="your-page-url"
                data-testid="input-header-slug"
              />
              {slugInput.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {(updatePageMutation.isPending && slugInput !== selectedPage.landingPage.slug) || isCheckingSlug ? (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  ) : isSlugValidFormat && (slugInput === selectedPage.landingPage.slug || slugCheckData?.available === true) ? (
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
            {isSlugValidFormat && slugCheckData?.available === false && (
              <p className="text-xs text-red-500 mt-1">
                This URL is already taken
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
              </div>

              {/* My Socials - Always visible with Add button */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">My Socials</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddSocialOpen(true)}
                    className="h-7 px-2 text-xs"
                    data-testid="button-add-social-sidebar"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
                
                {blocks.filter(b => b.type === "social").length === 0 ? (
                  <div className="text-center py-6 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                    <Share2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">No social media added yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddSocialOpen(true)}
                      className="h-7 text-xs"
                      data-testid="button-add-first-social"
                    >
                      Add Social Media
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blocks.filter(b => b.type === "social").map((block) => {
                      const platform = SOCIAL_PLATFORMS.find(
                        (p) => p.value === block.content.platform
                      );
                      if (!platform) return null;
                      const Icon = platform.icon;

                      return (
                        <div
                          key={block.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group hover:border-blue-400 transition-all"
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: platform.color }}
                          >
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-medium text-gray-900 dark:text-gray-100 truncate">{platform.label}</p>
                          </div>
                          <button
                            onClick={() => {
                              setEditingBlock(block);
                              setIsBlockEditorOpen(true);
                            }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-edit-social-${block.id}`}
                          >
                            <Edit className="w-3 h-3 text-blue-500" />
                          </button>
                          <button
                            onClick={() => deleteBlockMutation.mutate(block.id)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-delete-social-${block.id}`}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                      <div className="relative" style={{ minHeight: previewMode === "mobile" ? "932px" : "600px" }}>
                        {/* Hero Section with SMARTBIO DARK Gradient Background */}
                        <div 
                          className="relative"
                          style={{
                            background: (selectedPage.landingPage.theme as any).backgroundGradient || "linear-gradient(180deg, #0f0b27 0%, #06010f 55%, #06010f 60%)",
                            minHeight: "220px",
                            paddingBottom: "96px",
                          }}
                        >
                          {/* Home Button - Top Left */}
                          <button
                            onClick={() => {
                              const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
                              if (scrollArea) {
                                scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
                              }
                            }}
                            className="absolute top-4 left-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-200 group"
                            aria-label="Ir al inicio"
                            data-testid="preview-button-home"
                          >
                            <Home className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                          </button>

                          {/* Curved White Background - ADJUSTED for perfect transition */}
                          <div className="absolute bottom-0 left-0 right-0 h-24 overflow-hidden">
                            <svg viewBox="0 0 430 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                              <path d="M0 96V48C0 48 107.5 0 215 0C322.5 0 430 48 430 48V96H0Z" fill="white"/>
                            </svg>
                          </div>
                        </div>
                        
                        {/* Avatar positioned EXACTLY on the curve like SmartBio */}
                        <div className="relative -mt-48 z-10 flex justify-center mb-5">
                          <div className="relative group">
                            <Avatar className="w-40 h-40 ring-8 ring-white shadow-2xl">
                              <AvatarImage src={selectedPage.landingPage.profilePhoto || ""} />
                              <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                                {(selectedPage.landingPage.profileName ||
                                  selectedPage.landingPage.title ||
                                  "LP")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* Edit/Upload Overlay Button */}
                            <button
                              onClick={handleAvatarUpload}
                              disabled={isUploadingAvatar}
                              aria-label="Change profile photo"
                              className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                              data-testid="button-upload-avatar-preview"
                            >
                              {isUploadingAvatar ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Pencil className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Content Section - White Background COMPACT like SmartBio */}
                        <div 
                          className="bg-white px-4 pb-4"
                          style={{
                            fontFamily: selectedPage.landingPage.theme?.fontFamily || selectedPage.landingPage.theme?.font || "Inter, sans-serif",
                            fontWeight: selectedPage.landingPage.theme?.fontWeight === "light" ? 300 
                              : selectedPage.landingPage.theme?.fontWeight === "regular" ? 400 
                              : selectedPage.landingPage.theme?.fontWeight === "medium" ? 500 
                              : selectedPage.landingPage.theme?.fontWeight === "semibold" ? 600 
                              : selectedPage.landingPage.theme?.fontWeight === "bold" ? 700 
                              : 400,
                          }}
                        >
                          {/* Profile Info - COMPACT and CLEAN */}
                          <div 
                            className="relative z-50 text-center -mt-2 landing-profile-name" 
                            style={{ 
                              marginBottom: "16px",
                              border: "none",
                              borderBottom: "none",
                              boxShadow: "none",
                              outline: "none",
                            }}
                          >
                            {selectedPage.landingPage.profileName && (
                              <div 
                                className="flex items-center justify-center gap-1.5 mb-1"
                                style={{
                                  border: "none",
                                  borderBottom: "none",
                                  boxShadow: "none",
                                  outline: "none",
                                }}
                              >
                                <h1
                                  className="text-2xl font-bold"
                                  style={{ 
                                    color: "#000000",
                                    margin: 0,
                                    padding: 0,
                                    border: "none",
                                    borderBottom: "none",
                                    boxShadow: "none",
                                    outline: "none",
                                    textDecoration: "none",
                                  }}
                                >
                                  {selectedPage.landingPage.profileName}
                                </h1>
                                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="#1D9BF0"/>
                                </svg>
                              </div>
                            )}
                            {companyData?.company?.name && (
                              <p
                                className="text-xs font-medium text-gray-500 uppercase tracking-wide"
                                style={{ margin: 0, padding: 0, border: "none", marginBottom: "2px" }}
                              >
                                {companyData.company.name}
                              </p>
                            )}
                            {selectedPage.landingPage.profileBio && (
                              <p
                                className="text-sm leading-relaxed text-gray-600"
                                style={{ margin: 0, padding: 0, border: "none" }}
                              >
                                {selectedPage.landingPage.profileBio}
                              </p>
                            )}

                            {/* Contact Info - Phone Only */}
                            {selectedPage.landingPage.profilePhone && (
                              <div className="flex items-center justify-center mt-3">
                                <a
                                  href={`tel:${selectedPage.landingPage.profilePhone}`}
                                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                                  data-testid="preview-phone"
                                >
                                  <Phone className="w-4 h-4" />
                                  <span>{selectedPage.landingPage.profilePhone}</span>
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Social Media Icons - COMPACT like SmartBio */}
                          {(() => {
                            const socialBlocks = blocks
                              .filter((b) => b.type === "social" && b.isVisible)
                              .filter((b) => SOCIAL_PLATFORMS.find((p) => p.value === b.content.platform)); // Only show blocks with valid icons
                            
                            const getSocialLink = (platform: string, url: string) => {
                              if (!url) return "#";
                              
                              if (platform === "email") {
                                // For email, create mailto link
                                return url.startsWith("mailto:") ? url : `mailto:${url}`;
                              }
                              
                              // For other platforms, use URL as-is
                              return url;
                            };
                            
                            if (socialBlocks.length > 0) {
                              return (
                                <div className="flex items-center justify-center gap-2 mb-4">
                                  {socialBlocks.map((block) => {
                                    const platform = SOCIAL_PLATFORMS.find((p) => p.value === block.content.platform);
                                    if (!platform) return null; // Skip if no platform found
                                    const SocialIcon = platform.icon;
                                    const href = getSocialLink(block.content.platform, block.content.url || "");
                                    
                                    return (
                                      <a
                                        key={block.id}
                                        href={href}
                                        target={block.content.platform === "email" ? "_self" : "_blank"}
                                        rel="noopener noreferrer"
                                        className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                        style={{ backgroundColor: selectedPage.landingPage.theme?.primaryColor ?? '#000000' }}
                                        data-testid={`preview-social-${block.id}`}
                                      >
                                        <SocialIcon className="w-5 h-5 text-white" />
                                      </a>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          })()}

                      {/* Conditional rendering: Show appointment booking or normal blocks */}
                      {showAppointmentInline ? (
                        <div className="space-y-2">
                          <AppointmentBookingInline
                            landingPageId={selectedPage.landingPage.id}
                            agentName={selectedPage.landingPage.profileName || "Agent"}
                            onBack={() => setShowAppointmentInline(false)}
                            primaryColor={selectedPage.landingPage.theme?.primaryColor || "#3B82F6"}
                          />
                        </div>
                      ) : (
                        <>
                          {/* All Blocks (EXCEPT Social) with Drag and Drop */}
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                          >
                            <SortableContext
                              items={blocks.filter(b => b.type !== "social").map((b) => b.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="space-y-2">
                                {blocks.filter(b => b.type !== "social").length === 0 ? (
                                  <Card className="border-dashed">
                                    <CardContent className="p-6 text-center">
                                      <p className="text-gray-500 text-sm">
                                        Add your first block from the left sidebar
                                      </p>
                                    </CardContent>
                                  </Card>
                                ) : (
                                  blocks.filter(b => b.type !== "social").map((block) => (
                                    <div key={block.id} className="space-y-1">
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
                                      {/* Visual preview using PublicBlock for exact public page rendering */}
                                      {block.type !== "social" && (
                                        <div className="pl-4">
                                          <PublicBlock
                                            block={block}
                                            theme={selectedPage.landingPage.theme}
                                            onTrackClick={(blockId) => {
                                              console.log('Block clicked in preview:', blockId);
                                            }}
                                            landingPageId={selectedPage.landingPage.id}
                                            onOpenAppointmentModal={() => setShowAppointmentInline(true)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </>
                      )}
                        </div>
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
                        <div className="grid grid-cols-2 gap-3">
                          {(showAllThemes ? filteredThemes : filteredThemes.slice(0, 4)).map((themeData) => {
                            const isSelected = selectedPage.landingPage.theme.primaryColor === themeData.theme.primaryColor;
                            return (
                              <button
                                key={themeData.name}
                                onClick={() => {
                                  setLoadingTheme(themeData.name);
                                  updatePageMutation.mutate({
                                    id: selectedPageId!,
                                    data: { theme: themeData.theme },
                                    themeName: themeData.name,
                                  });
                                }}
                                disabled={loadingTheme !== null}
                                className={`group relative rounded-xl overflow-hidden border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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
                                  {/* Loading spinner overlay */}
                                  {loadingTheme === themeData.name && (
                                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-10">
                                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                                    </div>
                                  )}
                                  
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
                                {isSelected && loadingTheme !== themeData.name && (
                                  <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Load More Button */}
                        {!showAllThemes && filteredThemes.length > 4 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllThemes(true)}
                            className="w-full mt-3"
                            data-testid="button-load-more-themes"
                          >
                            Load More ({filteredThemes.length - 4} more)
                          </Button>
                        )}
                        {showAllThemes && filteredThemes.length > 4 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllThemes(false)}
                            className="w-full mt-3"
                            data-testid="button-show-less-themes"
                          >
                            Show Less
                          </Button>
                        )}
                      </div>

                      <Separator />

                      {/* Typography Section */}
                      <div className="space-y-4">
                        <h3 className="font-semibold">Typography</h3>
                        
                        <div>
                          <Label className="text-xs mb-2 block">Font Weight</Label>
                          <Select 
                            value={fontWeight} 
                            onValueChange={(value) => {
                              setFontWeight(value);
                              updatePageMutation.mutate({
                                id: selectedPageId!,
                                data: {
                                  theme: {
                                    ...selectedPage.landingPage.theme,
                                    fontWeight: value,
                                  },
                                },
                              });
                            }}
                          >
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
                          <Select 
                            value={fontFamily} 
                            onValueChange={(value) => {
                              setFontFamily(value);
                              updatePageMutation.mutate({
                                id: selectedPageId!,
                                data: {
                                  theme: {
                                    ...selectedPage.landingPage.theme,
                                    fontFamily: value,
                                  },
                                },
                              });
                            }}
                          >
                            <SelectTrigger data-testid="select-font-style">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Inter">Inter</SelectItem>
                              <SelectItem value="Roboto">Roboto</SelectItem>
                              <SelectItem value="Poppins">Poppins</SelectItem>
                              <SelectItem value="Montserrat">Montserrat</SelectItem>
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
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            onBlur={handleProfileNameSave}
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
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                            onBlur={handleProfileBioSave}
                            placeholder="Your bio"
                            rows={3}
                            data-testid="input-profile-bio"
                          />
                        </div>

                        <div>
                          <Label htmlFor="profilePhone" className="text-xs mb-2 block">
                            Phone Number
                          </Label>
                          <Input
                            id="profilePhone"
                            type="tel"
                            value={profilePhone}
                            onChange={(e) => setProfilePhone(formatPhoneNumber(e.target.value))}
                            onBlur={handleProfilePhoneSave}
                            placeholder="(555) 123-4567"
                            maxLength={14}
                            data-testid="input-profile-phone"
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Social Media Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">Social Media</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAddSocialOpen(true)}
                            className="h-7 w-7 p-0"
                            data-testid="button-add-social-media"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-2">
                          {blocks.filter(b => b.type === "social").map((block) => {
                            const platform = SOCIAL_PLATFORMS.find(
                              (p) => p.value === block.content.platform
                            );
                            if (!platform) return null;
                            const Icon = platform.icon;

                            return (
                              <div
                                key={block.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200 group hover:border-blue-400 transition-all"
                              >
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: platform.color }}
                                >
                                  <Icon className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900">{platform.label}</p>
                                  <p className="text-xs text-gray-500 truncate">{block.content.url}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteBlockMutation.mutate(block.id)}
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                  data-testid={`button-delete-social-${block.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            );
                          })}
                          {blocks.filter(b => b.type === "social").length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-4">
                              No social media added yet
                            </p>
                          )}
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
                          <Label htmlFor="page-title" className="text-xs mb-2 block">
                            Logo / Brand Name
                          </Label>
                          <Input
                            id="page-title"
                            value={pageTitle}
                            onChange={(e) => setPageTitle(e.target.value)}
                            onBlur={handlePageTitleSave}
                            placeholder="e.g., SmartBio, YourBrand"
                            data-testid="input-page-title"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Appears in the header logo and initials
                          </p>
                        </div>
                        
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
                                isSlugValidFormat && (slugInput === selectedPage.landingPage.slug || slugCheckData?.available === true)
                                  ? "border-green-500 pr-10"
                                  : slugInput.length > 0 && (!isSlugValidFormat || slugCheckData?.available === false)
                                  ? "border-red-500 pr-10"
                                  : "pr-10"
                              }
                            />
                            {slugInput.length > 0 && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isCheckingSlug ? (
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                ) : isSlugValidFormat && (slugInput === selectedPage.landingPage.slug || slugCheckData?.available === true) ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <X className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Minimum 3 characters, lowercase letters, numbers, and hyphens only
                          </p>
                          {isSlugValidFormat && slugCheckData?.available === false && (
                            <p className="text-xs text-red-500 mt-1">
                              This URL is already taken
                            </p>
                          )}
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
                    <Label className="mb-2 block">Content</Label>
                    <RichTextEditor
                      content={editingBlock.content.content || ""}
                      onChange={(html) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            content: html,
                          },
                        })
                      }
                      placeholder="Start typing your text..."
                    />
                  </div>
                  <div>
                    <Label>Text Size</Label>
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
                        <SelectItem value="sm">Small</SelectItem>
                        <SelectItem value="md">Medium</SelectItem>
                        <SelectItem value="lg">Large</SelectItem>
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
                    <Label className="mb-2">Image</Label>
                    {editingBlock.content.url ? (
                      <div className="space-y-3">
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          <img
                            src={editingBlock.content.url}
                            alt={editingBlock.content.alt || "Preview"}
                            className="w-full h-auto"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  setEditingBlock({
                                    ...editingBlock,
                                    content: {
                                      ...editingBlock.content,
                                      url: reader.result as string,
                                    },
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            };
                            input.click();
                          }}
                          className="w-full"
                          data-testid="button-change-image"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Change Image
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    url: reader.result as string,
                                  },
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        className="w-full h-32 border-dashed"
                        data-testid="button-select-image"
                      >
                        <div className="text-center">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">Click to select image</p>
                        </div>
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label>Alt Text (Optional)</Label>
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
                      data-testid="input-image-alt"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "maps" && (
                <>
                  <div>
                    <Label className="mb-2 block">Address</Label>
                    <GeoapifyAddressAutocomplete
                      value={editingBlock.content.address || ""}
                      onChange={(value) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            address: value,
                          },
                        })
                      }
                      onAddressSelect={(address, placeDetails) => {
                        const fullAddress = `${address.street}, ${address.city}, ${address.state} ${address.postalCode}`;
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            address: fullAddress,
                            formattedAddress: placeDetails?.formattedAddress || fullAddress,
                            placeId: placeDetails?.placeId,
                            latitude: placeDetails?.latitude,
                            longitude: placeDetails?.longitude,
                          },
                        });
                      }}
                      placeholder="Search for an address..."
                      label=""
                      testId="input-map-address"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Start typing to search for an address
                    </p>
                    {editingBlock.content.latitude && editingBlock.content.longitude && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Location selected ({editingBlock.content.latitude.toFixed(4)}, {editingBlock.content.longitude.toFixed(4)})
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Zoom Level</Label>
                    <Select
                      value={String(editingBlock.content.zoom || 15)}
                      onValueChange={(value) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            zoom: parseInt(value),
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">Far (City View)</SelectItem>
                        <SelectItem value="14">Medium (Neighborhood)</SelectItem>
                        <SelectItem value="15">Close (Street View)</SelectItem>
                        <SelectItem value="17">Very Close (Building)</SelectItem>
                      </SelectContent>
                    </Select>
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

              {editingBlock.type === "lead-form" && (
                <>
                  <div>
                    <Label>Title</Label>
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
                      placeholder="Get Started"
                      data-testid="input-leadform-title"
                    />
                  </div>
                  <div>
                    <Label>Subtitle</Label>
                    <Textarea
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
                      placeholder="Fill out this form to get in touch"
                      rows={2}
                      data-testid="input-leadform-subtitle"
                    />
                  </div>
                  <div>
                    <Label>Submit Button Text</Label>
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
                      data-testid="input-leadform-submit"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "calendar" && (
                <>
                  <div>
                    <Label>Title</Label>
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
                      placeholder="Programar llamada"
                      data-testid="input-calendar-title"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editingBlock.content.description || ""}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            description: e.target.value,
                          },
                        })
                      }
                      placeholder="Elige un horario que te funcione"
                      rows={2}
                      data-testid="input-calendar-description"
                    />
                  </div>
                  <div>
                    <Label>Booking URL (Calendly, Cal.com, etc.)</Label>
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
                      placeholder="https://calendly.com/yourname"
                      data-testid="input-calendar-url"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "testimonials" && (
                <>
                  <div>
                    <Label>Nombre del Revisor</Label>
                    <Input
                      value={editingBlock.content.name || ""}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            name: e.target.value,
                          },
                        })
                      }
                      placeholder="Juan Pérez"
                      data-testid="input-testimonial-name"
                    />
                  </div>
                  <div>
                    <Label>Cargo/Título</Label>
                    <Input
                      value={editingBlock.content.role || ""}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            role: e.target.value,
                          },
                        })
                      }
                      placeholder="CEO, Empresa"
                      data-testid="input-testimonial-role"
                    />
                  </div>
                  <div>
                    <Label>Testimonio</Label>
                    <Textarea
                      value={editingBlock.content.quote || ""}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            quote: e.target.value,
                          },
                        })
                      }
                      placeholder="¡Excelente servicio!"
                      rows={3}
                      data-testid="input-testimonial-quote"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "faq" && (
                <>
                  <div>
                    <Label>Question</Label>
                    <Input
                      value={editingBlock.content.items?.[0]?.question || ""}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            items: [{
                              ...(editingBlock.content.items?.[0] || {}),
                              question: e.target.value,
                            }],
                          },
                        })
                      }
                      placeholder="What is your question?"
                      data-testid="input-faq-question"
                    />
                  </div>
                  <div>
                    <Label>Answer</Label>
                    <Textarea
                      value={editingBlock.content.items?.[0]?.answer || ""}
                      onChange={(e) =>
                        setEditingBlock({
                          ...editingBlock,
                          content: {
                            ...editingBlock.content,
                            items: [{
                              ...(editingBlock.content.items?.[0] || {}),
                              answer: e.target.value,
                            }],
                          },
                        })
                      }
                      placeholder="Here is the answer to your question."
                      rows={4}
                      data-testid="input-faq-answer"
                    />
                  </div>
                </>
              )}

              {editingBlock.type === "stats" && (
                <>
                  <div className="space-y-4">
                    <Label>Add Stats (up to 4)</Label>
                    {[0, 1].map((idx) => (
                      <div key={idx} className="p-3 border rounded-lg space-y-2">
                        <Label className="text-xs">Stat {idx + 1}</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Value</Label>
                            <Input
                              value={editingBlock.content.stats?.[idx]?.value || ""}
                              onChange={(e) => {
                                const newStats = editingBlock.content.stats || [];
                                newStats[idx] = {
                                  ...(newStats[idx] || {}),
                                  value: e.target.value,
                                };
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: newStats,
                                  },
                                });
                              }}
                              placeholder="100"
                              data-testid={`input-stat-${idx}-value`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Suffix</Label>
                            <Input
                              value={editingBlock.content.stats?.[idx]?.suffix || ""}
                              onChange={(e) => {
                                const newStats = editingBlock.content.stats || [];
                                newStats[idx] = {
                                  ...(newStats[idx] || {}),
                                  suffix: e.target.value,
                                };
                                setEditingBlock({
                                  ...editingBlock,
                                  content: {
                                    ...editingBlock.content,
                                    stats: newStats,
                                  },
                                });
                              }}
                              placeholder="+"
                              data-testid={`input-stat-${idx}-suffix`}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={editingBlock.content.stats?.[idx]?.label || ""}
                            onChange={(e) => {
                              const newStats = editingBlock.content.stats || [];
                              newStats[idx] = {
                                ...(newStats[idx] || {}),
                                label: e.target.value,
                              };
                              setEditingBlock({
                                ...editingBlock,
                                content: {
                                  ...editingBlock.content,
                                  stats: newStats,
                                },
                              });
                            }}
                            placeholder="Clients Served"
                            data-testid={`input-stat-${idx}-label`}
                          />
                        </div>
                      </div>
                    ))}
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
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Block Confirmation Dialog */}
      <AlertDialog open={!!blockToDelete} onOpenChange={() => setBlockToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete block?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The block will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Social Media Dialog */}
      <Dialog open={isAddSocialOpen} onOpenChange={setIsAddSocialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Social Media</DialogTitle>
            <DialogDescription>
              Choose a platform and enter your username
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="social-platform" className="text-sm mb-2 block">
                Platform
              </Label>
              <Select
                value={newSocialPlatform}
                onValueChange={setNewSocialPlatform}
              >
                <SelectTrigger id="social-platform" data-testid="select-social-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const Icon = platform.icon;
                    return (
                      <SelectItem key={platform.value} value={platform.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: platform.color }}
                          >
                            <Icon className="w-3 h-3 text-white" />
                          </div>
                          {platform.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="social-username" className="text-sm mb-2 block">
                Username
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {newSocialPlatform === 'linkedin' ? 'in/' : 
                   newSocialPlatform === 'youtube' || newSocialPlatform === 'tiktok' ? '@' : ''}
                </span>
                <Input
                  id="social-username"
                  value={newSocialUsername}
                  onChange={(e) => setNewSocialUsername(e.target.value)}
                  placeholder="yourusername"
                  className={newSocialPlatform === 'linkedin' ? 'pl-10' : 
                            (newSocialPlatform === 'youtube' || newSocialPlatform === 'tiktok') ? 'pl-7' : ''}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddSocial();
                    }
                  }}
                  data-testid="input-social-username"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                URL: {buildSocialUrl(newSocialPlatform, newSocialUsername || 'yourusername')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddSocialOpen(false);
                setNewSocialUsername("");
                setNewSocialPlatform("instagram");
              }}
              data-testid="button-cancel-social"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddSocial}
              disabled={!newSocialUsername.trim()}
              data-testid="button-save-social"
            >
              Add Social Media
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
