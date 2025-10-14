import { Switch, Route } from "wouter";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Companies from "@/pages/companies";
import Plans from "@/pages/plans";
import Invoices from "@/pages/invoices";
import Settings from "@/pages/settings";
import Support from "@/pages/support";
import NotFound from "@/pages/not-found";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = userData?.user;
  const userInitial = user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 border-b border-border bg-background flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="hover-elevate active-elevate-2 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" data-testid="button-notifications" className="rounded-md">
                <Bell className="h-5 w-5" />
              </Button>
              <ThemeToggle />
              <Avatar className="ml-2 h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
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
