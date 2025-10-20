import { useState, useEffect } from "react";
import { LayoutDashboard, BarChart3, Users, Building2, CreditCard, Package, Receipt, Settings, FileText, HelpCircle, LogOut, Send, MessageSquare, Bell, Ticket, Mail } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@shared/schema";
import logo from "@assets/logo no fondo_1760450756816.png";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Companies",
    url: "/companies",
    icon: Building2,
    superAdminOnly: true,
  },
  {
    title: "Users",
    url: "/users",
    icon: Users,
  },
  {
    title: "Plans",
    url: "/plans",
    icon: CreditCard,
    superAdminOnly: true,
  },
  {
    title: "Features",
    url: "/features",
    icon: Package,
    superAdminOnly: true,
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: Receipt,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Email Settings",
    url: "/email-configuration",
    icon: Mail,
    superAdminOnly: true,
  },
  {
    title: "Audit Logs",
    url: "/audit-logs",
    icon: FileText,
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: Ticket,
    superAdminOnly: true,
  },
  {
    title: "Support",
    url: "/support",
    icon: HelpCircle,
  },
  {
    title: "Campaigns",
    url: "/campaigns",
    icon: Send,
    superAdminOnly: true,
  },
  {
    title: "Incoming SMS",
    url: "/incoming-sms",
    icon: MessageSquare,
    superAdminOnly: true,
  },
  {
    title: "System Alerts",
    url: "/system-alerts",
    icon: Bell,
    superAdminOnly: true,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  
  const { data: userData } = useQuery<{ user: User & { companyName?: string } }>({
    queryKey: ["/api/session"],
  });

  // Get company data to access the logo
  const { data: companyData, isSuccess: companyDataLoaded } = useQuery<{ company: { logo?: string } }>({
    queryKey: ["/api/companies", userData?.user?.companyId],
    enabled: !!userData?.user?.companyId,
  });

  // Get unread SMS count for badge
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/chat/unread-count"],
    enabled: userData?.user?.role === "superadmin",
  });

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

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const user = userData?.user;
  const isSuperAdmin = user?.role === "superadmin";
  const unreadCount = unreadData?.unreadCount || 0;
  
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

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    return true;
  });

  return (
    <Sidebar className="border-r border-border bg-background">
      <SidebarHeader className="px-6">
        <Link href="/" className="flex items-center justify-center h-full py-2">
          {displayLogo ? (
            <img 
              src={displayLogo} 
              alt={companyData?.company?.logo ? "Company Logo" : "Curbe.io"} 
              className="w-full h-full object-contain max-h-12"
            />
          ) : (
            <div className="w-full h-12" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-2 pb-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {visibleMenuItems.map((item) => (
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
                    <Link href={item.url} className="flex items-center gap-3 px-3 w-full">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      {item.url === "/incoming-sms" && unreadCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 min-w-5 px-1.5 text-xs font-semibold"
                          data-testid="badge-unread-sms"
                        >
                          {unreadCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
