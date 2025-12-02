import { useState, useEffect } from "react";
import { 
  LogOut,
  Share2,
  Upload,
  Star,
  Plus,
  Download
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { User } from "@shared/schema";
import { useWebPhoneStore, webPhone } from "@/services/webphone";

const utilityItems = [
  { title: "Share", icon: Share2, action: "share" },
  { title: "Upload", icon: Upload, action: "upload" },
  { title: "Favorites", icon: Star, action: "favorites" },
  { title: "Add New", icon: Plus, action: "add" },
  { title: "Download", icon: Download, action: "download" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  
  const { data: userData } = useQuery<{ user: User & { companyName?: string } }>({
    queryKey: ["/api/session"],
  });

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

  const handleUtilityAction = (action: string) => {
    console.log(`Utility action: ${action}`);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar className="w-16 min-w-16 max-w-16 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <SidebarContent className="py-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 flex flex-col items-center">
                {utilityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            onClick={() => handleUtilityAction(item.action)}
                            data-testid={`utility-${item.action}`}
                            className="h-10 w-10 p-0 rounded-lg transition-all duration-200 flex items-center justify-center mx-auto text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                          >
                            <Icon className="h-5 w-5" />
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-2 border-t border-gray-200 dark:border-gray-700">
          <SidebarMenu className="flex flex-col items-center">
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={handleLogout}
                    className="h-10 w-10 p-0 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 flex items-center justify-center mx-auto"
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
