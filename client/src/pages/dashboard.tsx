import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, TrendingUp, Award, Activity, Zap, ArrowUpRight, Layers } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { LoadingSpinner } from "@/components/loading-spinner";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalUsers: number;
  adminCount: number;
  memberCount: number;
  viewerCount: number;
  companyCount: number;
  revenue: number;
  growthRate: number;
  invoiceCount: number;
  paidInvoices: number;
  pendingTasks: number;
  birthdaysThisWeek: number;
  failedLoginAttempts: number;
  newLeads: number;
}

interface PoliciesAnalytics {
  totalPolicies: number;
  byState: Array<{ state: string; count: number; percentage: string }>;
  byStatus: Array<{ status: string; count: number; percentage: string }>;
  byProductType?: Array<{ type: string; count: number; percentage: string }>;
}

interface MonthlyData {
  month: string;
  policies: number;
  customers: number;
}

interface AgentLeaderboard {
  agents: Array<{ name: string; avatar: string | null; policies: number; applicants: number }>;
}

const STATE_ABBR_TO_NAME: Record<string, string> = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
  "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
  "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
  "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
  "DC": "District of Columbia", "PR": "Puerto Rico"
};

const BentoCard = ({ className, children, onClick, glow }: { className?: string; children: React.ReactNode; onClick?: () => void; glow?: 'blue' | 'purple' | 'green' | 'amber' }) => {
  const glowColors = {
    blue: 'before:bg-blue-500/20 hover:before:bg-blue-500/30',
    purple: 'before:bg-purple-500/20 hover:before:bg-purple-500/30',
    green: 'before:bg-emerald-500/20 hover:before:bg-emerald-500/30',
    amber: 'before:bg-amber-500/20 hover:before:bg-amber-500/30',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-[28px] bg-[#1a1a1a] dark:bg-[#1a1a1a] overflow-hidden transition-all duration-500",
        "border border-white/[0.08]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_20px_rgba(0,0,0,0.4)]",
        "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_40px_rgba(0,0,0,0.5)]",
        "hover:border-white/[0.12]",
        "before:absolute before:inset-0 before:rounded-[28px] before:opacity-0 before:blur-3xl before:transition-opacity before:duration-500 hover:before:opacity-100",
        glow && glowColors[glow],
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [hoveredState, setHoveredState] = useState<{ name: string; count: number; percentage: number } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'notification_update' || message.type === 'dashboard_update' || message.type === 'data_invalidation') {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }
  }, [queryClient]);
  
  useWebSocket(handleWebSocketMessage);
  
  const { data: statsData, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery<PoliciesAnalytics>({
    queryKey: ["/api/policies-analytics"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<{ data: MonthlyData[] }>({
    queryKey: ["/api/dashboard-monthly"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: agentsData, isLoading: isLoadingAgents } = useQuery<AgentLeaderboard>({
    queryKey: ["/api/dashboard-agents"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: carriersData, isLoading: isLoadingCarriers } = useQuery<{ carriers: { carrier: string; policies: number; applicants: number }[] }>({
    queryKey: ["/api/dashboard-carriers"],
    refetchInterval: 5 * 60 * 1000,
  });

  const isLoading = isLoadingStats || isLoadingAnalytics || isLoadingMonthly || isLoadingAgents || isLoadingCarriers;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const pendingTasks = statsData?.pendingTasks || 0;
  const birthdaysThisWeek = statsData?.birthdaysThisWeek || 0;
  const failedLoginAttempts = statsData?.failedLoginAttempts || 0;
  const newLeads = statsData?.newLeads || 0;
  const policyStatusData = analyticsData?.byStatus || [];
  const totalPolicies = analyticsData?.totalPolicies || 0;
  const topAgents = (agentsData?.agents || []).slice(0, 4);
  const totalCustomersYTD = monthlyData?.data?.reduce((sum, item) => sum + item.customers, 0) || 0;
  const totalPoliciesYTD = monthlyData?.data?.reduce((sum, item) => sum + item.policies, 0) || 0;

  const statesData = analyticsData?.byState || [];
  const maxCount = Math.max(...statesData.map(s => s.count), 1);
  const totalCustomers = statesData.reduce((sum, s) => sum + s.count, 0);
  const colorScale = scaleLinear<string>().domain([0, maxCount]).range(["#262626", "#3b82f6"]);
  const stateCountMap = new Map(statesData.map(s => {
    const fullName = STATE_ABBR_TO_NAME[s.state.toUpperCase()] || s.state;
    return [fullName.toUpperCase(), s.count];
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      {/* Ambient light effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto">
        {/* Bento Grid Layout */}
        <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-12 gap-4 auto-rows-[100px]">
          
          {/* Large Feature Card - Performance Chart */}
          <BentoCard className="col-span-4 md:col-span-5 lg:col-span-7 row-span-3" glow="blue">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest">Performance</p>
                  <h2 className="text-white text-xl font-medium mt-1">Monthly Overview</h2>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Policies</span>
                  <span className="flex items-center gap-1.5 text-white/50"><span className="w-2 h-2 rounded-full bg-white/30" />Customers</span>
                </div>
              </div>
              <div className="flex-1 -mx-2">
                {monthlyData?.data && monthlyData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData.data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#525252', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                        labelStyle={{ color: '#fff', fontWeight: 500 }}
                        itemStyle={{ color: '#a1a1aa' }}
                      />
                      <Area type="monotone" dataKey="customers" stroke="#404040" strokeWidth={1.5} fill="transparent" />
                      <Area type="monotone" dataKey="policies" stroke="#3b82f6" strokeWidth={2} fill="url(#chartGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-white/20">No data</div>
                )}
              </div>
            </div>
          </BentoCard>

          {/* Total Policies - Large number */}
          <BentoCard className="col-span-2 md:col-span-3 lg:col-span-2 row-span-2" glow="purple" onClick={() => setLocation('/policies')}>
            <div className="p-5 h-full flex flex-col justify-between">
              <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-5xl font-light text-white tracking-tight">{totalPoliciesYTD}</p>
                <p className="text-white/40 text-sm mt-1">Total Policies</p>
              </div>
            </div>
          </BentoCard>

          {/* Total Customers */}
          <BentoCard className="col-span-2 md:col-span-3 lg:col-span-3 row-span-2" glow="green" onClick={() => setLocation('/contacts')}>
            <div className="p-5 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-5xl font-light text-white tracking-tight">{totalCustomersYTD}</p>
                <p className="text-white/40 text-sm mt-1">Total Customers</p>
              </div>
            </div>
          </BentoCard>

          {/* Quick Stats Row */}
          <BentoCard className="col-span-2 md:col-span-2 lg:col-span-3 row-span-1" onClick={() => setLocation('/tasks')}>
            <div className="p-4 h-full flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-light text-white">{pendingTasks}</p>
                <p className="text-white/40 text-xs truncate">Reminders today</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-2 md:col-span-2 lg:col-span-3 row-span-1" onClick={() => setLocation('/calendar?initialView=listWeek')}>
            <div className="p-4 h-full flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                <Cake className="w-5 h-5 text-pink-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-light text-white">{birthdaysThisWeek}</p>
                <p className="text-white/40 text-xs truncate">Birthdays this week</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-2 md:col-span-2 lg:col-span-3 row-span-1" onClick={() => setLocation('/settings/sessions')}>
            <div className="p-4 h-full flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-light text-white">{failedLoginAttempts}</p>
                <p className="text-white/40 text-xs truncate">Failed logins</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-2 md:col-span-2 lg:col-span-3 row-span-1" onClick={() => setLocation('/leads')}>
            <div className="p-4 h-full flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-light text-white">{newLeads}</p>
                <p className="text-white/40 text-xs truncate">New leads</p>
              </div>
            </div>
          </BentoCard>

          {/* Policy Pipeline */}
          <BentoCard className="col-span-4 md:col-span-4 lg:col-span-4 row-span-3">
            <div className="p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/40 text-xs uppercase tracking-widest">Pipeline</p>
                <p className="text-white text-lg font-light">{totalPolicies}</p>
              </div>
              <div className="flex-1 space-y-3 overflow-auto">
                {policyStatusData.slice(0, 6).map((status, idx) => {
                  const pct = totalPolicies > 0 ? (status.count / totalPolicies) * 100 : 0;
                  return (
                    <div 
                      key={idx} 
                      className="group cursor-pointer"
                      onClick={() => setLocation(`/policies?status=${status.status}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/60 text-sm">{status.status}</span>
                        <span className="text-white text-sm">{status.count}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300 group-hover:from-blue-500 group-hover:to-blue-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </BentoCard>

          {/* Top Agents */}
          <BentoCard className="col-span-4 md:col-span-4 lg:col-span-4 row-span-3">
            <div className="p-5 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-amber-400" />
                <p className="text-white/40 text-xs uppercase tracking-widest">Top Agents</p>
              </div>
              <div className="flex-1 space-y-2">
                {topAgents.map((agent, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                    <div className="relative">
                      {agent.avatar ? (
                        <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-white/60 font-medium">
                          {agent.name.charAt(0)}
                        </div>
                      )}
                      {idx < 3 && (
                        <div className={cn(
                          "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold",
                          idx === 0 ? "bg-amber-500 text-black" : idx === 1 ? "bg-zinc-400 text-black" : "bg-orange-700 text-white"
                        )}>
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{agent.name}</p>
                      <p className="text-white/30 text-xs">{agent.applicants} applicants</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-lg font-light">{agent.policies}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

          {/* US Map */}
          <BentoCard className="col-span-4 md:col-span-8 lg:col-span-4 row-span-3">
            <div className="h-full flex flex-col">
              <div className="p-5 pb-0">
                <p className="text-white/40 text-xs uppercase tracking-widest">Geography</p>
              </div>
              <div 
                className="flex-1 relative -mt-4"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
              >
                <ComposableMap
                  projection="geoAlbersUsa"
                  projectionConfig={{ scale: 800 }}
                  className="w-full h-full"
                >
                  <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
                    {({ geographies }) => geographies.map((geo) => {
                      const stateName = geo.properties.name.toUpperCase();
                      const count = stateCountMap.get(stateName) || 0;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={count > 0 ? colorScale(count) : "#1a1a1a"}
                          stroke="#262626"
                          strokeWidth={0.5}
                          onMouseEnter={() => setHoveredState({ name: geo.properties.name, count, percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0 })}
                          onMouseLeave={() => setHoveredState(null)}
                          style={{
                            default: { outline: 'none' },
                            hover: { fill: count > 0 ? "#60a5fa" : "#262626", outline: 'none', cursor: 'pointer' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })}
                  </Geographies>
                </ComposableMap>
                
                {hoveredState && (
                  <div 
                    className="absolute pointer-events-none z-50"
                    style={{ left: mousePosition.x + 10, top: mousePosition.y - 40 }}
                  >
                    <div className="bg-[#1a1a1a] border border-white/10 px-3 py-2 rounded-xl shadow-xl">
                      <p className="text-white text-sm font-medium">{hoveredState.name}</p>
                      <p className="text-white/50 text-xs">{hoveredState.count} customers ({hoveredState.percentage.toFixed(1)}%)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </BentoCard>

          {/* Top Carriers */}
          <BentoCard className="col-span-4 md:col-span-8 lg:col-span-8 row-span-2">
            <div className="p-5 h-full">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Top Carriers</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 h-[calc(100%-2rem)]">
                {(carriersData?.carriers || []).slice(0, 4).map((carrier, idx) => (
                  <div key={idx} className="bg-white/[0.02] rounded-2xl p-4 flex flex-col justify-between">
                    <p className="text-white/50 text-xs truncate">{carrier.carrier}</p>
                    <div>
                      <p className="text-white text-2xl font-light">{carrier.policies}</p>
                      <p className="text-white/30 text-xs">{carrier.applicants} applicants</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BentoCard>

        </div>
      </div>
    </div>
  );
}
