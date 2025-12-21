import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  Mail, 
  Settings, 
  Building, 
  CreditCard, 
  Users, 
  Zap, 
  Plug, 
  User as UserIcon,
  MessageSquare,
  AlertTriangle,
  Ticket,
  ListTodo,
  DollarSign,
  Sparkles,
  Construction,
  ArrowLeft
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  hasWarning?: boolean;
}

function NavigationLink({ item, onClick }: { item: NavigationItem; onClick: (href: string) => void }) {
  return (
    <button
      onClick={() => onClick(item.href)}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
        item.active && "border-l-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
      )}
    >
      <item.icon className="h-4 w-4" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
    </button>
  );
}

export default function SmsVoiceSenderSettings() {
  const [, setLocation] = useLocation();

  const menuItems: { channels: NavigationItem[]; features: NavigationItem[]; administration: NavigationItem[] } = {
    channels: [
      { label: "SMS & voice", href: "/integrations/sms-voice", icon: Phone, active: true },
      { label: "Email", href: "/settings/email", icon: Mail },
      { label: "Chat widget", href: "/integrations", icon: MessageSquare },
      { label: "WhatsApp", href: "/integrations", icon: SiWhatsapp },
      { label: "Facebook", href: "/integrations", icon: SiFacebook },
      { label: "Instagram", href: "/integrations", icon: SiInstagram },
    ],
    features: [
      { label: "Messenger", href: "/inbox", icon: MessageSquare },
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "API & Integrations", href: "/integrations", icon: Plug },
      { label: "Email to SMS", href: "/settings/email-to-sms", icon: Mail },
      { label: "Auto-responders", href: "/campaigns", icon: Zap },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Deals", href: "/deals", icon: DollarSign },
      { label: "Point AI", href: "/ai-assistant", icon: Sparkles },
    ],
    administration: [
      { label: "Workspace", href: "/settings/company", icon: Building },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "My account", href: "/settings/profile", icon: UserIcon },
    ],
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  return (
    <div className="flex gap-6" data-testid="page-sms-voice-sender-settings">
      <div className="w-60 shrink-0 hidden lg:block">
        <div className="sticky top-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Settings</span>
          </div>

          <div className="py-2">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
            {menuItems.channels.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>

          <div className="py-2">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
            {menuItems.features.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>

          <div className="py-2 pb-3">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
            {menuItems.administration.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/integrations/sms-voice">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-sms-voice">
              <ArrowLeft className="h-4 w-4" />
              Back to SMS & Voice
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            Sender Settings
          </h1>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Construction className="h-12 w-12 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Under Construction
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                We're working hard to bring you the Sender Settings feature. 
                This page will allow you to manage default sender numbers for various countries.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Check back soon for updates.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
