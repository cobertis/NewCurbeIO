import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  SiInstagram,
  SiFacebook,
  SiX,
  SiLinkedin,
  SiYoutube,
  SiTiktok,
  SiWhatsapp,
} from "react-icons/si";
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  Video,
  ExternalLink,
  MapPin,
  Check,
  Link2,
  Calendar as CalendarIcon,
  Quote,
  HelpCircle,
  BarChart3,
  ChevronDown,
  Menu,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { MapBlockDisplay } from "@/components/map-block-display";
import { AppointmentBookingDialog } from "@/components/appointment-booking-dialog";
import { AppointmentBookingInline } from "@/components/appointment-booking-inline";
import { useToast } from "@/hooks/use-toast";
import { PublicBlock, LeadCaptureForm } from "@/components/public-block-renderer";

type LandingPage = {
  id: string;
  companyId: string;
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
    backgroundGradient?: string;
    textColor: string;
    buttonColor?: string;
    buttonTextColor?: string;
    buttonStyle?: string;
  };
  seo: {
    title?: string;
    description?: string;
    ogImage?: string;
  };
  isPublished: boolean;
  isPasswordProtected: boolean;
  password?: string;
  blocks: LandingBlock[];
};

type LandingBlock = {
  id: string;
  type: string;
  content: Record<string, any>;
  position: number;
  isVisible: boolean;
  clickCount: number;
};


