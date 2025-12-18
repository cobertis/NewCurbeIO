import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  companyId: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  companyId: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isSuccess } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
    staleTime: 30000,
    retry: false,
  });

  const value: AuthContextType = {
    user: data?.user ?? null,
    isAuthenticated: isSuccess && !!data?.user?.id,
    isLoading,
    companyId: data?.user?.companyId ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
