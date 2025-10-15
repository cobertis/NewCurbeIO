import { LayoutDashboard, BarChart3, Users, Building2, CreditCard, Package, Receipt, Settings, FileText, HelpCircle, LogOut, Send } from "lucide-react";
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
    title: "Audit Logs",
    url: "/audit-logs",
    icon: FileText,
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
];

export function AppSidebar() {
  const [location] = useLocation();
  
  const { data: userData } = useQuery<{ user: User & { companyName?: string } }>({
    queryKey: ["/api/session"],
  });

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

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    return true;
  });

  return (
    <Sidebar className="border-r border-border bg-background">
      <SidebarHeader className="px-6 py-3 pb-2">
        <Link href="/dashboard" className="flex items-center justify-center">
          <img 
            src={logo} 
            alt="Curbe.io" 
            className="h-10 w-auto object-contain"
          />
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
                    <Link href={item.url} className="flex items-center gap-3 px-3">
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span>{item.title}</span>
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