export default function PublicLandingPage() {
  // Try both route patterns: /l/:slug and /:slug
  const [matchL, paramsL] = useRoute("/l/:slug");
  const [matchDirect, paramsDirect] = useRoute("/:slug");
  
  const slug = matchL ? paramsL?.slug : paramsDirect?.slug;
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [showAppointmentInline, setShowAppointmentInline] = useState(false);
  const { toast } = useToast();

  const {
    data,
    isLoading,
    isError,
  } = useQuery<{ landingPage: LandingPage; company: { logo: string } | null }>({
    queryKey: ["/l", slug],
    queryFn: async () => {
      const res = await fetch(`/l/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Landing page not found");
        }
        throw new Error("Failed to load landing page");
      }
      const { landingPage, blocks, company } = await res.json();
      return { 
        landingPage: { ...landingPage, blocks },
        company
      };
    },
    enabled: !!slug,
  });

  const landingPage = data?.landingPage;
  const companyData = data?.company;

  useEffect(() => {
    if (landingPage?.id) {
      fetch(`/api/landing-pages/${landingPage.id}/view`, {
        method: "POST",
      }).catch(() => {});
    }
  }, [landingPage?.id]);

  useEffect(() => {
    if (landingPage?.seo) {
      document.title =
        landingPage.seo.title || landingPage.title || "Landing Page";

      const updateMetaTag = (name: string, content: string) => {
        let element = document.querySelector(`meta[name="${name}"]`);
        if (!element) {
          element = document.createElement("meta");
          element.setAttribute("name", name);
          document.head.appendChild(element);
        }
        element.setAttribute("content", content);
      };

      const updateOgTag = (property: string, content: string) => {
        let element = document.querySelector(`meta[property="${property}"]`);
        if (!element) {
          element = document.createElement("meta");
          element.setAttribute("property", property);
          document.head.appendChild(element);
        }
        element.setAttribute("content", content);
      };

      if (landingPage.seo.description) {
        updateMetaTag("description", landingPage.seo.description);
        updateOgTag("og:description", landingPage.seo.description);
      }

      if (landingPage.seo.title) {
        updateOgTag("og:title", landingPage.seo.title);
      }

      if (landingPage.seo.ogImage) {
        updateOgTag("og:image", landingPage.seo.ogImage);
      }

      updateOgTag("og:type", "website");
    }

    return () => {
      document.title = "Curbe Insurance";
    };
  }, [landingPage]);

  const trackClick = async (blockId: string) => {
    try {
      await fetch(`/api/landing-blocks/${blockId}/click`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Failed to track click:", error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Cargando página..." />;
  }

  if (isError || !landingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            404
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
            Página no encontrada
          </p>
          <p className="text-gray-500 dark:text-gray-500">
            La página que buscas no existe o ha sido eliminada.
          </p>
        </div>
      </div>
    );
  }

  if (!landingPage.isPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Página no publicada
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Esta página aún no está disponible públicamente.
          </p>
        </div>
      </div>
    );
  }

  if (landingPage.isPasswordProtected && !isUnlocked) {
    const handleUnlock = () => {
      if (password === landingPage.password) {
        setIsUnlocked(true);
        toast({
          title: "¡Acceso concedido!",
          description: "Bienvenido a la página.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Contraseña incorrecta",
          description: "Por favor, intenta de nuevo.",
        });
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleUnlock();
      }
    };

    return (
      <Dialog open={true}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle data-testid="password-dialog-title">
              Esta página está protegida
            </DialogTitle>
            <DialogDescription>
              Ingresa la contraseña para acceder a este contenido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              data-testid="password-input"
            />
            <Button
              onClick={handleUnlock}
              className="w-full"
              data-testid="unlock-button"
            >
              Desbloquear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const theme = landingPage.theme;
  const sortedBlocks = [...landingPage.blocks].sort(
    (a, b) => a.position - b.position
  );

  // Show inline appointment booking if activated
  if (showAppointmentInline) {
    return (
      <AppointmentBookingInline
        landingPageId={parseInt(landingPage.id, 10)}
        agentName={landingPage.profileName || 'our team'}
        onBack={() => setShowAppointmentInline(false)}
        primaryColor={theme.primaryColor}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-white"
      data-testid="public-landing-page"
    >
      {/* Hero Section with SMARTBIO DARK Gradient - FIXED */}
      <div 
        className="relative"
        style={{
          background: (theme as any).backgroundGradient || "linear-gradient(180deg, #0f0b27 0%, #06010f 55%, #06010f 60%)",
          minHeight: "220px",
          paddingBottom: "96px",
        }}
      >
        {/* Home Button - Top Left */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-200 group"
          aria-label="Ir al inicio"
          data-testid="button-home"
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
      {landingPage.profilePhoto && (
        <div className="relative -mt-48 z-10 flex justify-center mb-5" data-testid="profile-section">
          <Avatar className="w-40 h-40 ring-8 ring-white shadow-2xl">
            <AvatarImage src={landingPage.profilePhoto} />
            <AvatarFallback 
              className="text-4xl" 
              style={{ backgroundColor: theme.primaryColor, color: 'white' }}
            >
              {landingPage.profileName?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Content Section - White Background COMPACT like SmartBio */}
      <div 
        className="bg-white px-4 pb-4"
        style={{
          fontFamily: (landingPage.theme as any)?.fontFamily || (landingPage.theme as any)?.font || "Inter, sans-serif",
          fontWeight: (landingPage.theme as any)?.fontWeight === "light" ? 300 
            : (landingPage.theme as any)?.fontWeight === "regular" ? 400 
            : (landingPage.theme as any)?.fontWeight === "medium" ? 500 
            : (landingPage.theme as any)?.fontWeight === "semibold" ? 600 
            : (landingPage.theme as any)?.fontWeight === "bold" ? 700 
            : 400,
        }}
      >
        {/* Profile Info - COMPACT and CLEAN */}
        {(landingPage.profileName || landingPage.profileBio) && (
          <div className="relative z-50 text-center mb-4 -mt-2 landing-profile-name">
            {landingPage.profileName && (
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <h1
                  className="text-2xl font-bold"
                  style={{ 
                    color: "#000000",
                    margin: 0,
                    padding: 0,
                  }}
                  data-testid="profile-name"
                >
                  {landingPage.profileName}
                </h1>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" fill="#1D9BF0"/>
                </svg>
              </div>
            )}
            {landingPage.profileBio && (
              <p
                className="text-sm leading-relaxed text-gray-600"
                data-testid="profile-bio"
              >
                {landingPage.profileBio}
              </p>
            )}

            {/* Contact Info - Phone Only */}
            {landingPage.profilePhone && (
              <div className="flex items-center justify-center mt-3">
                <a
                  href={`tel:${landingPage.profilePhone}`}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  data-testid="public-phone"
                >
                  <Phone className="w-4 h-4" />
                  <span>{landingPage.profilePhone}</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Social Media Icons - COMPACT like SmartBio */}
        {(() => {
          const socialBlocks = sortedBlocks.filter((b) => b.type === "social" && b.isVisible);
          
          const getSocialLink = (platform: string, url: string) => {
            if (!url) return "#";
            
            if (platform === "email") {
              // For email, create mailto link
              return url.startsWith("mailto:") ? url : `mailto:${url}`;
            } else if (platform === "whatsapp") {
              // For WhatsApp, create wa.me link - remove all non-numeric characters
              const phoneNumber = url.replace(/[^0-9]/g, "");
              return `https://wa.me/${phoneNumber}`;
            }
            
            // For other platforms, use URL as-is
            return url;
          };
          
          if (socialBlocks.length > 0) {
            const SOCIAL_ICONS: Record<string, any> = {
              instagram: SiInstagram,
              facebook: SiFacebook,
              twitter: SiX,
              linkedin: SiLinkedin,
              youtube: SiYoutube,
              tiktok: SiTiktok,
              whatsapp: SiWhatsapp,
              email: Mail,
            };
            return (
              <div className="flex items-center justify-center gap-2 mb-4 max-w-2xl mx-auto">
                {socialBlocks.map((block) => {
                  const SocialIcon = SOCIAL_ICONS[block.content.platform];
                  if (!SocialIcon) return null; // Skip if no valid icon found
                  const href = getSocialLink(block.content.platform, block.content.url || "");
                  
                  return (
                    <a
                      key={block.id}
                      href={href}
                      target={block.content.platform === "email" ? "_self" : "_blank"}
                      rel="noopener noreferrer"
                      onClick={() => trackClick(block.id)}
                      className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      style={{ backgroundColor: theme?.primaryColor ?? '#000000' }}
                      data-testid={`public-social-${block.id}`}
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

        {/* Other Blocks (excluding social media) - COMPACT spacing */}
        <div className="space-y-2 max-w-2xl mx-auto" data-testid="blocks-container">
          {sortedBlocks
            .filter((block) => block.isVisible && block.type !== "social")
            .map((block) => (
              <PublicBlock
                key={block.id}
                block={block}
                theme={theme}
                onTrackClick={trackClick}
                landingPageId={landingPage.id}
                onOpenAppointmentModal={() => setShowAppointmentInline(true)}
              />
            ))}
        </div>

        {/* Footer */}
        <div
          className="text-center mt-12 opacity-50 max-w-2xl mx-auto"
          style={{ color: theme.textColor }}
          data-testid="footer"
        >
          <p className="text-sm">Created with Curbe Landing Pages</p>
        </div>
      </div>

    </div>
  );
}
