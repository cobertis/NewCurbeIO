import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  LogOut,
  BarChart3,
  Users,
  Building2,
  CreditCard,
  Package,
  FileText,
  Shield,
  LifeBuoy,
  Mail,
  Megaphone,
  AtSign,
  Settings,
  Ticket,
  MessageSquare,
  AlertTriangle,
  Calendar,
  FileCheck,
  Heart,
  Stethoscope,
  ChevronRight,
  UserPlus,
  Globe,
  Send,
  Inbox,
  Workflow,
  Contact,
  CheckSquare,
  Bell,
  ImagePlus,
  MessageCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient, getCompanyQueryOptions } from "@/lib/queryClient";
import { getRoleAwareQueries } from "@/lib/route-queries";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { User, BulkvsThread } from "@shared/schema";
import logo from "@assets/logo no fondo_1760450756816.png";
import { useWebPhoneStore, webPhone } from "@/services/webphone";

// Component to show unread iMessage count
function ImessageUnreadBadge() {
  const { data: conversations } = useQuery({
    queryKey: ['/api/imessage/conversations'],
    refetchInterval: 5000,
  });

  const unreadConversationCount = ((conversations as any[])?.filter((conv: any) => conv.unreadCount > 0) ?? []).length;

  if (unreadConversationCount === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
      <span className="text-white text-[8px] font-bold">
        {unreadConversationCount > 9 ? '9+' : unreadConversationCount}
      </span>
    </div>
  );
}

// Component to show unread WhatsApp count
function WhatsAppUnreadBadge() {
  const { data: statusData } = useQuery<{ success: boolean; status: { status: string } }>({
    queryKey: ['/api/whatsapp/status'],
    refetchInterval: 10000,
    staleTime: 5000,
  });
  
  const isAuthenticated = statusData?.status?.status === 'authenticated' || statusData?.status?.status === 'ready';
  
  const { data: chatsData } = useQuery<{ success: boolean; chats: Array<{ id: string; unreadCount: number }> }>({
    queryKey: ['/api/whatsapp/chats'],
    refetchInterval: 3000,
    enabled: isAuthenticated,
  });

  const unreadConversationCount = chatsData?.chats?.filter((chat) => chat.unreadCount > 0).length ?? 0;

  if (unreadConversationCount === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
      <span className="text-white text-[8px] font-bold">
        {unreadConversationCount > 9 ? '9+' : unreadConversationCount}
      </span>
    </div>
  );
}

// SMS Unread Badge component
function SmsUnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
      <span className="text-white text-[8px] font-bold">
        {count > 9 ? '9+' : count}
      </span>
    </div>
  );
}

// Menu items for superadmin
const superadminMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Plans", url: "/plans", icon: CreditCard },
  { title: "Features", url: "/features", icon: Package },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Billing", url: "/billing", icon: CreditCard },
  { title: "Audit Logs", url: "/audit-logs", icon: Shield },
  { title: "Tickets", url: "/tickets", icon: Ticket },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Incoming SMS", url: "/incoming-sms", icon: MessageSquare },
  { title: "System Alerts", url: "/system-alerts", icon: AlertTriangle },
  { title: "Email Config", url: "/email-configuration", icon: AtSign },
  { title: "Birthday Images", url: "/birthday-images", icon: ImagePlus },
  { title: "Settings", url: "/settings", icon: Settings },
];

// Menu items for regular users
const regularUserMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Policies", url: "/policies", icon: FileCheck },
  { title: "Quotes", url: "/quotes", icon: ClipboardList },
  { title: "Leads", url: "/leads", icon: Contact },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
];

// Communications menu items
const communicationsMenuItems = [
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare, badge: "whatsapp" },
  { title: "iMessage", url: "/imessage", icon: MessageCircle, badge: "imessage", featureKey: "imessage" },
  { title: "SMS", url: "/sms", icon: Inbox, badge: "sms" },
  { title: "Email", url: "/email-campaigns", icon: Mail },
];

// Marketing menu items
const marketingMenuItems = [
  { title: "Campaigns", url: "/imessage-campaigns", icon: Send },
  { title: "Contacts", url: "/contacts", icon: Contact },
  { title: "Referrals", url: "/referrals", icon: UserPlus },
  { title: "Landing page", url: "/landing-page", icon: Globe },
];

