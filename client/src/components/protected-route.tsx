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
          // Skip this check if we're already on the getting-started or onboarding page
          if (data.user && !data.user.onboardingCompleted && location !== "/getting-started" && location !== "/onboarding") {
            console.log("[ONBOARDING] User has not completed onboarding, redirecting to getting-started");
            setLocation("/getting-started");
            return;
          }
          
          // Check if user needs to select a plan
          // Only ADMINS need to have a subscription - agents are covered by admin's plan
          // Superadmins bypass this check entirely
          if (data.user && data.user.role === "admin" && location !== "/select-plan") {
            // Check if user's company has an active subscription
            try {
              const subscriptionResponse = await fetch("/api/billing/subscription", {
                credentials: "include",
              });
              
              // If response is not OK (404, 500, etc), redirect to plan selection
              if (!subscriptionResponse.ok) {
                setLocation("/select-plan");
                return;
              }
              
              const subscriptionData = await subscriptionResponse.json();
              const subscription = subscriptionData?.subscription;
              
              // Redirect if no subscription, cancelled, or past_due (trial expired)
              const invalidStatuses = ['cancelled', 'canceled', 'past_due'];
              if (!subscription || invalidStatuses.includes(subscription.status)) {
                setLocation("/select-plan");
                return;
              }
            } catch (error) {
              // On any error fetching subscription, redirect to plan selection to be safe
              console.error("Failed to check subscription:", error);
              setLocation("/select-plan");
              return;
            }
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
  }, [setLocation, fallbackPath]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
