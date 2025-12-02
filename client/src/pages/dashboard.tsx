import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, BarChart3, PieChart, MapPin, CheckCircle2, Clock, FileText, ArrowRight, TrendingUp, Award, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback, useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { geoCentroid } from "d3-geo";
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

const CHART_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

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

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  "Active": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", gradient: "from-emerald-400 to-emerald-600" },
  "Pending": { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", gradient: "from-amber-400 to-amber-600" },
  "Submitted": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", gradient: "from-blue-400 to-blue-600" },
  "Cancelled": { bg: "bg-red-100", text: "text-red-700", border: "border-red-300", gradient: "from-red-400 to-red-600" },
  "Expired": { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", gradient: "from-gray-400 to-gray-600" },
  "Renewed": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", gradient: "from-purple-400 to-purple-600" },
  "Draft": { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", gradient: "from-slate-400 to-slate-600" },
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

  const pendingTasks = statsData?.pendingTasks || 0;
  const birthdaysThisWeek = statsData?.birthdaysThisWeek || 0;
  const failedLoginAttempts = statsData?.failedLoginAttempts || 0;
  const newLeads = statsData?.newLeads || 0;

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const quickStats = [
    {
      count: pendingTasks,
      title: "Today's reminders",
      subtitle: format(today, 'EEEE, MMMM dd, yyyy'),
      icon: Bell,
      gradient: "from-violet-500 to-purple-600",
      shadowColor: "shadow-violet-500/30",
      link: "/tasks",
    },
    {
      count: birthdaysThisWeek,
      title: "Birthdays this week",
      subtitle: `${format(startOfWeek, 'MMM dd')} - ${format(endOfWeek, 'MMM dd')}`,
      icon: Cake,
      gradient: "from-pink-500 to-rose-600",
      shadowColor: "shadow-pink-500/30",
      link: "/calendar?initialView=listWeek",
    },
    {
      count: failedLoginAttempts,
      title: "Failed login",
      subtitle: "Last 14 days",
      icon: AlertTriangle,
      gradient: "from-orange-500 to-amber-600",
      shadowColor: "shadow-orange-500/30",
      link: "/settings/sessions",
    },
    {
      count: newLeads,
      title: "New leads",
      subtitle: "Click here for more",
      icon: UserPlus,
      gradient: "from-cyan-500 to-teal-600",
      shadowColor: "shadow-cyan-500/30",
      link: "/leads",
    },
  ];

  if (isLoading) {
    return <LoadingSpinner text="Loading dashboard data..." />;
  }

  const policyStatusData = analyticsData?.byStatus || [];
  const totalPolicies = analyticsData?.totalPolicies || 0;
  const topAgents = (agentsData?.agents || []).slice(0, 8);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      
      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <div
            key={index}
            onClick={() => setLocation(stat.link)}
            data-testid={`card-quick-stat-${index}`}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300",
              "bg-gradient-to-br text-white",
              stat.gradient,
              "hover:scale-[1.02] hover:shadow-xl",
              stat.shadowColor,
              "shadow-lg"
            )}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12" />
            
            <div className="relative flex items-start justify-between">
              <div>
                <div className="text-4xl font-bold mb-1">{stat.count}</div>
                <div className="text-sm font-semibold opacity-95">{stat.title}</div>
                <div className="text-xs opacity-75 mt-1">{stat.subtitle}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            
            <div className="absolute bottom-3 right-3">
              <ChevronRight className="h-5 w-5 opacity-60" />
            </div>
          </div>
        ))}
      </div>

      {/* Policy Journey Section - SugarCRM Style */}
      <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Policy Journey</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Policy workflow stages and status distribution</p>
              </div>
            </div>
            
            {/* Top Agents Avatars Row */}
            <div className="flex items-center gap-1">
              {topAgents.slice(0, 6).map((agent, idx) => (
                <div
                  key={idx}
                  className="relative group"
                  style={{ marginLeft: idx > 0 ? '-8px' : '0', zIndex: 10 - idx }}
                >
                  {agent.avatar ? (
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-9 h-9 rounded-full border-2 border-white dark:border-gray-800 shadow-md object-cover transition-transform group-hover:scale-110 group-hover:z-20"
                      title={agent.name}
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full border-2 border-white dark:border-gray-800 shadow-md flex items-center justify-center text-white text-sm font-bold transition-transform group-hover:scale-110 group-hover:z-20",
                        idx === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500" :
                        idx === 1 ? "bg-gradient-to-br from-blue-400 to-indigo-500" :
                        idx === 2 ? "bg-gradient-to-br from-emerald-400 to-teal-500" :
                        idx === 3 ? "bg-gradient-to-br from-pink-400 to-rose-500" :
                        idx === 4 ? "bg-gradient-to-br from-purple-400 to-violet-500" :
                        "bg-gradient-to-br from-cyan-400 to-blue-500"
                      )}
                      title={agent.name}
                    >
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {idx < 3 && (
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-[8px] font-bold text-white",
                      idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-gray-400" : "bg-orange-400"
                    )}>
                      {idx + 1}
                    </div>
                  )}
                </div>
              ))}
              {topAgents.length > 6 && (
                <div className="w-9 h-9 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 shadow-md" style={{ marginLeft: '-8px' }}>
                  +{topAgents.length - 6}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Status Journey Bubbles */}
          <div className="flex items-center justify-center gap-3 flex-wrap mb-8">
            {policyStatusData.slice(0, 7).map((status, idx) => {
              const colors = STATUS_COLORS[status.status] || STATUS_COLORS["Draft"];
              const size = Math.max(80, Math.min(140, 60 + (status.count / (totalPolicies || 1)) * 200));
              
              return (
                <div
                  key={idx}
                  className="relative group cursor-pointer"
                  onClick={() => setLocation(`/policies?status=${status.status}`)}
                >
                  <div
                    className={cn(
                      "rounded-full flex flex-col items-center justify-center transition-all duration-300",
                      "bg-gradient-to-br shadow-lg hover:shadow-xl hover:scale-105",
                      colors.gradient,
                      "text-white"
                    )}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                    }}
                  >
                    <span className="text-2xl font-bold">{status.count}</span>
                    <span className="text-[10px] font-medium opacity-90 px-2 text-center leading-tight">{status.status}</span>
                  </div>
                  
                  {idx < policyStatusData.slice(0, 7).length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Workflow Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: "Lead Generation", icon: UserPlus, count: newLeads, color: "from-cyan-400 to-cyan-600", items: ["New Inquiry", "Website Form", "Referral"] },
              { title: "Quote Process", icon: FileText, count: pendingTasks, color: "from-blue-400 to-blue-600", items: ["Create Quote", "Review Plans", "Send Proposal"] },
              { title: "Application", icon: Clock, count: policyStatusData.find(s => s.status === "Pending")?.count || 0, color: "from-amber-400 to-amber-600", items: ["Document Collection", "Underwriting", "Approval"] },
              { title: "Active Policies", icon: CheckCircle2, count: policyStatusData.find(s => s.status === "Active")?.count || 0, color: "from-emerald-400 to-emerald-600", items: ["Policy Issued", "Client Service", "Renewal"] },
            ].map((stage, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", stage.color)}>
                    <stage.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{stage.title}</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{stage.count}</div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {stage.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className={cn("w-1.5 h-1.5 rounded-full bg-gradient-to-br", stage.color)} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Chart & US Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Chart */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Monthly Performance</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Policies and Customers by start date</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {monthlyData?.data && monthlyData.data.length > 0 ? (
              <div className="space-y-6">
                {/* Animated Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg shadow-blue-500/30">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Policies</div>
                      <div className="text-3xl font-bold mt-1">
                        {monthlyData.data.reduce((sum, item) => sum + item.policies, 0).toLocaleString()}
                      </div>
                      <div className="text-xs mt-2 opacity-75">
                        {Math.round((monthlyData.data.reduce((sum, item) => sum + item.policies, 0) / 12) * 10) / 10} avg/month
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 p-4 text-white shadow-lg shadow-cyan-500/30">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Customers</div>
                      <div className="text-3xl font-bold mt-1">
                        {monthlyData.data.reduce((sum, item) => sum + item.customers, 0).toLocaleString()}
                      </div>
                      <div className="text-xs mt-2 opacity-75">
                        {Math.round((monthlyData.data.reduce((sum, item) => sum + item.customers, 0) / 12) * 10) / 10} avg/month
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg shadow-purple-500/30">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Avg per Policy</div>
                      <div className="text-3xl font-bold mt-1">
                        {monthlyData.data.reduce((sum, item) => sum + item.policies, 0) > 0 
                          ? (monthlyData.data.reduce((sum, item) => sum + item.customers, 0) / monthlyData.data.reduce((sum, item) => sum + item.policies, 0)).toFixed(1)
                          : 0}
                      </div>
                      <div className="text-xs mt-2 opacity-75">Customers per Policy</div>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart 
                    data={monthlyData.data} 
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPolicies" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorApplicants" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
                              <p className="font-bold text-gray-900 dark:text-white mb-2">{label}</p>
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-4 py-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-sm text-gray-600 dark:text-gray-400">{entry.name}</span>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      iconType="circle"
                      formatter={(value) => <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{value}</span>}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="policies" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, strokeWidth: 3 }}
                      name="Total Policies"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="customers" 
                      stroke="#06b6d4" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: '#06b6d4', r: 5, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7, strokeWidth: 3 }}
                      name="Total Customers"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">Loading...</div>
            )}
          </CardContent>
        </Card>

        {/* US Map */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Customer Distribution</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Hover over states to see details</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(() => {
              const statesData = analyticsData?.byState || [];
              const maxCount = Math.max(...statesData.map(s => s.count), 1);
              const totalCustomers = statesData.reduce((sum, s) => sum + s.count, 0);
              
              const colorScale = scaleLinear<string>()
                .domain([0, maxCount * 0.5, maxCount])
                .range(["#dbeafe", "#60a5fa", "#1e40af"]);
              
              const stateCountMap = new Map(
                statesData.map(s => {
                  const fullName = STATE_ABBR_TO_NAME[s.state.toUpperCase()] || s.state;
                  return [fullName.toUpperCase(), s.count];
                })
              );

              return (
                <div 
                  className="relative"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                >
                  <ComposableMap
                    projection="geoAlbersUsa"
                    projectionConfig={{ scale: 1000 }}
                    className="w-full h-[450px]"
                  >
                    <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
                      {({ geographies }) => (
                        <>
                          {geographies.map((geo) => {
                            const stateName = geo.properties.name.toUpperCase();
                            const count = stateCountMap.get(stateName) || 0;
                            const displayName = geo.properties.name;
                            const percentage = totalCustomers > 0 ? (count / totalCustomers * 100).toFixed(1) : 0;
                            
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill={count > 0 ? colorScale(count) : "#f3f4f6"}
                                stroke="#fff"
                                strokeWidth={0.5}
                                onMouseEnter={() => {
                                  setHoveredState({
                                    name: displayName,
                                    count: count,
                                    percentage: Number(percentage)
                                  });
                                }}
                                onMouseLeave={() => {
                                  setHoveredState(null);
                                }}
                                style={{
                                  default: { outline: 'none' },
                                  hover: { 
                                    fill: count > 0 ? "#1e40af" : "#e5e7eb",
                                    outline: 'none',
                                    cursor: 'pointer'
                                  },
                                  pressed: { outline: 'none' },
                                }}
                              />
                            );
                          })}
                        </>
                      )}
                    </Geographies>
                  </ComposableMap>

                  {hoveredState && (
                    <div 
                      className="absolute pointer-events-none z-50"
                      style={{
                        left: mousePosition.x + 15,
                        top: mousePosition.y - 60,
                      }}
                    >
                      <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl min-w-[180px]">
                        <div className="font-bold text-base mb-2">{hoveredState.name}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Customers:</span>
                            <span className="font-bold text-cyan-400">{hoveredState.count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Share:</span>
                            <span className="font-bold text-green-400">{hoveredState.percentage}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {statesData.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-gray-400">No geographic data available</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Agents & Product Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Leaderboard */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Agent Leaderboard</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Top performing agents by policies</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {(agentsData?.agents || []).length > 0 ? (
              <div className="space-y-3">
                {(agentsData?.agents || []).slice(0, 5).map((agent, idx) => {
                  const maxPolicies = Math.max(...(agentsData?.agents || []).map(a => a.policies), 1);
                  const percentage = (agent.policies / maxPolicies) * 100;
                  const medals = ["from-yellow-400 to-yellow-600", "from-gray-300 to-gray-500", "from-orange-400 to-orange-600"];
                  
                  return (
                    <div key={idx} className="relative group">
                      <div className="flex items-center gap-4 p-3 rounded-2xl bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all">
                        {/* Rank Badge */}
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg",
                          idx < 3 ? `bg-gradient-to-br ${medals[idx]}` : "bg-gray-400"
                        )}>
                          {idx + 1}
                        </div>
                        
                        {/* Avatar */}
                        {agent.avatar ? (
                          <img 
                            src={agent.avatar} 
                            alt={agent.name}
                            className="w-12 h-12 rounded-xl object-cover shadow-md border-2 border-white dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{agent.name}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs text-gray-500">{agent.policies} policies</span>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="text-xs text-gray-500">{agent.applicants} applicants</span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                idx === 0 ? "bg-gradient-to-r from-yellow-400 to-yellow-600" :
                                idx === 1 ? "bg-gradient-to-r from-gray-400 to-gray-500" :
                                idx === 2 ? "bg-gradient-to-r from-orange-400 to-orange-600" :
                                "bg-gradient-to-r from-blue-400 to-blue-600"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Score */}
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{agent.policies}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">policies</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">No agents data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Type Donut */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
                <PieChart className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Product Distribution</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Policies by product type</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {analyticsData?.byProductType && analyticsData.byProductType.length > 0 ? (
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width="55%" height={260}>
                  <RechartsPie data={analyticsData.byProductType.slice(0, 8)}>
                    <defs>
                      {CHART_COLORS.map((color, idx) => (
                        <linearGradient key={idx} id={`productGradient-${idx}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={1} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie 
                      data={analyticsData.byProductType.slice(0, 8)} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={55} 
                      outerRadius={100} 
                      dataKey="count"
                      paddingAngle={3}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {analyticsData.byProductType.slice(0, 8).map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#productGradient-${index % CHART_COLORS.length})`}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
                              <p className="font-semibold text-gray-900 dark:text-white">{payload[0].name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{payload[0].value} policies</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                
                <div className="flex-1 space-y-2">
                  {analyticsData.byProductType.slice(0, 6).map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" 
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.type}</p>
                      </div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No product data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carriers Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Policies per Carrier */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Policies by Carrier</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Top 10 insurance companies</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {(carriersData?.carriers || []).length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const totalPolicies = carriersData?.carriers.reduce((sum, c) => sum + c.policies, 0) || 1;
                  const maxPolicies = Math.max(...(carriersData?.carriers || []).map(c => c.policies), 1);
                  
                  return (carriersData?.carriers || []).slice(0, 8).map((carrier, idx) => {
                    const percentage = ((carrier.policies / totalPolicies) * 100).toFixed(1);
                    const barWidth = (carrier.policies / maxPolicies) * 100;
                    
                    return (
                      <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{idx + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]" title={carrier.carrier}>
                              {carrier.carrier}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{carrier.policies}</span>
                            <span className="text-xs text-gray-400">({percentage}%)</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 group-hover:from-indigo-400 group-hover:to-purple-400"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500 dark:text-gray-400">No carrier data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Applicants per Carrier */}
        <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-0 shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 dark:border-gray-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">Applicants by Carrier</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Top 10 by applicant count</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {(carriersData?.carriers || []).length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const sortedByApplicants = [...(carriersData?.carriers || [])].sort((a, b) => b.applicants - a.applicants);
                  const totalApplicants = sortedByApplicants.reduce((sum, c) => sum + c.applicants, 0) || 1;
                  const maxApplicants = Math.max(...sortedByApplicants.map(c => c.applicants), 1);
                  
                  return sortedByApplicants.slice(0, 8).map((carrier, idx) => {
                    const percentage = ((carrier.applicants / totalApplicants) * 100).toFixed(1);
                    const barWidth = (carrier.applicants / maxApplicants) * 100;
                    
                    return (
                      <div key={idx} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900 dark:to-emerald-900 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{idx + 1}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[180px]" title={carrier.carrier}>
                              {carrier.carrier}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{carrier.applicants}</span>
                            <span className="text-xs text-gray-400">({percentage}%)</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 group-hover:from-teal-400 group-hover:to-emerald-400"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500 dark:text-gray-400">No carrier data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
