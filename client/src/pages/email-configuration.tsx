import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@shared/schema";
import { EmailTemplatesManager } from "@/components/email-templates-manager";

export default function EmailConfiguration() {
  const [, setLocation] = useLocation();

  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = userData?.user;
  const isSuperAdmin = user?.role === "superadmin";

  // Redirect non-superadmins to dashboard
  useEffect(() => {
    if (!isLoadingUser && !isSuperAdmin) {
      setLocation("/dashboard");
    }
  }, [isLoadingUser, isSuperAdmin, setLocation]);

  if (isLoadingUser) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Email Configuration</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-page-description">
          Manage email templates for automated communications
        </p>
      </div>

      <EmailTemplatesManager />
    </div>
  );
}
