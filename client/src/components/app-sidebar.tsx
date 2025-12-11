import { useEffect } from "react";
import { 
  ChevronLeft,
  Share2,
  Star,
  Plus,
  ClipboardList,
  Clock,
  Settings,
  LogOut,
  Wallet,
  ArrowUpCircle,
  Loader2
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
import { Button } from "@/components/ui/button";
import type { User } from "@shared/schema";
import { useWebPhoneStore, webPhone } from "@/services/webphone";

interface WalletBalance {
  balance: string;
  currency: string;
  autoRecharge?: boolean;
}

// Wallet Balance Widget Component
function WalletBalanceWidget({ setLocation }: { setLocation: (path: string) => void }) {
  const { data: walletData, isLoading } = useQuery<WalletBalance>({
    queryKey: ["/api/wallet/balance"],
    staleTime: 30000, // 30 seconds cache
    refetchInterval: 60000, // Refetch every minute
  });

  const formatBalance = (balance: string | undefined) => {
    if (!balance) return "$0.00";
    const num = parseFloat(balance);
    return `$${num.toFixed(2)}`;
  };

  const balance = walletData?.balance;
  const formattedBalance = formatBalance(balance);
  const isLowBalance = balance ? parseFloat(balance) < 10 : false;

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setLocation("/billing")}
            data-testid="widget-wallet-balance"
            className="relative h-10 w-10 rounded-full bg-white/90 dark:bg-gray-800/70 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="h-[18px] w-[18px] text-gray-500 dark:text-gray-400 animate-spin" data-testid="wallet-loading" />
            ) : (
              <Wallet 
                className={`h-[18px] w-[18px] ${isLowBalance ? 'text-amber-500' : 'text-emerald-500'}`} 
              />
            )}
            {!isLoading && isLowBalance && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-amber-500 rounded-full border border-white dark:border-gray-800" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="p-0 w-48">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Wallet Balance</span>
              {isLowBalance && (
                <span className="text-[10px] text-amber-500 font-medium">Low Balance</span>
              )}
            </div>
            <p 
              className={`text-lg font-semibold ${isLowBalance ? 'text-amber-500' : 'text-foreground'}`}
              data-testid="text-wallet-balance"
            >
              {isLoading ? "Loading..." : formattedBalance}
            </p>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setLocation("/billing");
              }}
              data-testid="button-topup-wallet"
            >
              <ArrowUpCircle className="h-3 w-3 mr-1" />
              Top Up
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

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
            {/* Wallet Balance Widget */}
            {userData?.user && (
              <WalletBalanceWidget setLocation={setLocation} />
            )}

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
