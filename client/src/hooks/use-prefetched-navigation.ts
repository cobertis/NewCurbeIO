/**
 * usePrefetchedNavigation Hook
 * Ensures data is loaded before navigating to a new page
 * Prevents blank screens and loading spinners during navigation
 */

import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { getQueriesForRoute } from "@/lib/route-queries";

export function usePrefetchedNavigation() {
  const [, setLocation] = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  const navigateWithPrefetch = useCallback(async (url: string) => {
    // Don't navigate if already navigating
    if (isNavigating) return;

    setIsNavigating(true);

    try {
      // Get queries needed for the target route
      const queries = getQueriesForRoute(url);

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
  }, [isNavigating, setLocation]);

  return {
    navigateWithPrefetch,
    isNavigating,
  };
}
