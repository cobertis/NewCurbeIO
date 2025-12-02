import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, Check, MoreHorizontal, Plus, Upload, Calendar, Star, MapPin } from "lucide-react";
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

const STATUS_COLORS: Record<string, string> = {
  "Active": "bg-emerald-400",
  "Pending": "bg-amber-400",
  "Submitted": "bg-blue-400",
  "Cancelled": "bg-red-400",
  "Expired": "bg-gray-400",
  "Renewed": "bg-purple-400",
  "Draft": "bg-slate-400",
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
  const newLeads = statsData?.newLeads || 0;
  const policyStatusData = analyticsData?.byStatus || [];
  const topAgents = (agentsData?.agents || []).slice(0, 8);
  const topCarriers = (carriersData?.carriers || []).slice(0, 5);

  const statesData = analyticsData?.byState || [];
  const maxCount = Math.max(...statesData.map(s => s.count), 1);
  const totalCustomers = statesData.reduce((sum, s) => sum + s.count, 0);
  const colorScale = scaleLinear<string>().domain([0, maxCount]).range(["#e2e8f0", "#3b82f6"]);
  const stateCountMap = new Map(statesData.map(s => {
    const fullName = STATE_ABBR_TO_NAME[s.state.toUpperCase()] || s.state;
    return [fullName.toUpperCase(), s.count];
  }));

  const ActionButtons = () => (
    <div className="flex items-center gap-1">
      <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
        <Plus className="w-4 h-4" />
      </button>
      <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
        <Upload className="w-4 h-4" />
      </button>
      <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
        <Calendar className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef2f6] p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Page Title */}
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">Policy Journeys</h1>
        </div>

        {/* Policy Management Card - Workflow Style */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Policy Management</h2>
            
            {/* Agent Avatars Row */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {topAgents.slice(0, 6).map((agent, idx) => (
                  <div key={idx} className="relative" style={{ zIndex: 10 - idx }}>
                    {agent.avatar ? (
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                        title={agent.name}
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-sm font-medium bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700"
                        title={agent.name}
                      >
                        {agent.name.charAt(0)}
                      </div>
                    )}
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white",
                      idx === 0 ? "bg-blue-500" : idx === 1 ? "bg-emerald-500" : idx === 2 ? "bg-amber-500" : "bg-gray-400"
                    )}>
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
              <ActionButtons />
            </div>
          </div>

          {/* Workflow Columns */}
          <div className="grid grid-cols-4 gap-6">
            {/* Column 1: New Leads */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 pb-2 border-b border-gray-100">New Leads</h3>
              <WorkflowCard 
                avatar={topAgents[0]} 
                title="Review new inquiry"
                hasCheck
                onClick={() => setLocation('/leads')}
              />
              <WorkflowCard 
                avatar={topAgents[1]} 
                title="Contact prospect"
                hasCalendar
              />
            </div>

            {/* Column 2: Quote Process */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 pb-2 border-b border-gray-100">Quote Process</h3>
              <WorkflowCard 
                title="Create Quote"
                hasCheck
                hasCalendar
                onClick={() => setLocation('/quotes')}
              />
              <WorkflowCard 
                title="Compare Plans"
                hasCheck
              />
              <WorkflowCard 
                title="Send Proposal"
                hasCheck
                hasMore
              />
              <WorkflowCard 
                avatar={topAgents[2]}
                title="Follow up with client"
                hasMore
              />
            </div>

            {/* Column 3: Application */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 pb-2 border-b border-gray-100">Application</h3>
              <WorkflowCard 
                title="Collect Documents"
                hasCheck
                hasCalendar
              />
              <WorkflowCard 
                title="Submit Application"
                hasCheck
              />
              <WorkflowCard 
                title="Underwriting Review"
                highlighted
              />
              <WorkflowCard 
                avatar={topAgents[3]}
                title="Notify client of status"
                hasMore
              />
            </div>

            {/* Column 4: Active Policy */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 pb-2 border-b border-gray-100">Active Policy</h3>
              <div className="grid grid-cols-2 gap-2">
                <MiniCard title="Policy Issued" />
                <MiniCard title="Welcome Call" />
                <MiniCard title="Client Service" />
                <MiniCard title="Annual Review" />
                <MiniCard title="Renewal Notice" />
                <MiniCard title="Retention" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Two Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Recent Activity / Carriers Table */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Top Carriers</h2>
              <ActionButtons />
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 pb-3 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="col-span-1"></div>
              <div className="col-span-5">Carrier</div>
              <div className="col-span-3 text-center">Policies</div>
              <div className="col-span-3 text-center">Applicants</div>
            </div>
            
            {/* Table Rows */}
            <div className="divide-y divide-gray-50">
              {topCarriers.map((carrier, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-4 py-3 items-center hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="col-span-1">
                    <Star className={cn("w-4 h-4", idx === 0 ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
                  </div>
                  <div className="col-span-5 text-sm font-medium text-gray-700 truncate">{carrier.carrier}</div>
                  <div className="col-span-3 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {carrier.policies}
                    </span>
                  </div>
                  <div className="col-span-3 text-center text-sm text-gray-500">{carrier.applicants}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Policy Status Journey */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-800">Policy Status Journey</h2>
              <ActionButtons />
            </div>
            
            {/* Status Bubbles */}
            <div className="flex flex-wrap justify-center gap-4">
              {policyStatusData.slice(0, 6).map((status, idx) => {
                const baseSize = 70;
                const maxSize = 130;
                const total = policyStatusData.reduce((sum, s) => sum + s.count, 0) || 1;
                const ratio = status.count / total;
                const size = Math.max(baseSize, Math.min(maxSize, baseSize + ratio * 150));
                const bgColor = STATUS_COLORS[status.status] || "bg-gray-400";
                
                return (
                  <div
                    key={idx}
                    onClick={() => setLocation(`/policies?status=${status.status}`)}
                    className="cursor-pointer transition-transform hover:scale-105"
                  >
                    <div
                      className={cn(
                        "rounded-full flex flex-col items-center justify-center text-white shadow-lg",
                        bgColor
                      )}
                      style={{ width: size, height: size }}
                    >
                      <span className="text-2xl font-bold">{status.count}</span>
                      <span className="text-[10px] font-medium opacity-90 px-2 text-center leading-tight">
                        {status.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Third Row: Chart and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Chart */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Monthly Performance</h2>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Policies</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-300" />Customers</span>
              </div>
            </div>
            
            {monthlyData?.data && monthlyData.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData.data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="policyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    labelStyle={{ color: '#374151', fontWeight: 500 }}
                  />
                  <Area type="monotone" dataKey="customers" stroke="#d1d5db" strokeWidth={2} fill="transparent" />
                  <Area type="monotone" dataKey="policies" stroke="#3b82f6" strokeWidth={2} fill="url(#policyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400">No data available</div>
            )}
          </div>

          {/* US Map */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">Customer Distribution</h2>
              <MapPin className="w-4 h-4 text-gray-400" />
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
                projectionConfig={{ scale: 800 }}
                className="w-full h-[220px]"
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
                  <div className="bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-lg">
                    <p className="text-gray-800 text-sm font-medium">{hoveredState.name}</p>
                    <p className="text-gray-500 text-xs">{hoveredState.count} customers ({hoveredState.percentage.toFixed(1)}%)</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickStatCard 
            icon={Bell} 
            value={pendingTasks} 
            label="Reminders Today" 
            color="violet"
            onClick={() => setLocation('/tasks')}
          />
          <QuickStatCard 
            icon={Cake} 
            value={birthdaysThisWeek} 
            label="Birthdays This Week" 
            color="pink"
            onClick={() => setLocation('/calendar?initialView=listWeek')}
          />
          <QuickStatCard 
            icon={UserPlus} 
            value={newLeads} 
            label="New Leads" 
            color="cyan"
            onClick={() => setLocation('/leads')}
          />
        </div>

      </div>
    </div>
  );
}

function WorkflowCard({ avatar, title, hasCheck, hasCalendar, hasMore, highlighted, onClick }: {
  avatar?: { name: string; avatar: string | null } | null;
  title: string;
  hasCheck?: boolean;
  hasCalendar?: boolean;
  hasMore?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-3 rounded-xl border transition-all",
        highlighted 
          ? "bg-gray-800 border-gray-700 text-white" 
          : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm",
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start gap-3">
        {avatar && (
          avatar.avatar ? (
            <img src={avatar.avatar} alt={avatar.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 text-sm font-medium flex-shrink-0">
              {avatar.name.charAt(0)}
            </div>
          )
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm", highlighted ? "text-white" : "text-gray-700")}>{title}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        {hasCheck && (
          <div className={cn("w-5 h-5 rounded flex items-center justify-center", highlighted ? "bg-white/20" : "bg-gray-100")}>
            <Check className={cn("w-3 h-3", highlighted ? "text-white" : "text-gray-400")} />
          </div>
        )}
        {hasCalendar && (
          <div className={cn("w-5 h-5 rounded flex items-center justify-center", highlighted ? "bg-white/20" : "bg-gray-100")}>
            <Calendar className={cn("w-3 h-3", highlighted ? "text-white" : "text-gray-400")} />
          </div>
        )}
        {hasMore && (
          <div className={cn("w-5 h-5 rounded flex items-center justify-center ml-auto", highlighted ? "bg-white/20" : "bg-gray-100")}>
            <MoreHorizontal className={cn("w-3 h-3", highlighted ? "text-white" : "text-gray-400")} />
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCard({ title }: { title: string }) {
  return (
    <div className="p-2.5 rounded-lg border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all">
      <p className="text-xs text-gray-600 text-center">{title}</p>
    </div>
  );
}

function QuickStatCard({ icon: Icon, value, label, color, onClick }: {
  icon: any;
  value: number;
  label: string;
  color: 'violet' | 'pink' | 'cyan';
  onClick?: () => void;
}) {
  const colors = {
    violet: "bg-violet-50 text-violet-600",
    pink: "bg-pink-50 text-pink-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };
  
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
