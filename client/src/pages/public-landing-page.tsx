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
} from "react-icons/si";
import { Phone, Mail, MessageCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";

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

const SOCIAL_ICONS: Record<string, any> = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  twitter: SiX,
  linkedin: SiLinkedin,
  youtube: SiYoutube,
  tiktok: SiTiktok,
};

function PublicBlock({
  block,
  theme,
  onTrackClick,
}: {
  block: LandingBlock;
  theme: any;
  onTrackClick: (blockId: string) => void;
}) {
  const [emailValue, setEmailValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!block.isVisible) return null;

  const buttonStyle = {
    backgroundColor: theme.buttonColor || theme.primaryColor,
    color: theme.buttonTextColor || "#ffffff",
    borderRadius:
      theme.buttonStyle === "rounded"
        ? "12px"
        : theme.buttonStyle === "pill"
        ? "9999px"
        : "4px",
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onTrackClick(block.id);
    
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast({
        title: "¡Gracias por suscribirte!",
        description: "Te mantendremos informado.",
      });
      setEmailValue("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo procesar tu solicitud.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getContactUrl = (type: string, value: string) => {
    switch (type) {
      case "phone":
        return `tel:${value.replace(/\s/g, "")}`;
      case "email":
        return `mailto:${value}`;
      case "whatsapp":
        const cleanPhone = value.replace(/\D/g, "");
        return `https://wa.me/${cleanPhone}`;
      default:
        return "#";
    }
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case "phone":
        return Phone;
      case "email":
        return Mail;
      case "whatsapp":
        return MessageCircle;
      default:
        return Phone;
    }
  };

  switch (block.type) {
    case "link":
      return (
        <a
          href={block.content.url || "#"}
          target={block.content.openInNewTab ? "_blank" : "_self"}
          rel="noopener noreferrer"
          onClick={() => onTrackClick(block.id)}
          className="block px-6 py-4 text-center font-medium shadow-md hover:shadow-lg transition-all"
          style={buttonStyle}
          data-testid={`public-link-${block.id}`}
        >
          {block.content.label || "Click Here"}
        </a>
      );

    case "social":
      const SocialIcon = SOCIAL_ICONS[block.content.platform] || Video;
      return (
        <a
          href={block.content.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onTrackClick(block.id)}
          className="flex items-center justify-center gap-3 px-6 py-4 font-medium shadow-md hover:shadow-lg transition-all"
          style={buttonStyle}
          data-testid={`public-social-${block.id}`}
        >
          <SocialIcon className="w-5 h-5" />
          <span>
            {block.content.customLabel ||
              (block.content.platform?.charAt(0).toUpperCase() +
                block.content.platform?.slice(1)) ||
              "Social Media"}
          </span>
        </a>
      );

    case "video":
      const aspectRatio = block.content.aspectRatio || "16:9";
      const paddingBottom = aspectRatio === "16:9" ? "56.25%" : "100%";
      return (
        <div
          className="relative w-full overflow-hidden rounded-lg shadow-md"
          style={{ paddingBottom }}
          data-testid={`public-video-${block.id}`}
        >
          <iframe
            src={block.content.url || ""}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );

    case "text":
      const alignment = block.content.alignment || "left";
      const size = block.content.size || "md";
      const textSize =
        size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base";
      return (
        <div
          className={`text-${alignment} ${textSize}`}
          style={{ color: theme.textColor }}
          data-testid={`public-text-${block.id}`}
        >
          {block.content.content || "Your text here"}
        </div>
      );

    case "image":
      return (
        <div
          className="w-full overflow-hidden rounded-lg shadow-md"
          data-testid={`public-image-${block.id}`}
        >
          <img
            src={block.content.url || "/placeholder.png"}
            alt={block.content.alt || "Image"}
            className="w-full h-auto"
            style={{
              aspectRatio: block.content.aspectRatio || "auto",
            }}
          />
        </div>
      );

    case "email":
      return (
        <form
          onSubmit={handleEmailSubmit}
          className="space-y-3"
          data-testid={`public-email-${block.id}`}
        >
          <Input
            type="email"
            placeholder={block.content.placeholder || "Enter your email"}
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            required
            className="rounded-lg"
            data-testid={`email-input-${block.id}`}
          />
          <Button
            type="submit"
            className="w-full transition-all"
            style={buttonStyle}
            disabled={isSubmitting}
            data-testid={`email-submit-${block.id}`}
          >
            {isSubmitting
              ? "Enviando..."
              : block.content.buttonText || "Subscribe"}
          </Button>
        </form>
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
          data-testid={`public-divider-${block.id}`}
        />
      );

    case "contact":
      const ContactIcon = getContactIcon(block.content.type);
      const contactUrl = getContactUrl(
        block.content.type,
        block.content.value || ""
      );
      return (
        <a
          href={contactUrl}
          onClick={() => onTrackClick(block.id)}
          className="flex items-center justify-center gap-3 px-6 py-4 font-medium shadow-md hover:shadow-lg transition-all"
          style={buttonStyle}
          data-testid={`public-contact-${block.id}`}
        >
          <ContactIcon className="w-5 h-5" />
          <span>{block.content.label || block.content.value || "Contact"}</span>
        </a>
      );

    default:
      return null;
  }
}

export default function PublicLandingPage() {
  const [, params] = useRoute("/l/:slug");
  const slug = params?.slug;
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { toast } = useToast();

  const {
    data: landingPage,
    isLoading,
    isError,
  } = useQuery<LandingPage>({
    queryKey: ["/l", slug],
    queryFn: async () => {
      const res = await fetch(`/l/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Landing page not found");
        }
        throw new Error("Failed to load landing page");
      }
      return res.json();
    },
    enabled: !!slug,
  });

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
  const background = theme.backgroundGradient || theme.backgroundColor;
  const sortedBlocks = [...landingPage.blocks].sort(
    (a, b) => a.position - b.position
  );

  return (
    <div
      className="min-h-screen"
      style={{ background }}
      data-testid="public-landing-page"
    >
      <div className="max-w-2xl mx-auto px-4 py-12">
        {(landingPage.profilePhoto ||
          landingPage.profileName ||
          landingPage.profileBio) && (
          <div className="text-center mb-8" data-testid="profile-section">
            {landingPage.profilePhoto && (
              <Avatar
                className="w-24 h-24 mx-auto mb-4 shadow-lg"
                data-testid="profile-photo"
              >
                <AvatarImage src={landingPage.profilePhoto} />
                <AvatarFallback style={{ color: theme.textColor }}>
                  {landingPage.profileName?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            )}
            {landingPage.profileName && (
              <h1
                className="text-3xl font-bold mb-2"
                style={{ color: theme.textColor }}
                data-testid="profile-name"
              >
                {landingPage.profileName}
              </h1>
            )}
            {landingPage.profileBio && (
              <p
                className="text-lg opacity-80"
                style={{ color: theme.textColor }}
                data-testid="profile-bio"
              >
                {landingPage.profileBio}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3" data-testid="blocks-container">
          {sortedBlocks
            .filter((block) => block.isVisible)
            .map((block) => (
              <PublicBlock
                key={block.id}
                block={block}
                theme={theme}
                onTrackClick={trackClick}
              />
            ))}
        </div>

        <div
          className="text-center mt-12 opacity-50"
          style={{ color: theme.textColor }}
          data-testid="footer"
        >
          <p className="text-sm">Created with Curbe Landing Pages</p>
        </div>
      </div>
    </div>
  );
}
