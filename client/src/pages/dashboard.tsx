import { Users, Building2, TrendingUp, Activity, ChevronDown, BarChart3, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

const recentActivity = [
  { name: "Ucstart", code: "Blxtued", amount: "$0.00 9GDx nry", count: "M O 4188", change: "E5.0%", status: "success" },
  { name: "Whit Exonce Linc", code: "", amount: "", count: "", change: "", status: "error" },
  { name: "Dampointer", code: "RGOX CTY 20 0u", amount: "", count: "7.7/0 (55)", change: "6.9%", status: "success" },
  { name: "ELGCCS", code: "67 00F S'teku", amount: "$5.5Au", count: "IP 995", change: "6.9%", status: "warning" },
];

interface Stats {
  totalUsers: number;
  adminCount: number;
  moderatorCount: number;
  viewerCount: number;
}

export default function Dashboard() {
  const { data: statsData } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const totalUsers = statsData?.totalUsers || 0;
  const adminCount = statsData?.adminCount || 0;
  const moderatorCount = statsData?.moderatorCount || 0;
  const viewerCount = statsData?.viewerCount || 0;

  const quickStats = [
    {
      title: "Bluudtles",
      subtitle: "Cloud coloniary cremele",
      icon: BarChart3,
      color: "bg-blue-500",
    },
    {
      title: "Quentry",
      subtitle: "3 string plansise slaxh",
      icon: Activity,
      color: "bg-cyan-500",
    },
    {
      title: "Mackenurs",
      subtitle: "du-aligned stallons",
      icon: TrendingUp,
      color: "bg-blue-600",
    },
    {
      title: "Real",
      subtitle: "Ixeguan on et apuis",
      icon: PieChart,
      color: "bg-gray-400",
    },
    {
      title: "Pocdefts",
      subtitle: "Dialuier greenwigh",
      icon: Building2,
      color: "bg-blue-400",
    },
    {
      title: "Méhres",
      subtitle: "d. Aeep",
      icon: Users,
      color: "bg-blue-500",
    },
  ];

  const monthlyData = [
    { month: "1.8", value: 20 },
    { month: "2.0", value: 15 },
    { month: "2.11", value: 18 },
    { month: "3.15", value: 22 },
    { month: "4.1", value: 10 },
    { month: "5.0", value: 8 },
    { month: "6.12", value: 25 },
    { month: "7.1", value: 85 },
    { month: "8.9", value: 95 },
    { month: "9.7", value: 88 },
    { month: "10.5", value: 92 },
    { month: "11.3", value: 78 },
    { month: "12.0", value: 85 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vista general del sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickStats.map((stat, index) => (
          <Card key={index} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow" data-testid={`card-quick-stat-${index}`}>
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
              Time to enery
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Netrinosa
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Dash <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500 mb-1">1.5</div>
            <div className="text-xs text-gray-500 mb-1">105</div>
            <div className="text-xs text-gray-500 mb-1">1.0</div>
            <div className="text-xs text-gray-500 mb-1">50s</div>
            <div className="text-xs text-gray-500 mb-4">0</div>
            <div className="h-48 flex items-end justify-between gap-1 relative">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-xs text-gray-400 mb-1">{index === 6 ? "Peternity" : ""}</div>
                  <div
                    className={`w-full ${index === 6 || index === 7 || index === 8 ? 'bg-blue-400' : 'bg-blue-300'} rounded-sm transition-all duration-300`}
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
              Rely TimeDaahle caate Data
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-white hover:bg-white/20 self-start mt-2">
              Launch <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-white/10 rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Ocupmaster</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Om</p>
                <p className="text-xs text-white/70">Consistelet</p>
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
              Occuposs
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
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Temperature Datigns..</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Namsburg <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col items-center">
                  <p className="text-xs text-gray-500 mb-2">Ocupation</p>
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
                        strokeDasharray={`${2 * Math.PI * 56 * 0.77} ${2 * Math.PI * 56}`}
                        className="text-blue-500 transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">77/1</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">48%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-red-600">GB 6.0%</span>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <p className="text-xs text-gray-500 mb-2">Later</p>
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
                        strokeDasharray={`${2 * Math.PI * 56 * 0.84} ${2 * Math.PI * 56}`}
                        className="text-blue-500 transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">1.5.6 K</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">13%</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-red-600">SD 2.3 K</span>
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
