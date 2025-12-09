import { useEffect } from "react";
import { 
  ChevronLeft,
  Share2,
  Star,
  Plus,
  ClipboardList,
  Clock,
  Settings,
  LogOut
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
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

export function AppSidebar() {
  const [location, setLocation] = useLocation();
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

  const circularButtonClass = "h-10 w-10 rounded-full bg-white/90 dark:bg-gray-800/70 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all duration-200";

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar className="w-16 min-w-16 max-w-16 border-0 bg-transparent">
        <SidebarContent className="py-4">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-2 flex flex-col items-center">
                {/* Back Button - Always First */}
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => window.history.back()}
                        data-testid="button-back"
                        className={circularButtonClass}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      Go Back
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                {/* Separator */}
                <div className="w-8 h-px bg-gray-300/50 dark:bg-gray-600/50 my-2" />

                {/* Utility Icons */}
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        data-testid="button-share"
                        className={circularButtonClass}
                      >
                        <Share2 className="h-[18px] w-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      Share
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        data-testid="button-favorite"
                        className={circularButtonClass}
                      >
                        <Star className="h-[18px] w-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      Favorite
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        data-testid="button-add"
                        className={circularButtonClass}
                      >
                        <Plus className="h-[18px] w-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      Add New
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        data-testid="button-clipboard"
                        className={circularButtonClass}
                      >
                        <ClipboardList className="h-[18px] w-[18px]" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      Clipboard
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-2 pb-6">
          <SidebarMenu className="space-y-2 flex flex-col items-center">
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-testid="button-history"
                    className={circularButtonClass}
                  >
                    <Clock className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  History
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLocation("/settings")}
                    data-testid="button-settings"
                    className={circularButtonClass}
                  >
                    <Settings className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Settings
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
