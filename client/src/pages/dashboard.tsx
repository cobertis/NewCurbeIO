import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, BarChart3, PieChart, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback } from "react";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
  quotes: number;
}

interface AgentLeaderboard {
  agents: Array<{ name: string; count: number }>;
}

const CHART_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'notification_update' || message.type === 'dashboard_update' || message.type === 'data_invalidation') {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }
  }, [queryClient]);
  
  useWebSocket(handleWebSocketMessage);
  
  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: analyticsData } = useQuery<PoliciesAnalytics>({
    queryKey: ["/api/policies-analytics"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: monthlyData } = useQuery<{ data: MonthlyData[] }>({
    queryKey: ["/api/dashboard-monthly"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: agentsData } = useQuery<AgentLeaderboard>({
    queryKey: ["/api/dashboard-agents"],
    refetchInterval: 5 * 60 * 1000,
  });

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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quickStats.map((stat, index) => (
          <Card 
            key={index} 
            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
            onClick={() => setLocation(stat.link)}
            data-testid={`card-quick-stat-${index}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-11 h-11 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{stat.count}</h3>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">{stat.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stat.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Chart */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Policies effective each month
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Number of policies vs applicants grouped by month</p>
        </CardHeader>
        <CardContent>
          {monthlyData?.data && monthlyData.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", color: "#fff" }} />
                <Legend />
                <Line type="monotone" dataKey="policies" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} name="Policies" />
                <Line type="monotone" dataKey="quotes" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4" }} name="Applicants" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-400">Loading...</div>
          )}
        </CardContent>
      </Card>

      {/* Agents & Product Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Leaderboard */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agents leaderboard (Top 5)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Agents with most sales this month / year</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(agentsData?.agents || []).length > 0 ? (
                (agentsData?.agents || []).slice(0, 5).map((agent, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{agent.name}</p>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{agent.count}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No agents data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Type Donut */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Policies by Product Type (Top 10)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Distribution of policies grouped by product category</p>
          </CardHeader>
          <CardContent>
            {analyticsData?.byProductType && analyticsData.byProductType.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie data={analyticsData.byProductType.slice(0, 10)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="count">
                  {analyticsData.byProductType.slice(0, 10).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No product data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* States & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* States Table */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Policies per US state (Top 10)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Where your clients are located</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(analyticsData?.byState || []).slice(0, 10).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-xs font-semibold text-gray-400 w-5 text-center">{idx + 1}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.state}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.count}</span>
                    <span className="text-xs text-gray-500 ml-2">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Policies per status (Top 10)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">What is the status of your policies</p>
          </CardHeader>
          <CardContent>
            {analyticsData?.byStatus && analyticsData.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie data={analyticsData.byStatus.slice(0, 10)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="count">
                  {analyticsData.byStatus.slice(0, 10).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No status data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
