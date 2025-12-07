import { useQuery } from "@tanstack/react-query";

interface PublicConfigResponse {
  config: Record<string, string>;
}

export function usePublicConfig() {
  return useQuery<PublicConfigResponse>({
    queryKey: ["/api/system-config/public"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStripePublishableKey() {
  return useQuery<{ publishableKey: string | null }>({
    queryKey: ["/api/system-config/stripe-publishable-key"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function getPublicConfigValue(config: Record<string, string> | undefined, key: string): string | undefined {
  return config?.[key];
}
