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
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { User, BulkvsThread } from "@shared/schema";
import logo from "@assets/logo no fondo_1760450756816.png";

// Menu items for superadmin (COMPLETE LIST)
const superadminMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
  {
    title: "Companies",
    url: "/companies",
    icon: Building2,
  },
  {
    title: "Plans",
    url: "/plans",
    icon: CreditCard,
  },
  {
    title: "Features",
    url: "/features",
    icon: Package,
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
  {
    title: "Audit Logs",
    url: "/audit-logs",
    icon: Shield,
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: Ticket,
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Megaphone,
  },
  {
    title: "Incoming SMS",
    url: "/incoming-sms",
    icon: MessageSquare,
  },
  {
    title: "System Alerts",
    url: "/system-alerts",
    icon: AlertTriangle,
  },
  {
    title: "Email Config",
    url: "/email-configuration",
    icon: AtSign,
  },
  {
    title: "Birthday Images",
    url: "/birthday-images",
    icon: ImagePlus,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

// Menu items for regular users (admin, agent, etc.)
const regularUserMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
  },
];

const myAgencyMenuItems = [
  {
    title: "Policies",
    url: "/policies",
    icon: FileCheck,
  },
  {
    title: "Quotes",
    url: "/quotes",
    icon: ClipboardList,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: Contact,
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: CheckSquare,
  },
];

const marketingMenuItems = [
  {
    title: "SMS",
    url: "/sms",
    icon: MessageSquare,
  },
  {
    title: "iMessage",
    url: "/imessage",
    icon: MessageCircle,
    featureKey: "iMessage",
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Mail,
  },
  {
    title: "Referrals",
    url: "/referrals",
    icon: UserPlus,
  },
  {
    title: "Landing page",
    url: "/landing-page",
    icon: Globe,
  },
  {
    title: "Email",
    url: "/email-marketing",
    icon: Inbox,
  },
];

const configurationMenuItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const { isMobile, setOpenMobile } = useSidebar();
  
  const { data: userData } = useQuery<{ user: User & { companyName?: string } }>({
    queryKey: ["/api/session"],
  });

  // Prefetch route data on hover/focus/touch/click
  const handlePrefetch = (url: string) => {
    const queries = getRoleAwareQueries(url, userData?.user?.role);
    queries.forEach((queryDescriptor) => {
      queryClient.prefetchQuery({
        queryKey: queryDescriptor.queryKey,
        staleTime: queryDescriptor.staleTime,
      });
    });
  };

  // Get company data to access the logo
  const { data: companyData, isSuccess: companyDataLoaded } = useQuery<{ company: { logo?: string } }>({
    ...getCompanyQueryOptions(userData?.user?.companyId),
  });

  // Get company features for feature gating
  const { data: featuresData } = useQuery<{ features: Array<{ key: string }> }>({
    queryKey: ["/api/companies", userData?.user?.companyId, "features"],
    enabled: !!userData?.user?.companyId,
  });

  const enabledFeatures = new Set(featuresData?.features?.map(f => f.key) || []);

  // Get BulkVS threads to count unread messages
  const { data: threadsData } = useQuery<BulkvsThread[]>({
    queryKey: ["/api/bulkvs/threads"],
    enabled: !!userData?.user,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Determine which menu to show based on user role
  const isSuperadmin = userData?.user?.role === "superadmin";

  // Count conversations with unread messages (not total messages)
  const unreadThreadCount = (threadsData?.filter(thread => thread.unreadCount > 0) ?? []).length;

  // Fetch unread Incoming SMS count (Twilio)
  const { data: incomingSmsData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: isSuperadmin,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const incomingSmsUnreadCount = incomingSmsData?.unreadCount ?? 0;
  
  // For superadmin and regular users
  const menuItems = isSuperadmin ? superadminMenuItems : regularUserMenuItems;

  // Load cached logo from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('company_logo');
    if (cached) {
      setCachedLogo(cached);
    }
  }, []);

  // Update cache when company data changes
  useEffect(() => {
    if (companyData?.company?.logo) {
      localStorage.setItem('company_logo', companyData.company.logo);
      setCachedLogo(companyData.company.logo);
    } else if (companyData && !companyData.company?.logo) {
      // Company loaded but no logo - clear cache
      localStorage.removeItem('company_logo');
      setCachedLogo(null);
    }
  }, [companyData]);

  // Close mobile sidebar when location changes
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location, isMobile, setOpenMobile]);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        // Clear all query cache
        queryClient.clear();
        // Clear company logo cache
        localStorage.removeItem('company_logo');
        // Redirect to login
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Determine which logo to display
  const getDisplayLogo = () => {
    // If company data has loaded successfully
    if (companyDataLoaded) {
      // Use company logo if exists, otherwise default Curbe logo
      return companyData?.company?.logo || logo;
    }
    // Company data still loading - use cached logo if available, otherwise default
    return cachedLogo || logo;
  };
  
  const displayLogo = getDisplayLogo();

  return (
    <Sidebar className="border-r border-border bg-background">
      <SidebarHeader className="px-6 h-16 flex items-center justify-center">
        <Link href="/" className="flex items-center justify-center w-full h-12">
          {displayLogo ? (
            <img 
              src={displayLogo} 
              alt={companyData?.company?.logo ? "Company Logo" : "Curbe.io"} 
              className="max-w-full max-h-12 object-contain"
            />
          ) : (
            <div className="w-full h-12" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-2 pb-4">
        {/* Superadmin Menu - Single list without separators */}
        {isSuperadmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase()}`}
                      className={`
                        h-11 rounded-md transition-colors
                        ${location === item.url 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        }
                      `}
                    >
                      <Link 
                        href={item.url} 
                        className="flex items-center gap-3 px-3 w-full"
                        onMouseEnter={() => handlePrefetch(item.url)}
                        onFocus={() => handlePrefetch(item.url)}
                        onTouchStart={() => handlePrefetch(item.url)}
                        onClick={() => handlePrefetch(item.url)}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {item.title === "Incoming SMS" && incomingSmsUnreadCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="ml-auto h-5 min-w-5 px-1 text-xs font-semibold rounded-full flex items-center justify-center"
                            data-testid="badge-incoming-sms-unread"
                          >
                            {incomingSmsUnreadCount > 99 ? "99+" : incomingSmsUnreadCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* For regular users: Dashboard, Calendar, My Agency, Marketing, Configuration */}
        {!isSuperadmin && (
          <>
            {/* Dashboard and Calendar */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`link-${item.title.toLowerCase()}`}
                        className={`
                          h-11 rounded-md transition-colors
                          ${location === item.url 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }
                        `}
                      >
                        <Link 
                          href={item.url} 
                          className="flex items-center gap-3 px-3 w-full"
                          onMouseEnter={() => handlePrefetch(item.url)}
                          onFocus={() => handlePrefetch(item.url)}
                          onTouchStart={() => handlePrefetch(item.url)}
                          onClick={() => handlePrefetch(item.url)}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* My Agency Section */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                My Agency
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {myAgencyMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`link-${item.title.toLowerCase()}`}
                        className={`
                          h-11 rounded-md transition-colors
                          ${location === item.url 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }
                        `}
                      >
                        <Link 
                          href={item.url} 
                          className="flex items-center gap-3 px-3 w-full"
                          onMouseEnter={() => handlePrefetch(item.url)}
                          onFocus={() => handlePrefetch(item.url)}
                          onTouchStart={() => handlePrefetch(item.url)}
                          onClick={() => handlePrefetch(item.url)}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 whitespace-nowrap overflow-visible">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Marketing Section */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Marketing
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {marketingMenuItems
                    .filter((item: any) => !item.featureKey || enabledFeatures.has(item.featureKey))
                    .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`link-${item.title.toLowerCase()}`}
                        className={`
                          h-11 rounded-md transition-colors
                          ${location === item.url 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }
                        `}
                      >
                        <Link 
                          href={item.url} 
                          className="flex items-center gap-3 px-3 w-full"
                          onMouseEnter={() => handlePrefetch(item.url)}
                          onFocus={() => handlePrefetch(item.url)}
                          onTouchStart={() => handlePrefetch(item.url)}
                          onClick={() => handlePrefetch(item.url)}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1">{item.title}</span>
                          {item.title === "SMS" && unreadThreadCount > 0 && (
                            <Badge 
                              variant="destructive" 
                              className="ml-auto h-5 min-w-5 px-1 text-xs font-semibold rounded-full flex items-center justify-center"
                              data-testid="badge-unread-count"
                            >
                              {unreadThreadCount > 99 ? "99+" : unreadThreadCount}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Configuration Section */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Configuration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {configurationMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`link-${item.title.toLowerCase()}`}
                        className={`
                          h-11 rounded-md transition-colors
                          ${location === item.url 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }
                        `}
                      >
                        <Link 
                          href={item.url} 
                          className="flex items-center gap-3 px-3 w-full"
                          onMouseEnter={() => handlePrefetch(item.url)}
                          onFocus={() => handlePrefetch(item.url)}
                          onTouchStart={() => handlePrefetch(item.url)}
                          onClick={() => handlePrefetch(item.url)}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
