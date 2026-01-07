import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";
import { EmailTemplatesManager } from "@/components/email-templates-manager";
import { LoadingSpinner } from "@/components/loading-spinner";

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
    return <LoadingSpinner message="Loading email configuration..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Email Configuration</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-page-description">
          Manage email templates for automated communications
        </p>
      </div>

      <EmailTemplatesManager />
    </div>
  );
}
