import { Users, Building2, TrendingUp, Activity, ChevronDown, BarChart3, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

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
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  const { data: statsData } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
  });

  const totalUsers = statsData?.totalUsers || 0;
  const adminCount = statsData?.adminCount || 0;
  const memberCount = statsData?.memberCount || 0;
  const viewerCount = statsData?.viewerCount || 0;
  const companyCount = statsData?.companyCount || 0;
  const revenue = statsData?.revenue || 0;
  const growthRate = statsData?.growthRate || 0;

  const quickStats = [
    {
      title: "Total Users",
      subtitle: `${totalUsers} active users`,
      icon: Users,
      color: "bg-blue-500",
      link: "/users",
    },
    {
      title: "Admins",
      subtitle: `${adminCount} administrators`,
      icon: Activity,
      color: "bg-cyan-500",
    },
    {
      title: "Revenue",
      subtitle: `$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this month`,
      icon: TrendingUp,
      color: "bg-blue-600",
    },
    {
      title: "Growth",
      subtitle: `${growthRate > 0 ? '+' : ''}${growthRate}% vs last month`,
      icon: PieChart,
      color: "bg-gray-400",
    },
    ...(companyCount > 0 ? [{
      title: "Companies",
      subtitle: `${companyCount} active companies`,
      icon: Building2,
      color: "bg-blue-400",
      link: "/companies",
    }] : []),
    {
      title: "Members",
      subtitle: `${memberCount + viewerCount} members`,
      icon: Users,
      color: "bg-blue-500",
    },
  ];

  const monthlyData = [
    { month: "Jan", value: 20 },
    { month: "Feb", value: 15 },
    { month: "Mar", value: 18 },
    { month: "Apr", value: 22 },
    { month: "May", value: 10 },
    { month: "Jun", value: 8 },
    { month: "Jul", value: 25 },
    { month: "Aug", value: 85 },
    { month: "Sep", value: 95 },
    { month: "Oct", value: 88 },
    { month: "Nov", value: 92 },
    { month: "Dec", value: 78 },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickStats.map((stat, index) => (
          <Card 
            key={index} 
            className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow ${
              stat.link ? 'cursor-pointer hover-elevate active-elevate-2' : ''
            }`}
            onClick={stat.link ? () => setLocation(stat.link) : undefined}
            data-testid={`card-quick-stat-${index}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ${stat.color} flex items-center justify-center flex-shrink-0`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{stat.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{stat.subtitle}</p>
                </div>
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
    </div>
  );
}
