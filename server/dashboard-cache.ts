/**
 * Dashboard Analytics Cache
 * 
 * Company-scoped in-memory cache with TTL for dashboard analytics data.
 * Caches unique person datasets and aggregated statistics to avoid
 * rebuilding on every request.
 * 
 * Performance: Reduces 3-7 second response times to sub-1-second
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UniquePeopleData {
  count: number;
  uniqueIdentifiers: Map<string, {
    policyIds: string[];
    identifier: string;
    identifierType: 'ssn' | 'email' | 'name-dob';
  }>;
  allPolicies: any[];
}

interface AnalyticsData {
  totalPolicies: number;
  byState: Array<{ state: string; count: number; percentage: string }>;
  byStatus: Array<{ status: string; count: number; percentage: string }>;
  byProductType: Array<{ type: string; count: number; percentage: string }>;
}

interface StatsData {
  userCount: number;
  companyCount?: number;
  revenue: number;
  growthRate: number;
  invoiceCount: number;
  subscription?: any;
  company?: any;
}

interface AgentsData {
  agents: Array<{
    id: string;
    name: string;
    avatar: string | null;
    uniquePeopleCount: number;
    policyCount: number;
  }>;
}

interface CarriersData {
  carriers: Array<{
    name: string;
    count: number;
    percentage: string;
  }>;
}

interface MonthlyData {
  data: Array<{
    month: string;
    count: number;
  }>;
}

class DashboardCache {
  private uniquePeopleCache = new Map<string, CacheEntry<UniquePeopleData>>();
  private analyticsCache = new Map<string, CacheEntry<AnalyticsData>>();
  private statsCache = new Map<string, CacheEntry<StatsData>>();
  private agentsCache = new Map<string, CacheEntry<AgentsData>>();
  private carriersCache = new Map<string, CacheEntry<CarriersData>>();
  private monthlyCache = new Map<string, CacheEntry<MonthlyData>>();
  private readonly TTL = 60000; // 60 seconds

  /**
   * Generate cache keys for company
   */
  private getUniquePeopleKey(companyId: string): string {
    return `unique-people:${companyId}`;
  }

  private getAnalyticsKey(companyId: string): string {
    return `analytics:${companyId}`;
  }

  private getStatsKey(companyId: string): string {
    return `stats:${companyId}`;
  }

  private getAgentsKey(companyId: string): string {
    return `agents:${companyId}`;
  }

  private getCarriersKey(companyId: string): string {
    return `carriers:${companyId}`;
  }

  private getMonthlyKey(companyId: string): string {
    return `monthly:${companyId}`;
  }

  /**
   * Get cached unique people data for a company
   */
  getUniquePeople(companyId: string): UniquePeopleData | null {
    const key = this.getUniquePeopleKey(companyId);
    const entry = this.uniquePeopleCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.uniquePeopleCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache unique people data for a company
   */
  setUniquePeople(companyId: string, data: UniquePeopleData): void {
    const key = this.getUniquePeopleKey(companyId);
    this.uniquePeopleCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached analytics data for a company
   */
  getAnalytics(companyId: string): AnalyticsData | null {
    const key = this.getAnalyticsKey(companyId);
    const entry = this.analyticsCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.analyticsCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache analytics data for a company
   */
  setAnalytics(companyId: string, data: AnalyticsData): void {
    const key = this.getAnalyticsKey(companyId);
    this.analyticsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached stats data for a company
   */
  getDashboardStats(companyId: string): StatsData | null {
    const key = this.getStatsKey(companyId);
    const entry = this.statsCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.statsCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache stats data for a company
   */
  setDashboardStats(companyId: string, data: StatsData): void {
    const key = this.getStatsKey(companyId);
    this.statsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached agents data for a company
   */
  getAgents(companyId: string): AgentsData | null {
    const key = this.getAgentsKey(companyId);
    const entry = this.agentsCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.agentsCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache agents data for a company
   */
  setAgents(companyId: string, data: AgentsData): void {
    const key = this.getAgentsKey(companyId);
    this.agentsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached carriers data for a company
   */
  getCarriers(companyId: string): CarriersData | null {
    const key = this.getCarriersKey(companyId);
    const entry = this.carriersCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.carriersCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache carriers data for a company
   */
  setCarriers(companyId: string, data: CarriersData): void {
    const key = this.getCarriersKey(companyId);
    this.carriersCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached monthly data for a company
   */
  getMonthly(companyId: string): MonthlyData | null {
    const key = this.getMonthlyKey(companyId);
    const entry = this.monthlyCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.monthlyCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache monthly data for a company
   */
  setMonthly(companyId: string, data: MonthlyData): void {
    const key = this.getMonthlyKey(companyId);
    this.monthlyCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate all cache entries for a company
   * Called when policies are created, updated, or deleted
   */
  invalidateCompany(companyId: string): void {
    const uniquePeopleKey = this.getUniquePeopleKey(companyId);
    const analyticsKey = this.getAnalyticsKey(companyId);
    const statsKey = this.getStatsKey(companyId);
    const agentsKey = this.getAgentsKey(companyId);
    const carriersKey = this.getCarriersKey(companyId);
    const monthlyKey = this.getMonthlyKey(companyId);
    
    this.uniquePeopleCache.delete(uniquePeopleKey);
    this.analyticsCache.delete(analyticsKey);
    this.statsCache.delete(statsKey);
    this.agentsCache.delete(agentsKey);
    this.carriersCache.delete(carriersKey);
    this.monthlyCache.delete(monthlyKey);
    
    console.log(`[DashboardCache] Invalidated all cache types for company: ${companyId}`);
  }

  /**
   * Clear all caches (for testing/debugging)
   */
  clearAll(): void {
    this.uniquePeopleCache.clear();
    this.analyticsCache.clear();
    this.statsCache.clear();
    this.agentsCache.clear();
    this.carriersCache.clear();
    this.monthlyCache.clear();
    console.log('[DashboardCache] All caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    uniquePeopleCached: number;
    analyticsCached: number;
    statsCached: number;
    agentsCached: number;
    carriersCached: number;
    monthlyCached: number;
    totalEntries: number;
  } {
    return {
      uniquePeopleCached: this.uniquePeopleCache.size,
      analyticsCached: this.analyticsCache.size,
      statsCached: this.statsCache.size,
      agentsCached: this.agentsCache.size,
      carriersCached: this.carriersCache.size,
      monthlyCached: this.monthlyCache.size,
      totalEntries: this.uniquePeopleCache.size + this.analyticsCache.size + this.statsCache.size + this.agentsCache.size + this.carriersCache.size + this.monthlyCache.size
    };
  }
}

// Export singleton instance
export const dashboardCache = new DashboardCache();
