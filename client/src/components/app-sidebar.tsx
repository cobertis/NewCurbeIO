import { useState, useEffect } from "react";
import { LayoutDashboard, ClipboardList, LogOut } from "lucide-react";
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
    title: "Quotes",
    url: "/quotes",
    icon: ClipboardList,
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
