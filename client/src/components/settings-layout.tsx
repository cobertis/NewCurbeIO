import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Phone, 
  Mail, 
  Building, 
  CreditCard, 
  Shield, 
  Palette,
  User as UserIcon,
  UsersRound,
  Plug,
  Zap,
  MessageCircle
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiTelegram } from "react-icons/si";

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeSection?: string;
}

export function SettingsLayout({ children, activeSection }: SettingsLayoutProps) {
  const [location, setLocation] = useLocation();
  
  const getActiveView = () => {
    if (activeSection) return activeSection;
    if (location.startsWith("/settings/profile")) return "profile";
    if (location.startsWith("/settings/security")) return "security";
    if (location.startsWith("/settings/notifications")) return "notifications";
    if (location.startsWith("/settings/company")) return "company";
    if (location.startsWith("/settings/team")) return "team";
    if (location.startsWith("/settings/billing")) return "billing";
    if (location.startsWith("/settings/sms-voice")) return "sms-voice";
    if (location.startsWith("/settings/email")) return "email";
    if (location.startsWith("/settings/integrations")) return "integrations";
    if (location.startsWith("/settings/automations")) return "automations";
    if (location.startsWith("/settings/whatsapp")) return "whatsapp";
    if (location.startsWith("/settings/facebook")) return "facebook";
    if (location.startsWith("/settings/instagram")) return "instagram";
    if (location.startsWith("/settings/telegram")) return "telegram";
    if (location.startsWith("/settings/chat-widget")) return "chat-widget";
    if (location.startsWith("/settings/white-label")) return "white-label";
    return "profile";
  };
  
  const activeView = getActiveView();

  const menuItems = {
    account: [
      { label: "Profile", href: "/settings/profile", icon: UserIcon, active: activeView === "profile" },
      { label: "Company", href: "/settings/company", icon: Building, active: activeView === "company" },
      { label: "Team", href: "/settings/team", icon: UsersRound, active: activeView === "team" },
      { label: "Billing", href: "/settings/billing", icon: CreditCard, active: activeView === "billing" },
      { label: "Security", href: "/settings/security", icon: Shield, active: activeView === "security" },
      { label: "White Label", href: "/settings/white-label", icon: Palette, active: activeView === "white-label" },
    ],
    channels: [
      { label: "SMS & Voice", href: "/settings/sms-voice", icon: Phone, active: activeView === "sms-voice" },
      { label: "Email", href: "/settings/email", icon: Mail, active: activeView === "email" },
      { label: "WhatsApp", href: "/settings/whatsapp", icon: SiWhatsapp, active: activeView === "whatsapp" },
      { label: "Facebook", href: "/settings/facebook", icon: SiFacebook, active: activeView === "facebook" },
      { label: "Instagram", href: "/settings/instagram", icon: SiInstagram, active: activeView === "instagram" },
      { label: "Telegram", href: "/settings/telegram", icon: SiTelegram, active: activeView === "telegram" },
      { label: "Chat Widget", href: "/settings/chat-widget", icon: MessageCircle, active: activeView === "chat-widget" },
    ],
    features: [
      { label: "Integrations", href: "/settings/integrations", icon: Plug, active: activeView === "integrations" },
      { label: "Automations", href: "/settings/automations", icon: Zap, active: activeView === "automations" },
    ],
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  return (
    <div className="flex gap-6 items-start" data-testid="settings-layout">
      <div className="w-52 shrink-0 hidden lg:block">
        <nav className="sticky top-20 space-y-1">
          <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
          {menuItems.account.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                item.active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}

          <p className="px-3 py-2 pt-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
          {menuItems.channels.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                item.active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}

          <p className="px-3 py-2 pt-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
          {menuItems.features.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors",
                item.active 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
