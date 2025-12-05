import { useState } from "react";
import {
  SiInstagram,
  SiFacebook,
  SiX,
  SiLinkedin,
  SiYoutube,
  SiTiktok,
} from "react-icons/si";
import { 
  Phone, 
  Mail, 
  MessageCircle,
  ExternalLink,
  Check,
  Link2,
  Calendar as CalendarIcon,
  Quote,
  HelpCircle,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapBlockDisplay } from "@/components/map-block-display";
import { useToast } from "@/hooks/use-toast";

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

export function LeadCaptureForm({ block, theme, landingPageId }: any) {
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/landing-pages/${landingPageId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId: block.id,
          ...formData
        }),
      });
      
      if (!response.ok) throw new Error('Failed to submit');
      
      setIsSuccess(true);
      toast({
        title: "Success!",
        description: block.content.successMessage || "Thank you for your message!",
      });
      setFormData({});
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isSuccess) {
    return (
      <Card className="p-8 text-center rounded-[18px] shadow-lg" data-testid={`lead-form-success-${block.id}`}>
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h3 className="text-2xl font-bold mb-2">{block.content.successMessage || "Thank you!"}</h3>
      </Card>
    );
  }
  
  return (
    <Card className="p-8 rounded-[18px] shadow-lg" data-testid={`lead-form-${block.id}`}>
      {block.content.title && (
        <h3 className="text-2xl font-bold mb-2">{block.content.title}</h3>
      )}
      {block.content.subtitle && (
        <p className="text-gray-600 mb-6">{block.content.subtitle}</p>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {block.content.fields?.map((field: any) => (
          <div key={field.name}>
            {field.type === 'textarea' ? (
              <Textarea
                placeholder={field.placeholder}
                required={field.required}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                className="rounded-xl"
                data-testid={`lead-form-field-${field.name}`}
              />
            ) : (
              <Input
                type={field.type || 'text'}
                placeholder={field.placeholder}
                required={field.required}
                value={formData[field.name] || ''}
                onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                className="rounded-xl"
                data-testid={`lead-form-field-${field.name}`}
              />
            )}
          </div>
        ))}
        
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl py-6 text-lg font-semibold transition-all duration-300 hover:shadow-xl"
          style={{
            backgroundColor: theme.buttonColor || theme.primaryColor,
            color: theme.buttonTextColor || '#ffffff',
          }}
          data-testid="lead-form-submit"
        >
          {isSubmitting ? "Sending..." : (block.content.submitText || "Submit")}
        </Button>
      </form>
    </Card>
  );
}

export function PublicBlock({
  block,
  theme,
  onTrackClick,
  landingPageId,
  onOpenAppointmentModal,
}: {
  block: LandingBlock;
  theme: any;
  onTrackClick: (blockId: string) => void;
  landingPageId: string;
  onOpenAppointmentModal?: () => void;
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
          rel={block.content.openInNewTab ? "noopener noreferrer" : ""}
          onClick={() => onTrackClick(block.id)}
          className="group flex items-center justify-between px-8 py-5 rounded-[18px] font-semibold text-lg shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_20px_40px_-12px_rgba(15,23,42,0.20)] transition-all duration-300 hover:scale-[1.02]"
          style={{
            backgroundColor: theme.buttonColor || theme.primaryColor,
            color: theme.buttonTextColor || '#ffffff',
          }}
          data-testid={`link-block-${block.id}`}
        >
          <span>{block.content.label || "Click Here"}</span>
          <ExternalLink className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
        </a>
      );

    case "social":
      const SocialIcon = SOCIAL_ICONS[block.content.platform] || Link2;
      return (
        <a
          href={block.content.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onTrackClick(block.id)}
          className="flex items-center justify-center w-12 h-12 bg-black text-white rounded-full hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          data-testid={`social-block-${block.id}`}
        >
          <SocialIcon className="h-6 w-6" />
        </a>
      );

    case "video":
      const aspectRatio = block.content.aspectRatio || "16:9";
      const paddingBottom = aspectRatio === "16:9" ? "56.25%" : "100%";
      return (
        <div
          className="relative w-full overflow-hidden rounded-[18px] shadow-lg transition-all duration-300 hover:shadow-xl"
          style={{ paddingBottom }}
          data-testid={`video-block-${block.id}`}
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
      const size = block.content.size || "md";
      const textSize =
        size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";
      return (
        <div
          className={`prose prose-sm max-w-none ${textSize} leading-relaxed`}
          style={{ color: theme.textColor }}
          dangerouslySetInnerHTML={{ __html: block.content.content || "<p>Your text here</p>" }}
          data-testid={`text-block-${block.id}`}
        />
      );

    case "image":
      return (
        <div
          className="w-full overflow-hidden rounded-[18px] shadow-lg transition-all duration-300 hover:shadow-xl"
          data-testid={`image-block-${block.id}`}
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
          data-testid={`email-block-${block.id}`}
        >
          <Input
            type="email"
            placeholder={block.content.placeholder || "Enter your email"}
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            required
            className="rounded-xl py-6 text-base transition-all duration-300 focus:shadow-lg"
            data-testid={`email-input-${block.id}`}
          />
          <Button
            type="submit"
            className="w-full py-6 text-lg font-semibold rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
            style={{
              backgroundColor: theme.buttonColor || theme.primaryColor,
              color: theme.buttonTextColor || '#ffffff',
            }}
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
          className="my-6"
          style={{
            borderStyle: block.content.style || "solid",
            borderColor: theme.textColor,
            opacity: 0.2,
            width: block.content.width || "100%",
            margin: "1.5rem auto",
          }}
          data-testid={`divider-block-${block.id}`}
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
          className="flex items-center justify-center gap-3 px-8 py-5 rounded-[18px] font-semibold text-lg shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] hover:shadow-[0_20px_40px_-12px_rgba(15,23,42,0.20)] transition-all duration-300 hover:scale-[1.02]"
          style={{
            backgroundColor: theme.buttonColor || theme.primaryColor,
            color: theme.buttonTextColor || '#ffffff',
          }}
          data-testid={`contact-block-${block.id}`}
        >
          <ContactIcon className="h-6 w-6" />
          <span>{block.content.label || block.content.value || "Contact"}</span>
        </a>
      );

    case "maps":
      return (
        <div onClick={() => onTrackClick(block.id)}>
          <MapBlockDisplay
            placeId={block.content.placeId}
            latitude={block.content.latitude}
            longitude={block.content.longitude}
            formattedAddress={block.content.formattedAddress || block.content.address}
            zoomLevel={block.content.zoom || 15}
            height="150px"
            showButton={true}
            buttonColor={theme?.buttonColor || theme?.primaryColor || "#3B82F6"}
          />
        </div>
      );

    case "lead-form":
      return <LeadCaptureForm block={block} theme={theme} landingPageId={landingPageId} />;

    case "calendar":
      return (
        <div 
          className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6"
          data-testid={`calendar-block-${block.id}`}
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
              onClick={() => {
                onTrackClick(block.id);
                onOpenAppointmentModal?.();
              }}
              data-testid="button-schedule-appointment"
              className="px-4 py-2 rounded-full bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all duration-200 group flex items-center gap-2 font-semibold"
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
        <Card className="p-6 rounded-[18px] shadow-lg transition-all duration-300 hover:shadow-xl" data-testid={`testimonials-block-${block.id}`}>
          <div className="flex items-start gap-4">
            <Quote className="h-8 w-8 text-gray-300 flex-shrink-0" />
            <div>
              <p className="text-lg italic mb-4" style={{ color: theme.textColor }}>
                "{block.content.quote || "Great service!"}"
              </p>
              <div className="flex items-center gap-3">
                {block.content.avatar && (
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={block.content.avatar} />
                    <AvatarFallback>{block.content.name?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <p className="font-semibold">{block.content.name || "Anonymous"}</p>
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
      const [isOpen, setIsOpen] = useState(false);
      return (
        <Card className="overflow-hidden rounded-[18px] shadow-lg transition-all duration-300 hover:shadow-xl" data-testid={`faq-block-${block.id}`}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-6 py-4 flex items-center justify-between text-left transition-all duration-300 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5" style={{ color: theme.primaryColor }} />
              <span className="font-semibold text-lg">{block.content.question || "Question"}</span>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {isOpen && (
            <div className="px-6 py-4 bg-gray-50 border-t">
              <p className="text-gray-700">{block.content.answer || "Answer goes here."}</p>
            </div>
          )}
        </Card>
      );

    case "stats":
      return (
        <Card className="p-6 rounded-[18px] shadow-lg transition-all duration-300 hover:shadow-xl" data-testid={`stats-block-${block.id}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-opacity-10" style={{ backgroundColor: theme.primaryColor }}>
              <BarChart3 className="h-8 w-8" style={{ color: theme.primaryColor }} />
            </div>
            <div>
              <p className="text-3xl font-bold" style={{ color: theme.primaryColor }}>
                {block.content.value || "0"}
              </p>
              <p className="text-gray-600">{block.content.label || "Statistic"}</p>
            </div>
          </div>
        </Card>
      );

    default:
      return null;
  }
}
