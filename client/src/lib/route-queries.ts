/**
 * Route Queries Module
 * Maps each route to the queries it needs, enabling prefetch on navigation
 */

export type RouteQueryDescriptor = {
  queryKey: unknown[];
  staleTime?: number;
  roles?: string[];
};

/**
 * Define queries needed for each route
 * staleTime: how long data stays fresh before refetch (in milliseconds)
 * - 1 min (60000): Real-time data (dashboard stats, unread counts)
 * - 5 min (300000): Frequently updated data (quotes, policies, tasks)
 * - 10 min (600000): Stable data (contacts, settings)
 */
export const routeQueries: Record<string, RouteQueryDescriptor[]> = {
  // Dashboard - real-time stats
  "/dashboard": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/dashboard-stats"], staleTime: 60000 },
    { queryKey: ["/api/notifications"], staleTime: 60000 },
  ],
  
  // Quotes - frequently updated
  "/quotes": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/quotes"], staleTime: 300000 },
  ],
  
  // Policies - frequently updated
  "/policies": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/policies"], staleTime: 300000 },
  ],
  
  // Contacts - stable data (Superadmin only)
  "/contacts": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/contacts"], staleTime: 600000, roles: ["superadmin"] },
  ],
  
  // Tasks - frequently updated
  "/tasks": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/tasks"], staleTime: 300000 },
  ],
  
  // Calendar - frequently updated
  "/calendar": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/calendar"], staleTime: 300000 },
  ],
  
  // SMS (BulkVS Threads) - real-time
  "/sms": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/bulkvs/threads"], staleTime: 60000 },
  ],
  
  // Leads - frequently updated
  "/leads": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/leads"], staleTime: 300000 },
  ],
  
  // Referrals - stable data
  "/referrals": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/referrals"], staleTime: 600000 },
  ],
  
  // Landing Page - stable data
  "/landing-page": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/landing-page"], staleTime: 600000 },
  ],
  
  // Email Marketing - frequently updated
  "/email-marketing": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/email-campaigns"], staleTime: 300000 },
  ],
  
  // Settings - stable data
  "/settings": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/settings/preferences"], staleTime: 600000 },
  ],
  
  // Superadmin routes
  "/users": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/users"], staleTime: 300000, roles: ["superadmin"] },
  ],
  
  "/companies": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/companies"], staleTime: 300000, roles: ["superadmin"] },
  ],
  
  "/plans": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/plans"], staleTime: 600000, roles: ["superadmin"] },
  ],
  
  "/features": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/features"], staleTime: 600000, roles: ["superadmin"] },
  ],
  
  "/invoices": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/invoices"], staleTime: 300000, roles: ["superadmin"] },
  ],
  
  "/billing": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/billing/subscription"], staleTime: 300000 },
  ],
  
  "/audit-logs": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/activity-logs"], staleTime: 300000, roles: ["superadmin"] },
  ],
  
  "/tickets": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/tickets"], staleTime: 300000, roles: ["superadmin"] },
  ],
  
  "/campaigns": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/campaigns"], staleTime: 300000, roles: ["superadmin"] },
  ],
  
  "/incoming-sms": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/incoming-sms"], staleTime: 60000, roles: ["superadmin"] },
  ],
  
  "/system-alerts": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/system-alerts"], staleTime: 60000, roles: ["superadmin"] },
  ],
  
  "/email-configuration": [
    { queryKey: ["/api/session"], staleTime: 60000 },
    { queryKey: ["/api/email-templates"], staleTime: 600000, roles: ["superadmin"] },
  ],
};

/**
 * Get query descriptors for a given route
 */
export function getQueriesForRoute(route: string): RouteQueryDescriptor[] {
  return routeQueries[route] || [];
}

/**
 * Get role-aware query descriptors for a given route
 * Filters out queries that require roles the user doesn't have
 */
export function getRoleAwareQueries(route: string, userRole?: string): RouteQueryDescriptor[] {
  const queries = routeQueries[route] || [];
  return queries.filter(q => {
    if (!q.roles) return true; // Public query - no role required
    return q.roles.includes(userRole || "");
  });
}

/**
 * Check if a route has defined queries
 */
export function hasDefinedQueries(route: string): boolean {
  return route in routeQueries && routeQueries[route].length > 0;
}
