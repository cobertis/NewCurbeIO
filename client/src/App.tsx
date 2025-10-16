import { useState, useCallback } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bell, User as UserIcon, Settings as SettingsIcon, LogOut, Search, Plus, BarChart3, ChevronDown, MessageSquare, Sun } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import type { User } from "@shared/schema";
import Login from "@/pages/login";
import VerifyOTP from "@/pages/verify-otp";
import ActivateAccount from "@/pages/activate-account";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Companies from "@/pages/companies";
import Plans from "@/pages/plans";
import Features from "@/pages/features";
import Invoices from "@/pages/invoices";
import Settings from "@/pages/settings";
import AuditLogs from "@/pages/audit-logs";
import Support from "@/pages/support";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import CampaignStats from "@/pages/campaign-stats";
import SmsCampaignStats from "@/pages/sms-campaign-stats";
import IncomingSms from "@/pages/incoming-sms";
import Unsubscribe from "@/pages/unsubscribe";
import NotFound from "@/pages/not-found";

// Helper function to get page title from route
const getPageTitle = (path: string): string => {
  const routes: Record<string, string> = {
    '/': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/analytics': 'Analytics',
    '/users': 'Users',
    '/companies': 'Companies',
    '/plans': 'Plans',
    '/features': 'Features',
    '/invoices': 'Invoices',
    '/settings': 'Settings',
    '/audit-logs': 'Audit Logs',
    '/support': 'Support',
    '/contacts': 'Email Contacts',
    '/campaigns': 'Campaigns',
    '/incoming-sms': 'Incoming SMS',
  };
  
  if (path.startsWith('/campaigns/') && path.includes('/stats')) {
    return 'Campaign Statistics';
  }
  
  if (path.startsWith('/sms-campaigns/') && path.includes('/stats')) {
    return 'SMS Campaign Statistics';
  }
  
  return routes[path] || 'Dashboard';
};

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: notificationsData, isLoading: isLoadingNotifications, isError: isErrorNotifications } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/notifications"],
  });

  const user = userData?.user;

  // Fetch company data for non-superadmin users
  const { data: companyData } = useQuery<{ company: any }>({
    queryKey: ["/api/companies", user?.companyId],
    enabled: !!user?.companyId && user?.role !== "superadmin",
  });

  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const userName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email || "User";
  
  // Show company name for non-superadmin users, role for superadmin
  const userSubtitle = user?.role === "superadmin" 
    ? "Super Admin" 
    : companyData?.company?.name || "Loading...";
  
  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  // WebSocket listener for real-time notification updates
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'conversation_update') {
      // When a new SMS arrives, invalidate notifications to show the new notification
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "PATCH",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };
  const pageTitle = getPageTitle(location);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        queryClient.clear();
        setLocation("/");
        toast({
          title: "Logged out",
          description: "You have been logged out successfully.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Logout failed",
          description: "Unable to logout. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout. Please try again.",
      });
    }
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 sticky top-0 z-10">
            {/* Left: Sidebar Toggle + Page Title */}
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="hover-elevate active-elevate-2 rounded-md" />
              <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-xl mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search for anything here..."
                  className="pl-9 bg-muted/50 border-muted-foreground/20"
                  data-testid="input-global-search"
                />
              </div>
            </div>

            {/* Right: Action Icons + User Profile */}
            <div className="flex items-center gap-2">
              {/* Messages Icon */}
              <Button 
                variant="ghost" 
                size="icon"
                data-testid="button-messages"
                className="rounded-md"
              >
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </Button>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Notifications Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setNotificationsOpen(true)}
                data-testid="button-notifications" 
                className="rounded-md relative"
              >
                <Bell className="h-6 w-6 text-blue-500" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center notification-badge">
                    <span className="text-white text-xs font-semibold">!</span>
                  </div>
                )}
              </Button>

              {/* User Profile with Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-3 px-3 h-10 hover-elevate rounded-md" 
                    data-testid="button-user-menu"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar || undefined} alt={userName} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium leading-none">{userName}</span>
                      <span className="text-xs text-muted-foreground leading-none mt-0.5">{userSubtitle}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => user && setLocation(`/users/${user.id}`)} data-testid="menu-item-profile">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-settings">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>

      {/* Notifications Sidebar */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-96">
          <SheetHeader className="flex flex-row items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                data-testid="button-mark-all-read"
              >
                Mark all as read
              </Button>
            )}
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {isLoadingNotifications ? (
              <div className="py-6 text-center text-sm text-muted-foreground" data-testid="notifications-loading">
                Loading notifications...
              </div>
            ) : isErrorNotifications ? (
              <div className="py-6 text-center text-sm text-destructive" data-testid="notifications-error">
                Failed to load notifications
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground" data-testid="notifications-empty">
                No notifications
              </div>
            ) : (
              notifications.map((notification: any) => (
                <div 
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) {
                      markAsRead(notification.id);
                    }
                    if (notification.link) {
                      setLocation(notification.link);
                      setNotificationsOpen(false);
                    }
                  }}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="font-medium text-sm mb-1">{notification.title}</div>
                  <div className="text-sm text-muted-foreground">{notification.message}</div>
                  {!notification.isRead && (
                    <div className="mt-2">
                      <Badge variant="destructive" className="text-xs">New</Badge>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <ProtectedRoute fallbackPath="/login">
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/login" component={Login} />
      <Route path="/verify-otp" component={VerifyOTP} />
      <Route path="/activate-account" component={ActivateAccount} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute>
          <DashboardLayout>
            <Analytics />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute>
          <DashboardLayout>
            <Users />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/users/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <Users />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/companies">
        <ProtectedRoute>
          <DashboardLayout>
            <Companies />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/plans">
        <ProtectedRoute>
          <DashboardLayout>
            <Plans />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/features">
        <ProtectedRoute>
          <DashboardLayout>
            <Features />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/invoices">
        <ProtectedRoute>
          <DashboardLayout>
            <Invoices />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/audit-logs">
        <ProtectedRoute>
          <DashboardLayout>
            <AuditLogs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/support">
        <ProtectedRoute>
          <DashboardLayout>
            <Support />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/contacts">
        <ProtectedRoute>
          <DashboardLayout>
            <Contacts />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/campaigns">
        <ProtectedRoute>
          <DashboardLayout>
            <Campaigns />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/campaigns/:id/stats">
        <ProtectedRoute>
          <DashboardLayout>
            <CampaignStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/sms-campaigns/:id/stats">
        <ProtectedRoute>
          <DashboardLayout>
            <SmsCampaignStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/incoming-sms">
        <ProtectedRoute>
          <DashboardLayout>
            <IncomingSms />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/unsubscribe" component={Unsubscribe} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
