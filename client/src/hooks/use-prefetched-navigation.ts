/**
 * usePrefetchedNavigation Hook
 * Ensures data is loaded before navigating to a new page
 * Prevents blank screens and loading spinners during navigation
 */

import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { getRoleAwareQueries } from "@/lib/route-queries";
import type { User } from "@shared/schema";

export function usePrefetchedNavigation() {
  const [, setLocation] = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Get current user session to access role
  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const navigateWithPrefetch = useCallback(async (url: string) => {
    // Don't navigate if already navigating
    if (isNavigating) return;

    setIsNavigating(true);

    try {
      // Get role-aware queries needed for the target route
      const queries = getRoleAwareQueries(url, userData?.user?.role);

      // Ensure all queries have data before navigating
      // This will fetch if not in cache, or use cached data if available
      await Promise.all(
        queries.map((queryDescriptor) =>
          queryClient.ensureQueryData({
            queryKey: queryDescriptor.queryKey,
            staleTime: queryDescriptor.staleTime,
          })
        )
      );

      // All data is ready, now navigate
      setLocation(url);
    } catch (error) {
      console.error("Failed to prefetch data for navigation:", error);
      // Navigate anyway even if prefetch fails (graceful degradation)
      setLocation(url);
    } finally {
      setIsNavigating(false);
    }
  }, [isNavigating, setLocation, userData?.user?.role]);

  return {
    navigateWithPrefetch,
    isNavigating,
  };
}
