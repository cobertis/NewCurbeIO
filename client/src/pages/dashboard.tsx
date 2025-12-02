import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, TrendingUp, Award, MapPin, BarChart3 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
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

const STATUS_COLORS: Record<string, string> = {
  "Active": "#10b981",
  "Pending": "#f59e0b",
  "Submitted": "#3b82f6",
  "Cancelled": "#ef4444",
  "Expired": "#6b7280",
  "Renewed": "#8b5cf6",
  "Draft": "#64748b",
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
  const topAgents = (agentsData?.agents || []).slice(0, 5);
  const topCarriers = (carriersData?.carriers || []).slice(0, 6);
  const productTypes = analyticsData?.byProductType?.slice(0, 6) || [];

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const statesData = analyticsData?.byState || [];
  const maxCount = Math.max(...statesData.map(s => s.count), 1);
  const totalCustomers = statesData.reduce((sum, s) => sum + s.count, 0);
  const colorScale = scaleLinear<string>().domain([0, maxCount]).range(["#e0e7ff", "#3b82f6"]);
  const stateCountMap = new Map(statesData.map(s => {
    const fullName = STATE_ABBR_TO_NAME[s.state.toUpperCase()] || s.state;
    return [fullName.toUpperCase(), s.count];
  }));

  const totalPoliciesYTD = monthlyData?.data?.reduce((sum, item) => sum + item.policies, 0) || 0;
  const totalCustomersYTD = monthlyData?.data?.reduce((sum, item) => sum + item.customers, 0) || 0;

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">
        
        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={Bell} 
            value={pendingTasks} 
            label="Reminders Today"
            sublabel={format(today, 'MMM dd, yyyy')}
            onClick={() => setLocation('/tasks')}
          />
          <StatCard 
            icon={Cake} 
            value={birthdaysThisWeek} 
            label="Birthdays This Week"
            sublabel={`${format(startOfWeek, 'MMM dd')} - ${format(endOfWeek, 'MMM dd')}`}
            onClick={() => setLocation('/calendar?initialView=listWeek')}
          />
          <StatCard 
            icon={AlertTriangle} 
            value={failedLoginAttempts} 
            label="Failed Logins"
            sublabel="Last 14 days"
            onClick={() => setLocation('/settings/sessions')}
          />
          <StatCard 
            icon={UserPlus} 
            value={newLeads} 
            label="New Leads"
            sublabel="Recent"
            onClick={() => setLocation('/leads')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-5">
          
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-8 space-y-5">
            
            {/* Performance Chart */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">Monthly Performance</h2>
                    <p className="text-xs text-gray-400">Policies and customers by start date</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Policies</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300" />Customers</span>
                </div>
              </div>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-medium">Total Policies</p>
                  <p className="text-xl font-semibold text-gray-800">{totalPoliciesYTD.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-600 font-medium">Total Customers</p>
                  <p className="text-xl font-semibold text-gray-800">{totalCustomersYTD.toLocaleString()}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-xs text-emerald-600 font-medium">Avg per Policy</p>
                  <p className="text-xl font-semibold text-gray-800">
                    {totalPoliciesYTD > 0 ? (totalCustomersYTD / totalPoliciesYTD).toFixed(1) : '0'}
                  </p>
                </div>
              </div>
              
              {monthlyData?.data && monthlyData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={monthlyData.data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="policyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      labelStyle={{ color: '#374151', fontWeight: 500 }}
                    />
                    <Area type="monotone" dataKey="customers" stroke="#d1d5db" strokeWidth={2} fill="transparent" />
                    <Area type="monotone" dataKey="policies" stroke="#3b82f6" strokeWidth={2} fill="url(#policyGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-gray-400">No data available</div>
              )}
            </div>

            {/* Policy Status Distribution */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Policy Status</h2>
                  <p className="text-xs text-gray-400">Distribution by status ({totalPolicies} total)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                {/* Donut Chart */}
                <div className="w-[180px] h-[180px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={policyStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="count"
                        paddingAngle={2}
                      >
                        {policyStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Status Legend */}
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {policyStatusData.map((status, idx) => {
                    const pct = totalPolicies > 0 ? ((status.count / totalPolicies) * 100).toFixed(1) : '0';
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setLocation(`/policies?status=${status.status}`)}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: STATUS_COLORS[status.status] || '#64748b' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{status.status}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800">{status.count}</p>
                          <p className="text-xs text-gray-400">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* US Map */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Customer Distribution</h2>
                  <p className="text-xs text-gray-400">Geographic distribution by state</p>
                </div>
              </div>
              
              <div 
                className="relative"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
              >
                <ComposableMap
                  projection="geoAlbersUsa"
                  projectionConfig={{ scale: 900 }}
                  className="w-full h-[280px]"
                >
                  <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
                    {({ geographies }) => geographies.map((geo) => {
                      const stateName = geo.properties.name.toUpperCase();
                      const count = stateCountMap.get(stateName) || 0;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={count > 0 ? colorScale(count) : "#f1f5f9"}
                          stroke="#fff"
                          strokeWidth={0.5}
                          onMouseEnter={() => setHoveredState({ name: geo.properties.name, count, percentage: totalCustomers > 0 ? (count / totalCustomers) * 100 : 0 })}
                          onMouseLeave={() => setHoveredState(null)}
                          style={{
                            default: { outline: 'none' },
                            hover: { fill: count > 0 ? "#2563eb" : "#e2e8f0", outline: 'none', cursor: 'pointer' },
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
                    <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-lg">
                      <p className="text-gray-800 text-sm font-medium">{hoveredState.name}</p>
                      <p className="text-gray-500 text-xs">{hoveredState.count} customers ({hoveredState.percentage.toFixed(1)}%)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-4 space-y-5">
            
            {/* Top Agents */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Award className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Top Agents</h2>
                  <p className="text-xs text-gray-400">By policies</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {topAgents.map((agent, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="text-xs font-bold text-gray-400 w-4">{idx + 1}</div>
                    {agent.avatar ? (
                      <img src={agent.avatar} alt={agent.name} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 text-sm font-medium">
                        {agent.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{agent.name}</p>
                      <p className="text-xs text-gray-400">{agent.applicants} applicants</p>
                    </div>
                    <div className="text-lg font-semibold text-gray-800">{agent.policies}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Carriers */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Top Carriers</h2>
                  <p className="text-xs text-gray-400">By policies</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {topCarriers.map((carrier, idx) => {
                  const maxPolicies = Math.max(...topCarriers.map(c => c.policies), 1);
                  const barWidth = (carrier.policies / maxPolicies) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 truncate max-w-[160px]">{carrier.carrier}</span>
                        <span className="text-sm font-semibold text-gray-800">{carrier.policies}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Product Types */}
            {productTypes.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-pink-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">Product Types</h2>
                    <p className="text-xs text-gray-400">Distribution</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {productTypes.map((product, idx) => {
                    const total = productTypes.reduce((sum, p) => sum + p.count, 0) || 1;
                    const pct = ((product.count / total) * 100).toFixed(0);
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="w-2 h-2 rounded-full bg-pink-400" style={{ opacity: 1 - idx * 0.12 }} />
                        <span className="text-sm text-gray-700 flex-1 truncate">{product.type}</span>
                        <span className="text-sm font-medium text-gray-800">{product.count}</span>
                        <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, sublabel, onClick }: {
  icon: any;
  value: number;
  label: string;
  sublabel: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4"
    >
      <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-semibold text-gray-800">{value}</p>
        <p className="text-sm text-gray-600 truncate">{label}</p>
        <p className="text-xs text-gray-400 truncate">{sublabel}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300" />
    </div>
  );
}
