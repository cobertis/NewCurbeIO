import { useEffect, useState } from "react";
import { useLocation as useWouterLocation } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export function ProtectedRoute({ children, fallbackPath = "/login" }: ProtectedRouteProps) {
  const [location, setLocation] = useWouterLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/session", {
          credentials: "include",
        });

        // Handle trial expiration (HTTP 402)
        if (response.status === 402) {
          const data = await response.json();
          if (data.trialExpired && location !== "/select-plan") {
            console.log("[TRIAL-EXPIRED] Trial has expired, redirecting to plan selection");
            setLocation("/select-plan");
            return;
          }
        }

        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          
          // Check if user needs to complete onboarding
          // Skip this check if we're on allowed pages during onboarding
          const allowedDuringOnboarding = ["/getting-started", "/onboarding", "/settings"];
          const isAllowedPage = allowedDuringOnboarding.some(page => location === page || location.startsWith(page + "/"));
          if (data.user && !data.user.onboardingCompleted && !isAllowedPage) {
            console.log("[ONBOARDING] User has not completed onboarding, redirecting to getting-started");
            setLocation("/getting-started");
            return;
          }
        } else {
          setLocation(fallbackPath);
        }
      } catch (error) {
        setLocation(fallbackPath);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [location, setLocation, fallbackPath]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
