import { Users, Building2, TrendingUp, Activity, ChevronDown, BarChart3, PieChart, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback } from "react";

const recentActivity = [
  { name: "User Created", code: "admin@company.com", amount: "$1,250.00", count: "ID 4188", change: "+5.0%", status: "success" },
  { name: "Login Failed", code: "", amount: "", count: "", change: "", status: "error" },
  { name: "Data Import", code: "CSV Import 2024", amount: "", count: "740 rows", change: "+8.9%", status: "success" },
  { name: "API Call", code: "GET /api/users", amount: "$5.50", count: "IP 195", change: "+6.9%", status: "warning" },
];

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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // WebSocket handler for real-time dashboard updates
  const handleWebSocketMessage = useCallback((message: any) => {
    // Listen for events that should trigger dashboard refresh
    if (
      message.type === 'notification_update' ||
      message.type === 'dashboard_update' ||
      message.type === 'data_invalidation'
    ) {
      // Invalidate dashboard stats to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }
  }, [queryClient]);
  
  // Connect to WebSocket for real-time updates
  useWebSocket(handleWebSocketMessage);
  
  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
    // No polling! Updates happen via WebSocket events only
    // Keep a long fallback interval (5 minutes) just in case WebSocket fails
    refetchInterval: 5 * 60 * 1000, // 5 minutes fallback only
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

  const totalUsers = statsData?.totalUsers || 0;
  const adminCount = statsData?.adminCount || 0;
  const memberCount = statsData?.memberCount || 0;
  const viewerCount = statsData?.viewerCount || 0;
  const companyCount = statsData?.companyCount || 0;
  const revenue = statsData?.revenue || 0;
  const growthRate = statsData?.growthRate || 0;
  const pendingTasks = statsData?.pendingTasks || 0;
  const birthdaysThisWeek = statsData?.birthdaysThisWeek || 0;
  const failedLoginAttempts = statsData?.failedLoginAttempts || 0;
  const newLeads = statsData?.newLeads || 0;

  // Get week date range for birthdays card
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

  const quickStats = [
    {
      count: pendingTasks,
      title: "Today's reminders",
      subtitle: format(today, 'EEEE, MMMM dd, yyyy'),
      icon: Bell,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      link: "/tasks",
    },
    {
      count: birthdaysThisWeek,
      title: "Birthdays this week",
      subtitle: `${format(startOfWeek, 'MMM dd, yyyy')} - ${format(endOfWeek, 'MMM dd, yyyy')}`,
      icon: Cake,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      link: "/calendar?initialView=listWeek",
    },
    {
      count: failedLoginAttempts,
      title: "Failed login",
      subtitle: "Last 14 days",
      icon: AlertTriangle,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      link: "/settings/sessions",
    },
    {
      count: newLeads,
      title: "New leads",
      subtitle: "Click here for more details",
      icon: UserPlus,
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
      link: "/leads",
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Monthly Performance
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                This Year
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                View <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between gap-1 relative">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full ${index >= 7 && index <= 9 ? 'bg-blue-400' : 'bg-blue-300'} rounded-sm transition-all duration-300`}
                    style={{ height: `${data.value}%` }}
                    data-testid={`bar-monthly-${index}`}
                  ></div>
                  <span className="text-xs text-gray-400">{data.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary text-white border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Featured Analytics
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-white hover:bg-white/20 self-start mt-2">
              Explore <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white/10 rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Active Companies</p>
                <p className="text-xs text-white/70">15 companies</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">API Calls</p>
                <p className="text-xs text-white/70">1.2M this month</p>
              </div>
            </div>
            <div className="h-20 bg-white/90 rounded-lg flex items-center justify-center">
              <Activity className="h-12 w-12 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Month <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  data-testid={`activity-item-${index}`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'success' ? 'bg-emerald-500' : 
                    item.status === 'error' ? 'bg-red-500' : 
                    'bg-amber-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                      {item.code && <ChevronDown className="h-3 w-3 text-gray-400" />}
                    </div>
                    {item.code && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.code}</p>}
                  </div>
                  {item.amount && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.amount}</p>
                    </div>
                  )}
                  {item.count && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{item.count}</Badge>
                      <span className={`text-sm font-medium ${
                        item.change.includes('-') ? 'text-red-600' : 'text-emerald-600'
                      }`}>{item.change}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">User Distribution</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                All Time <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col items-center">
                  <p className="text-xs text-gray-500 mb-2">By Role</p>
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        strokeDasharray={`${(adminCount / totalUsers) * 351} 351`}
                        className="text-blue-500"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        strokeDasharray={`${(viewerCount / totalUsers) * 351} 351`}
                        strokeDashoffset={`-${(adminCount / totalUsers) * 351}`}
                        className="text-cyan-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Admins ({adminCount})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Members ({viewerCount})</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <p className="text-xs text-gray-500 mb-2">By Status</p>
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        strokeDasharray="263 351"
                        className="text-emerald-500"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="currentColor"
                        strokeWidth="16"
                        fill="none"
                        strokeDasharray="88 351"
                        strokeDashoffset="-263"
                        className="text-red-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">75%</p>
                      <p className="text-xs text-gray-500">Active</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Active (75%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Inactive (25%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Monthly Comparison */}
      <Card className="col-span-1 lg:col-span-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Policies vs Applicants by Month
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Compare policies created and quotes this year</p>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end justify-between gap-1 relative">
            {(monthlyData?.data || []).map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="flex gap-0.5 items-end h-32 w-full justify-center">
                  <div
                    className="flex-1 bg-blue-400 rounded-t-sm transition-all duration-300 hover:bg-blue-500"
                    style={{ height: `${Math.max(5, (data.policies / 10) * 100)}%` }}
                    title={`Policies: ${data.policies}`}
                    data-testid={`bar-policies-${index}`}
                  ></div>
                  <div
                    className="flex-1 bg-cyan-400 rounded-t-sm transition-all duration-300 hover:bg-cyan-500"
                    style={{ height: `${Math.max(5, (data.quotes / 10) * 100)}%` }}
                    title={`Quotes: ${data.quotes}`}
                    data-testid={`bar-quotes-${index}`}
                  ></div>
                </div>
                <span className="text-xs text-gray-400">{data.month}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Policies</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyan-400 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Applicants</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents Leaderboard */}
      <Card className="col-span-1 lg:col-span-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-4 w-4" />
            Top Agents Leaderboard
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Agents by policies assigned</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(agentsData?.agents || []).slice(0, 8).map((agent, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{agent.name}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{agent.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                      style={{ width: `${(agent.count / (agentsData?.agents?.[0]?.count || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Type Breakdown */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Policies by Product Type
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Insurance types distribution</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(analyticsData?.byProductType || []).slice(0, 6).map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{item.type}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full"
                      style={{ width: `${(item.count / (analyticsData?.byProductType?.[0]?.count || 1)) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Policies Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Policies Per State */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Policies per US State (Top 10)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Where your clients are located</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(analyticsData?.byState || []).slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-center gap-3 py-2">
                  <div className="flex-shrink-0 w-6 text-center">
                    <span className="text-xs font-semibold text-gray-400">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.state}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full"
                        style={{ width: `${(item.count / (analyticsData?.byState?.[0]?.count || 1)) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Policies Per Status - Donut Chart */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Policies per Status
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">What is the status of your policies</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              {/* Donut Chart SVG */}
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-gray-200 dark:text-gray-700"
                />
                {(() => {
                  let cumulativeOffset = 0;
                  const circumference = 2 * Math.PI * 70;
                  const colors = [
                    "text-blue-500",
                    "text-cyan-500",
                    "text-emerald-500",
                    "text-yellow-500",
                    "text-orange-500",
                    "text-red-500",
                    "text-purple-500",
                    "text-pink-500",
                    "text-indigo-500",
                    "text-teal-500",
                  ];

                  return (analyticsData?.byStatus || []).map((item, idx) => {
                    const dasharray = (item.count / (analyticsData.totalPolicies || 1)) * circumference;
                    const offset = cumulativeOffset;
                    cumulativeOffset += dasharray;

                    return (
                      <circle
                        key={idx}
                        cx="80"
                        cy="80"
                        r="70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="20"
                        strokeDasharray={`${dasharray} ${circumference}`}
                        strokeDashoffset={-offset}
                        className={colors[idx % colors.length]}
                      />
                    );
                  });
                })()}
              </svg>

              {/* Legend */}
              <div className="mt-4 w-full space-y-1">
                {(analyticsData?.byStatus || []).slice(0, 5).map((item, idx) => {
                  const colors = [
                    "bg-blue-500",
                    "bg-cyan-500",
                    "bg-emerald-500",
                    "bg-yellow-500",
                    "bg-orange-500",
                  ];
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`}></div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 capitalize">
                        {item.status}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
