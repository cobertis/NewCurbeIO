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
  FileCheck
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import type { User } from "@shared/schema";
import logo from "@assets/logo no fondo_1760450756816.png";

// Menu items for superadmin (COMPLETE LIST)
const superadminMenuItems = [
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
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
  },
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
    title: "Settings",
    url: "/settings",
    icon: Settings,
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
    title: "Support",
    url: "/support",
    icon: LifeBuoy,
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Mail,
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
];

export function AppSidebar() {
  const [location] = useLocation();
  const [cachedLogo, setCachedLogo] = useState<string | null>(null);
  const { isMobile, setOpenMobile } = useSidebar();
  
  const { data: userData } = useQuery<{ user: User & { companyName?: string } }>({
    queryKey: ["/api/session"],
  });

  // Get company data to access the logo
  const { data: companyData, isSuccess: companyDataLoaded } = useQuery<{ company: { logo?: string } }>({
    queryKey: ["/api/companies", userData?.user?.companyId],
    enabled: !!userData?.user?.companyId,
  });

  // Determine which menu to show based on user role
  const menuItems = userData?.user?.role === "superadmin" 
    ? superadminMenuItems 
    : regularUserMenuItems;

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
                    <Link href={item.url} className="flex items-center gap-3 px-3 w-full">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{item.title}</span>
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
