import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  CheckCircle2,
  Play,
  Mail,
  ExternalLink,
  Calendar,
  Users,
  Settings,
  Phone,
  MessageSquare,
  Building,
  CreditCard,
  User as UserIcon,
  Zap,
  Plug,
  Ticket,
  ListTodo,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";

interface EmailSettings {
  id: string;
  companyId: string;
  sendingDomain: string;
  verificationStatus: string;
  dkimStatus?: string;
  isActive: boolean;
  senders?: Array<{ fromEmail: string; fromName: string; replyToEmail?: string }>;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
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
    </button>
  );
}

function SettingsSidebar({ onNavigate }: { onNavigate: (href: string) => void }) {
  const menuItems: { channels: NavigationItem[]; features: NavigationItem[]; administration: NavigationItem[] } = {
    channels: [
      { label: "SMS & voice", href: "/integrations/sms-voice", icon: Phone },
      { label: "Email", href: "/settings/email", icon: Mail, active: true },
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

  return (
    <div className="w-60 shrink-0 hidden lg:block">
      <div className="sticky top-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Settings</span>
        </div>

        <div className="py-2">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
          {menuItems.channels.map((item) => (
            <NavigationLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>

        <div className="py-2">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
          {menuItems.features.map((item) => (
            <NavigationLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>

        <div className="py-2 pb-3">
          <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
          {menuItems.administration.map((item) => (
            <NavigationLink key={item.label} item={item} onClick={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EmailIntegrationPage() {
  const [, setLocation] = useLocation();

  const { data: settingsResponse, isLoading } = useQuery<{ configured: boolean; settings: EmailSettings | null }>({
    queryKey: ["/api/ses/settings"],
  });

  const settings = settingsResponse?.settings;
  const hasDomainConfigured = !!settings?.sendingDomain;
  const isDomainVerified = settings?.verificationStatus === "SUCCESS" || settings?.dkimStatus === "SUCCESS";

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading email settings..." />;
  }

  // If domain is fully configured and verified, show management view
  if (hasDomainConfigured && isDomainVerified) {
    return (
      <div className="flex gap-6" data-testid="page-email-integration">
        <SettingsSidebar onNavigate={handleNavigation} />
        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">Email</h1>
              <p className="text-sm text-muted-foreground">Manage your email sending domain and sender profiles</p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/integrations/email/flow")} data-testid="button-manage-domain">
              <Settings className="w-4 h-4 mr-2" />
              Manage Domain
            </Button>
          </div>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Domain verified</h2>
                  <p className="text-sm text-muted-foreground">{settings.sendingDomain}</p>
                </div>
              </div>

              {settings.senders && settings.senders.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">Configured senders</h3>
                  {settings.senders.map((sender, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sender.fromName}</p>
                        <p className="text-xs text-muted-foreground">{sender.fromEmail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If domain is being set up but not verified, show pending view with sidebar
  if (hasDomainConfigured && !isDomainVerified) {
    return (
      <div className="flex gap-6" data-testid="page-email-integration">
        <SettingsSidebar onNavigate={handleNavigation} />
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">Email</h1>
            <p className="text-sm text-muted-foreground">Complete your domain verification to start sending emails</p>
          </div>

          <Card className="border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-950/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-1">Domain verification pending</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your domain <strong>{settings?.sendingDomain}</strong> is awaiting DNS verification. Add the required DNS records to complete setup.
                  </p>
                  <Button 
                    onClick={() => setLocation("/integrations/email/flow")}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-continue-setup"
                  >
                    Continue Setup
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No domain configured - show landing page with sidebar
  return (
    <div className="flex gap-6" data-testid="page-email-integration">
      <SettingsSidebar onNavigate={handleNavigation} />
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">Email</h1>
        </div>

        {/* Hero Section */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-3">Get started with email campaigns</h2>
                  <p className="text-muted-foreground">
                    Send professional emails in minutes. Share offers, updates, or newsletters and track campaign results in real time.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Create emails with a simple editor</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Send to thousands of contacts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Track opens, clicks, and unsubscribes</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={() => setLocation("/integrations/email/flow")}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-connect-domain"
                  >
                    Connect your domain
                  </Button>
                  <Button variant="outline" data-testid="button-watch-tutorial">
                    <Play className="w-4 h-4 mr-2" />
                    Watch tutorial
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  To send email campaigns, first connect and verify your domain.
                </p>

                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                        Don't have a domain?
                      </p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        <a href="#" className="text-blue-600 hover:underline">Get a domain now</a> and start sending emails in minutes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Preview Mockup */}
              <div className="hidden md:block">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 shadow-lg border">
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                      <Mail className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-sm">Email campaign preview</span>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex">
                        <span className="text-muted-foreground w-16">From</span>
                        <span>hello@yourdomain.com</span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground w-16">To</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          10,240 contacts
                        </span>
                      </div>
                      <div className="flex">
                        <span className="text-muted-foreground w-16">Subject</span>
                        <span>Don't miss our special offer</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t">
                      <Button variant="outline" size="sm" className="text-xs">
                        <Calendar className="w-3 h-3 mr-1" />
                        Schedule
                      </Button>
                      <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700">
                        <Play className="w-3 h-3 mr-1" />
                        Send email
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold">Email campaigns FAQ</h2>
            <p className="text-sm text-muted-foreground">
              Haven't found what you were looking for? <a href="#" className="text-blue-600 hover:underline">Contact us</a>
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            <AccordionItem value="benefits" className="border rounded-lg bg-white dark:bg-gray-800">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-sm font-medium">What are the benefits of email campaigns?</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <p className="text-sm text-muted-foreground">
                  Email campaigns help you reach your audience directly, build customer relationships, promote products or services, and track engagement with detailed analytics. They're cost-effective and provide measurable results.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-to-start" className="border rounded-lg bg-white dark:bg-gray-800">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-sm font-medium">How do I start sending email campaigns?</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <p className="text-sm text-muted-foreground">
                  First, connect and verify your sending domain. Then, create sender profiles for your emails. Once verified, you can create campaigns, select your audience, and start sending professional emails.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="verify-domain" className="border rounded-lg bg-white dark:bg-gray-800">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-sm font-medium">Why do I need to verify my domain?</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <p className="text-sm text-muted-foreground">
                  Domain verification proves you own the domain and improves email deliverability. It helps prevent spam and ensures your emails reach recipients' inboxes instead of spam folders.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="replies" className="border rounded-lg bg-white dark:bg-gray-800">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="text-sm font-medium">Where will my recipients' replies go?</span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <p className="text-sm text-muted-foreground">
                  Replies go to the email address you specify when creating your sender profile. You can set a custom reply-to address different from your sending address if needed.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
