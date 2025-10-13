import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/session", {
          credentials: "include",
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setLocation("/");
        }
      } catch (error) {
        setLocation("/");
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [setLocation]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
