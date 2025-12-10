import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { boot, shutdown, update, fetchIntercomJwt, type IntercomUserData } from '@/lib/intercom';
import type { User } from '@shared/schema';

interface IntercomConfig {
  app_id: string;
  enabled: boolean;
}

interface JwtResponse {
  jwt: string | null;
}

interface IntercomProviderProps {
  children: React.ReactNode;
}

export function IntercomProvider({ children }: IntercomProviderProps) {
  const [location] = useLocation();
  const previousLocation = useRef<string>('');
  const isBooted = useRef<boolean>(false);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ['/api/session'],
    staleTime: 0,
    refetchOnMount: true,
  });

  const user = sessionData?.user;

  const { data: intercomConfig } = useQuery<IntercomConfig>({
    queryKey: ['/api/system/intercom-config'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: jwtData } = useQuery<JwtResponse>({
    queryKey: ['/api/intercom/jwt'],
    enabled: !!user && !!intercomConfig?.enabled,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!user || !intercomConfig?.enabled || !intercomConfig?.app_id) {
      if (isBooted.current) {
        shutdown();
        isBooted.current = false;
      }
      return;
    }

    const userData: IntercomUserData = {
      user_id: user.id,
      name: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.email,
      email: user.email,
      phone: user.phone || undefined,
      created_at: user.createdAt ? Math.floor(new Date(user.createdAt).getTime() / 1000) : undefined,
      custom_attributes: {
        role: user.role,
        status: user.status,
      },
    };

    if (user.companyId) {
      userData.company = {
        company_id: user.companyId,
      };
    }

    boot(intercomConfig.app_id, userData, jwtData?.jwt);
    isBooted.current = true;

    return () => {
      shutdown();
      isBooted.current = false;
    };
  }, [user?.id, intercomConfig?.app_id, intercomConfig?.enabled, jwtData?.jwt]);

  useEffect(() => {
    if (!isBooted.current || !user) {
      return;
    }

    if (location !== previousLocation.current) {
      previousLocation.current = location;
      update();
    }
  }, [location, user]);

  return <>{children}</>;
}

export default IntercomProvider;
