import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  ChevronRight, 
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
  Activity
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/^\+1/, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export interface SmsVoiceNumber {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  cnam: string | null;
  status: string;
  monthlyFee: string;
  purchasedAt: string;
  ownerUserId: string | null;
  ownerName: string | null;
  complianceStatus: string | null;
  complianceApplicationId: string | null;
  telnyxVerificationRequestId: string | null;
  e911Enabled: boolean | null;
  telnyxPhoneNumberId?: string | null;
  callForwardingEnabled?: boolean;
  callForwardingDestination?: string | null;
  callForwardingKeepCallerId?: boolean;
}

export interface TelnyxVerificationRequest {
  id: string;
  business_name?: string;
  brand_display_name?: string;
  business_type?: string;
  business_vertical?: string;
  website_url?: string;
  street_address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  first_name?: string;
  last_name?: string;
  contact_phone?: string;
  contact_email?: string;
  verification_status?: string;
  use_case?: string;
  campaign_description?: string;
  sample_messages?: string[];
}

export function getComplianceStatusBadge(status: string | null) {
  switch (status) {
    case "approved":
    case "verified":
      return (
        <Badge data-testid="badge-status-verified" className="bg-green-500/10 text-green-600 border-green-500/20">
          Verified
        </Badge>
      );
    case "pending":
    case "submitted":
    case "in_review":
      return (
        <Badge data-testid="badge-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge data-testid="badge-status-rejected" className="bg-red-500/10 text-red-600 border-red-500/20">
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge data-testid="badge-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          Pending
        </Badge>
      );
  }
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  hasWarning?: boolean;
}

interface SectionItem {
  title: string;
  description: string;
  href: string;
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

function SectionRow({ item, onClick }: { item: SectionItem; onClick: (href: string) => void }) {
  return (
    <div
      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
      className="flex items-center justify-between py-4 px-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
      onClick={() => onClick(item.href)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {item.title}
          </h3>
          {item.hasWarning && (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {item.description}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0 ml-4 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
    </div>
  );
}

// Content-only version for embedding in integrations.tsx
export function SmsVoiceContent() {
  const [, setLocation] = useLocation();
  
  const sendersItems: SectionItem[] = [
    {
      title: "Numbers",
      description: "Manage your virtual numbers for SMS, MMS, and voice services.",
      href: "/settings/sms-voice/numbers",
    },
    {
      title: "Bring your own CPaaS",
      description: "Manage your connected CPaaS providers (Twilio, Vonage, etc.) and linked numbers.",
      href: "/settings/sms-voice/cpaas",
    },
    {
      title: "Sender settings",
      description: "Manage default sender numbers for various countries.",
      href: "/settings/sms-voice/sender-settings",
    },
  ];

  const complianceItems: SectionItem[] = [
    {
      title: "Toll-free verification",
      description: "Verify and manage your toll-free numbers to ensure compliance and enhance your business's credibility.",
      href: "/settings/sms-voice/toll-free-verification",
      hasWarning: true,
    },
    {
      title: "10DLC verification",
      description: "Register your brand and campaigns for 10DLC compliance.",
      href: "/settings/sms-voice/10dlc-verification",
    },
  ];

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Senders</h2>
          </div>
          <div className="px-6 divide-y divide-slate-100 dark:divide-slate-800">
            {sendersItems.map((item) => (
              <SectionRow key={item.title} item={item} onClick={handleNavigation} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Compliance</h2>
          </div>
          <div className="px-6 divide-y divide-slate-100 dark:divide-slate-800">
            {complianceItems.map((item) => (
              <SectionRow key={item.title} item={item} onClick={handleNavigation} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SmsVoice() {
  const [, setLocation] = useLocation();

  const menuItems: { channels: NavigationItem[]; features: NavigationItem[]; administration: NavigationItem[] } = {
    channels: [
      { label: "SMS & voice", href: "/settings/sms-voice", icon: Phone, active: true, hasWarning: true },
      { label: "Email", href: "/settings/email", icon: Mail },
      { label: "WhatsApp", href: "/settings/whatsapp", icon: SiWhatsapp },
      { label: "Facebook", href: "/settings/facebook", icon: SiFacebook },
      { label: "Instagram", href: "/settings/instagram", icon: SiInstagram },
    ],
    features: [
      { label: "Messenger", href: "/inbox", icon: MessageSquare },
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "API & Integrations", href: "/settings/api", icon: Plug },
      { label: "Email to SMS", href: "/settings/email-to-sms", icon: Mail },
      { label: "Auto-responders", href: "/campaigns", icon: Zap },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Deals", href: "/deals", icon: DollarSign },
      { label: "Pulse AI", href: "/settings/pulse-ai", icon: Activity },
    ],
    administration: [
      { label: "Workspace", href: "/settings/company", icon: Building },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "My account", href: "/settings/profile", icon: UserIcon },
    ],
  };

  const sendersItems: SectionItem[] = [
    {
      title: "Numbers",
      description: "Manage your virtual numbers for SMS, MMS, and voice services.",
      href: "/settings/sms-voice/numbers",
    },
    {
      title: "Bring your own CPaaS",
      description: "Manage your connected CPaaS providers (Twilio, Vonage, etc.) and linked numbers.",
      href: "/settings/sms-voice/cpaas",
    },
    {
      title: "Sender settings",
      description: "Manage default sender numbers for various countries.",
      href: "/settings/sms-voice/sender-settings",
    },
  ];

  const complianceItems: SectionItem[] = [
    {
      title: "Toll-free verification",
      description: "Verify and manage your toll-free numbers to ensure compliance and enhance your business's credibility.",
      href: "/settings/sms-voice/toll-free-verification",
      hasWarning: true,
    },
    {
      title: "10DLC verification",
      description: "Register your brand and campaigns for 10DLC compliance.",
      href: "/settings/sms-voice/10dlc-verification",
    },
  ];

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  return (
    <div className="flex gap-6" data-testid="page-sms-voice">
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
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            SMS & voice
          </h1>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Senders</h2>
            </div>
            <div className="px-6 divide-y divide-slate-100 dark:divide-slate-800">
              {sendersItems.map((item) => (
                <SectionRow key={item.title} item={item} onClick={handleNavigation} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Compliance</h2>
            </div>
            <div className="px-6 divide-y divide-slate-100 dark:divide-slate-800">
              {complianceItems.map((item) => (
                <SectionRow key={item.title} item={item} onClick={handleNavigation} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
