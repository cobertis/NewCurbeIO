import { useEffect } from "react";
import { 
  LogOut,
  ChevronLeft,
  MessageCircle,
  MessageSquare,
  Mail,
  Megaphone,
  Users,
  Gift,
  Layout,
  Settings
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

const sidebarItems = [
  { title: "WhatsApp", icon: MessageCircle, url: "/whatsapp" },
  { title: "SMS", icon: MessageSquare, url: "/sms" },
  { title: "Email", icon: Mail, url: "/email" },
  { title: "Campaigns", icon: Megaphone, url: "/campaigns" },
  { title: "Contacts", icon: Users, url: "/contacts" },
  { title: "Referrals", icon: Gift, url: "/referrals" },
  { title: "Landing Pages", icon: Layout, url: "/landing-pages" },
  { title: "Settings", icon: Settings, url: "/settings" },
];

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

  const circularButtonClass = (isActive: boolean) => 
    `h-10 w-10 rounded-full backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all duration-200 ${
      isActive 
        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" 
        : "bg-white/90 dark:bg-gray-800/70 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    }`;

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
                        className="h-10 w-10 rounded-full bg-white/90 dark:bg-gray-800/70 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all duration-200"
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

                {/* Navigation Icons */}
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={item.url}>
                            <button
                              data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}
                              className={circularButtonClass(isActive)}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </button>
                          </Link>
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

        <SidebarFooter className="p-2 pb-6">
          <SidebarMenu className="flex flex-col items-center">
            <SidebarMenuItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="h-10 w-10 rounded-full bg-white/90 dark:bg-gray-800/70 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center text-gray-500 hover:text-red-500 transition-all duration-200"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
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
