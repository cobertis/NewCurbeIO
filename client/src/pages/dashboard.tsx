import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, BarChart3, PieChart, MapPin, Building2, CreditCard, Sparkles, Receipt, LifeBuoy, FileText, Key, Mail, DollarSign, Mic } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback, useState } from "react";
import { LineChart, Line, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { LoadingSpinner } from "@/components/loading-spinner";

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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [hoveredState, setHoveredState] = useState<{ name: string; count: number; percentage: number } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { data: sessionData } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;
  const isSuperAdmin = user?.role === "superadmin";
  
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'notification_update' || message.type === 'dashboard_update' || message.type === 'data_invalidation') {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }
  }, [queryClient]);
  
  useWebSocket(handleWebSocketMessage);
  
  const { data: statsData, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
    refetchInterval: 5 * 60 * 1000,
    enabled: !isSuperAdmin,
  });

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery<PoliciesAnalytics>({
    queryKey: ["/api/policies-analytics"],
    refetchInterval: 5 * 60 * 1000,
    enabled: !isSuperAdmin,
  });

  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<{ data: MonthlyData[] }>({
    queryKey: ["/api/dashboard-monthly"],
    refetchInterval: 5 * 60 * 1000,
    enabled: !isSuperAdmin,
  });

  const { data: agentsData, isLoading: isLoadingAgents } = useQuery<AgentLeaderboard>({
    queryKey: ["/api/dashboard-agents"],
    refetchInterval: 5 * 60 * 1000,
    enabled: !isSuperAdmin,
  });

  const { data: carriersData, isLoading: isLoadingCarriers } = useQuery<{ carriers: { carrier: string; policies: number; applicants: number }[] }>({
    queryKey: ["/api/dashboard-carriers"],
    refetchInterval: 5 * 60 * 1000,
    enabled: !isSuperAdmin,
  });

  const isLoading = !isSuperAdmin && (isLoadingStats || isLoadingAnalytics || isLoadingMonthly || isLoadingAgents || isLoadingCarriers);

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
      iconBg: "bg-purple-100 dark:bg-purple-900",
      iconColor: "text-purple-600 dark:text-purple-400",
      link: "/tasks",
    },
    {
      count: birthdaysThisWeek,
      title: "Birthdays this week",
      subtitle: `${format(startOfWeek, 'MMM dd')} - ${format(endOfWeek, 'MMM dd')}`,
      icon: Cake,
      iconBg: "bg-blue-100 dark:bg-blue-900",
      iconColor: "text-blue-600 dark:text-blue-400",
      link: "/calendar?initialView=listWeek",
    },
    {
      count: failedLoginAttempts,
      title: "Failed login",
      subtitle: "Last 14 days",
      icon: AlertTriangle,
      iconBg: "bg-orange-100 dark:bg-orange-900",
      iconColor: "text-orange-600 dark:text-orange-400",
      link: "/settings/sessions",
    },
    {
      count: newLeads,
      title: "New leads",
      subtitle: "Click here for more",
      icon: UserPlus,
      iconBg: "bg-cyan-100 dark:bg-cyan-900",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      link: "/leads",
    },
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isSuperAdmin) {
    const superadminLinks = [
      { title: "Companies", path: "/companies", icon: Building2, description: "Manage companies and tenants" },
      { title: "Users", path: "/users", icon: Users, description: "Manage system users" },
      { title: "Plans", path: "/plans", icon: CreditCard, description: "Subscription plans" },
      { title: "Features", path: "/features", icon: Sparkles, description: "Feature flags" },
      { title: "Invoices", path: "/invoices", icon: Receipt, description: "Billing and invoices" },
      { title: "Tickets", path: "/tickets", icon: LifeBuoy, description: "Support tickets" },
      { title: "Audit Logs", path: "/audit-logs", icon: FileText, description: "System audit logs" },
      { title: "System Alerts", path: "/system-alerts", icon: AlertTriangle, description: "System alerts" },
      { title: "API Credentials", path: "/system-settings", icon: Key, description: "API keys and secrets" },
      { title: "Telnyx Pricing", path: "/system-settings?tab=pricing", icon: DollarSign, description: "Global telephony pricing" },
      { title: "Email Templates", path: "/email-configuration", icon: Mail, description: "Email templates and configuration" },
      { title: "Recording Media", path: "/admin/recording-media", icon: Mic, description: "Call recording announcements" },
    ];

    return (
      <div className="flex flex-col gamin-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">System administration and management</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {superadminLinks.map((link) => (
            <Card 
              key={link.path} 
              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1"
              onClick={() => setLocation(link.path)}
              data-testid={`superadmin-link-${link.title.toLowerCase().replace(/\s/g, '-')}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <link.icon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{link.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{link.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {quickStats.map((stat, index) => (
          <Card 
            key={index} 
            className="bg-white dark:bg-gray-800/90 backdrop-blur-sm border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-2xl cursor-pointer hover:shadow-[0_8px_16px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-1"
            onClick={() => setLocation(stat.link)}
            data-testid={`card-quick-stat-${index}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl ${stat.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{stat.count}</h3>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white mb-0.5">{stat.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stat.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Chart & US Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Chart */}
        <Card className="bg-white dark:bg-gray-800/90 backdrop-blur-sm border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              Monthly Performance Overview
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">Total Policies and Total Customers (applicants only) by policy start date</p>
          </CardHeader>
          <CardContent>
            {monthlyData?.data && monthlyData.data.length > 0 ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg">
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
                  
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 p-4 text-white shadow-lg">
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
                  
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg">
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

                {/* Line Chart */}
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPolicies" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
                    <Line 
                      type="monotone" 
                      dataKey="policies" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      name="Total Policies"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="customers" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      dot={{ fill: '#06b6d4', r: 4 }}
                      name="Total Customers"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl mx-4 mb-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                  <BarChart3 className="h-10 w-10 text-slate-400 dark:text-slate-400" />
                </div>
                <p className="text-base font-medium text-gray-600 dark:text-gray-300">No data available</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Performance data will appear here once you have policies</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* US Map */}
        <Card className="bg-white dark:bg-gray-800/90 backdrop-blur-sm border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-800/20 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              Interactive US Heat Map
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">Hover over states to see customer distribution and statistics</p>
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
                    projectionConfig={{ scale: 1100 }}
                    className="w-full h-[480px]"
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
                                  setHoveredState({ name: displayName, count: count, percentage: Number(percentage) });
                                }}
                                onMouseLeave={() => {
                                  setHoveredState(null);
                                }}
                                style={{
                                  default: { outline: 'none' },
                                  hover: { fill: count > 0 ? "#1e40af" : "#e5e7eb", outline: 'none', cursor: 'pointer' },
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
                      style={{ left: mousePosition.x + 15, top: mousePosition.y - 60 }}
                    >
                      <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl min-w-[200px]">
                        <div className="font-bold text-base mb-2">{hoveredState.name}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Customers:</span>
                            <span className="font-bold text-cyan-400">{hoveredState.count}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Percentage:</span>
                            <span className="font-bold text-green-400">{hoveredState.percentage}%</span>
                          </div>
                        </div>
                      </div>
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
        <Card className="bg-white dark:bg-gray-800/90 backdrop-blur-sm border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-800/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              Agents Leaderboard (Top 5)
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">Top performing agents by policies and applicants</p>
          </CardHeader>
          <CardContent>
            {(agentsData?.agents || []).length > 0 ? (
              <div className="space-y-3">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="col-span-6 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Agent</div>
                  <div className="col-span-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">Policies</div>
                  <div className="col-span-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">Applicants</div>
                </div>

                {/* Table Rows */}
                {(agentsData?.agents || []).slice(0, 5).map((agent, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg px-2 transition-colors">
                    <div className="col-span-6 flex items-center gap-2">
                      {agent.avatar ? (
                        <img src={agent.avatar} alt={agent.name} className="w-8 h-8 rounded-full object-cover shadow-md border-2 border-white dark:border-gray-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{agent.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{idx === 0 ? '1st place' : idx === 1 ? '2nd place' : idx === 2 ? '3rd place' : `${idx + 1}th place`}</p>
                      </div>
                    </div>
                    <div className="col-span-3 text-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{agent.policies}</span>
                    </div>
                    <div className="col-span-3 text-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{agent.applicants}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">No agents data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Type Donut */}
        <Card className="bg-white dark:bg-gray-800/90 backdrop-blur-sm border border-slate-100 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/40 dark:to-orange-800/20 flex items-center justify-center">
                <PieChart className="h-5 w-5 text-orange-600" />
              </div>
              Policies by Product Type (Top 10)
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">Distribution of policies grouped by product category</p>
          </CardHeader>
          <CardContent>
            {analyticsData?.byProductType && analyticsData.byProductType.length > 0 ? (
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width="60%" height={280}>
                  <RechartsPie data={analyticsData.byProductType.slice(0, 10)}>
                    <Pie 
                      data={analyticsData.byProductType.slice(0, 10)} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={65} 
                      outerRadius={110} 
                      dataKey="count"
                      paddingAngle={3}
                      label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {analyticsData.byProductType.slice(0, 10).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }} />
                  </RechartsPie>
                </ResponsiveContainer>
                
                <div className="flex-1 space-y-2">
                  {analyticsData.byProductType.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.type}</p>
                      </div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">{item.count}</div>
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
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Policies per carrier (Top 10)</CardTitle>
            <p className="text-xs text-gray-500 mt-1">This is how your policies are segmented by insurance company</p>
          </CardHeader>
          <CardContent>
            {(carriersData?.carriers || []).length > 0 ? (
              <div className="space-y-1">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="col-span-5 text-xs font-semibold text-gray-500 dark:text-gray-400">Insurance company</div>
                  <div className="col-span-4 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Policies</div>
                  <div className="col-span-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Percentage</div>
                </div>

                {/* Table Rows */}
                {(() => {
                  const totalPolicies = carriersData?.carriers.reduce((sum, c) => sum + c.policies, 0) || 1;
                  return (carriersData?.carriers || []).slice(0, 10).map((carrier, idx) => {
                    const percentage = ((carrier.policies / totalPolicies) * 100).toFixed(2);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg px-2 transition-colors">
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{idx + 1}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate ml-2" title={carrier.carrier}>{carrier.carrier}</p>
                        </div>
                        <div className="col-span-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{carrier.policies}</span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{percentage}%</span>
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
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Applicants per carrier (Top 10)</CardTitle>
            <p className="text-xs text-gray-500 mt-1">This is how your applicants are segmented by insurance company</p>
          </CardHeader>
          <CardContent>
            {(carriersData?.carriers || []).length > 0 ? (
              <div className="space-y-1">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="col-span-5 text-xs font-semibold text-gray-500 dark:text-gray-400">Insurance company</div>
                  <div className="col-span-4 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Applicants</div>
                  <div className="col-span-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Percentage</div>
                </div>

                {/* Table Rows */}
                {(() => {
                  const sortedByApplicants = [...(carriersData?.carriers || [])].sort((a, b) => b.applicants - a.applicants);
                  const totalApplicants = sortedByApplicants.reduce((sum, c) => sum + c.applicants, 0) || 1;
                  return sortedByApplicants.slice(0, 10).map((carrier, idx) => {
                    const percentage = ((carrier.applicants / totalApplicants) * 100).toFixed(2);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg px-2 transition-colors">
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{idx + 1}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate ml-2" title={carrier.carrier}>{carrier.carrier}</p>
                        </div>
                        <div className="col-span-4 text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{carrier.applicants}</span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{percentage}%</span>
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
