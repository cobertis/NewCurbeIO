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

        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(true);
          
          // Check if user needs to select a plan (non-superadmin without active subscription)
          if (data.user && data.user.role !== "superadmin" && location !== "/select-plan") {
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
              
              // Redirect only if no subscription or if subscription is cancelled/canceled
              // Valid statuses that should NOT redirect: trialing, active, incomplete, past_due, unpaid
              const invalidStatuses = ['cancelled', 'canceled'];
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
  }, [setLocation, fallbackPath, location]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
