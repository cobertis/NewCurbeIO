import { useState } from "react";
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
import { Bell, User as UserIcon, Settings as SettingsIcon, LogOut, Search, Plus, BarChart3, ChevronDown, Camera } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UploadAvatarDialog } from "@/components/upload-avatar-dialog";
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
  };
  return routes[path] || 'Dashboard';
};

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [uploadAvatarOpen, setUploadAvatarOpen] = useState(false);

  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: notificationsData, isLoading: isLoadingNotifications, isError: isErrorNotifications } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/notifications"],
  });

  const user = userData?.user;
  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";
  const userName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email || "User";
  const userRole = user?.role === "superadmin" ? "Super Admin" : 
                   user?.role === "admin" ? "Admin" : 
                   user?.role === "member" ? "Member" : "Viewer";
  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;
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
              {/* Quick Action Button */}
              <Button size="icon" className="rounded-full bg-primary hover:bg-primary/90" data-testid="button-quick-action">
                <Plus className="h-5 w-5" />
              </Button>

              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-notifications" className="rounded-md relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
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
                    notifications.slice(0, 5).map((notification: any) => (
                      <DropdownMenuItem 
                        key={notification.id} 
                        className="flex flex-col items-start py-3"
                        data-testid={`notification-item-${notification.id}`}
                      >
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-sm text-muted-foreground">{notification.message}</div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Analytics Icon */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/analytics")}
                data-testid="button-analytics"
                className="rounded-md"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>

              {/* Settings Icon */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/settings")}
                data-testid="button-settings"
                className="rounded-md"
              >
                <SettingsIcon className="h-5 w-5" />
              </Button>

              {/* Theme Toggle */}
              <ThemeToggle />

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
                      <span className="text-xs text-muted-foreground leading-none mt-0.5">{userRole}</span>
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
                  <DropdownMenuItem onClick={() => setUploadAvatarOpen(true)} data-testid="menu-item-upload-photo">
                    <Camera className="mr-2 h-4 w-4" />
                    <span>Upload Photo</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-settings">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-preferences">
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
      
      {/* Upload Avatar Dialog */}
      <UploadAvatarDialog
        open={uploadAvatarOpen}
        onOpenChange={setUploadAvatarOpen}
        currentAvatar={user?.avatar || undefined}
        userInitial={userInitial}
      />
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