// Configuration menu items
const configurationMenuItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const { isMobile, setOpenMobile } = useSidebar();
  
  const { data: userData } = useQuery<{ user: User & { companyName?: string } }>({
    queryKey: ["/api/session"],
  });

  const handlePrefetch = (url: string) => {
    const queries = getRoleAwareQueries(url, userData?.user?.role);
    queries.forEach((queryDescriptor) => {
      queryClient.prefetchQuery({
        queryKey: queryDescriptor.queryKey,
        staleTime: queryDescriptor.staleTime,
      });
    });
  };

  const { data: companyData, isSuccess: companyDataLoaded } = useQuery<{ company: { logo?: string } }>({
    ...getCompanyQueryOptions(userData?.user?.companyId),
  });

  const { data: featuresData } = useQuery<{ features: Array<{ key: string }> }>({
    queryKey: [`/api/companies/${userData?.user?.companyId}/features`],
    enabled: !!userData?.user?.companyId,
  });

  const enabledFeatures = new Set(featuresData?.features?.map(f => f.key) || []);

  const { data: threadsData } = useQuery<BulkvsThread[]>({
    queryKey: ["/api/bulkvs/threads"],
    enabled: !!userData?.user,
    refetchInterval: 5000,
  });

  const isSuperadmin = userData?.user?.role === "superadmin";
  const unreadThreadCount = (threadsData?.filter(thread => thread.unreadCount > 0) ?? []).length;

  const { data: incomingSmsData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: isSuperadmin,
    refetchInterval: 5000,
  });

  const incomingSmsUnreadCount = incomingSmsData?.unreadCount ?? 0;

  useEffect(() => {
    const cached = localStorage.getItem('company_logo');
    if (cached) {
      setCachedLogo(cached);
    }
  }, []);

  useEffect(() => {
    if (companyData?.company?.logo) {
      localStorage.setItem('company_logo', companyData.company.logo);
      setCachedLogo(companyData.company.logo);
    } else if (companyData && !companyData.company?.logo) {
      localStorage.removeItem('company_logo');
      setCachedLogo(null);
    }
  }, [companyData]);

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location, isMobile, setOpenMobile]);

  const handleLogout = async () => {
    try {
      const { currentCall } = useWebPhoneStore.getState();
      if (currentCall) {
        await webPhone.hangupCall();
      }
      
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        queryClient.clear();
        localStorage.removeItem('company_logo');
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getDisplayLogo = () => {
    if (companyDataLoaded) {
      return companyData?.company?.logo || logo;
    }
    return cachedLogo || logo;
  };
  
  const displayLogo = getDisplayLogo();

  const renderMenuItem = (item: any, showBadge: boolean = false, badgeCount: number = 0) => {
    const isActive = location === item.url;
    const Icon = item.icon;
    
    return (
      <SidebarMenuItem key={item.title}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              className={`
                h-10 w-10 p-0 rounded-xl transition-all duration-200 flex items-center justify-center mx-auto relative
                ${isActive 
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <Link 
                href={item.url} 
                className="flex items-center justify-center w-full h-full"
                onMouseEnter={() => handlePrefetch(item.url)}
                onFocus={() => handlePrefetch(item.url)}
                onTouchStart={() => handlePrefetch(item.url)}
                onClick={() => handlePrefetch(item.url)}
              >
                <Icon className="h-5 w-5" />
                {item.badge === "whatsapp" && <WhatsAppUnreadBadge />}
                {item.badge === "imessage" && <ImessageUnreadBadge />}
                {item.badge === "sms" && <SmsUnreadBadge count={unreadThreadCount} />}
                {showBadge && badgeCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  </div>
                )}
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar className="border-r-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl">
        <SidebarHeader className="h-16 flex items-center justify-center border-b border-gray-200/50 dark:border-gray-700/50">
          <Link href="/" className="flex items-center justify-center w-10 h-10">
            {displayLogo ? (
              <img 
                src={displayLogo} 
                alt={companyData?.company?.logo ? "Company Logo" : "Curbe.io"} 
                className="max-w-8 max-h-8 object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutDashboard className="h-4 w-4 text-primary" />
              </div>
            )}
          </Link>
        </SidebarHeader>

        <SidebarContent className="py-4 px-2">
          {isSuperadmin ? (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-2 flex flex-col items-center">
                  {superadminMenuItems.map((item) => 
                    renderMenuItem(
                      item, 
                      item.title === "Incoming SMS",
                      item.title === "Incoming SMS" ? incomingSmsUnreadCount : 0
                    )
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-2 flex flex-col items-center">
                    {regularUserMenuItems.map((item) => renderMenuItem(item))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <div className="my-3 mx-2 h-px bg-gray-200/60 dark:bg-gray-700/60" />

              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-2 flex flex-col items-center">
                    {communicationsMenuItems
                      .filter((item) => !item.featureKey || enabledFeatures.has(item.featureKey))
                      .map((item) => renderMenuItem(item))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <div className="my-3 mx-2 h-px bg-gray-200/60 dark:bg-gray-700/60" />

              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-2 flex flex-col items-center">
                    {marketingMenuItems.map((item) => renderMenuItem(item))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <div className="my-3 mx-2 h-px bg-gray-200/60 dark:bg-gray-700/60" />

              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-2 flex flex-col items-center">
                    {configurationMenuItems.map((item) => renderMenuItem(item))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="p-2 border-t border-gray-200/50 dark:border-gray-700/50">
          <SidebarMenu className="flex flex-col items-center">
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={handleLogout}
                    className="h-10 w-10 p-0 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 flex items-center justify-center mx-auto"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Sign Out
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
