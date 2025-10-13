import { Users, TrendingUp, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

const recentActivity = [
  { name: "Brandon Ingram", status: "Online", percentage: "9.3%" },
  { name: "Joe Ingram", status: "Online", percentage: "8.2%" },
  { name: "Alice Red", status: "Away", percentage: "6.8%" },
  { name: "Sam Rogers", status: "Busy", percentage: "5.1%" },
  { name: "Andrew Wiggins", status: "Offline", percentage: "4.9%" },
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
  const activeCount = statsData?.totalUsers || 0;

  const stats = [
    {
      title: "Total Users",
      value: totalUsers.toString(),
      change: "+12.5%",
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Admins",
      value: adminCount.toString(),
      change: "+8.2%",
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
    },
    {
      title: "Active Users",
      value: activeCount.toString(),
      change: "+23.1%",
      icon: Activity,
      color: "text-amber-600",
      bgColor: "bg-amber-600/10",
    },
    {
      title: "Growth",
      value: "94.5%",
      change: "+5.4%",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
    },
  ];

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Bienvenido! Aquí está tu resumen.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-filter">
            Filtrar
          </Button>
          <Button size="sm" data-testid="button-export">
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {stat.title}
              </p>
              <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid={`text-${stat.title.toLowerCase().replace(/\s+/g, '-')}-value`}>
                {stat.value}
              </div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400" data-testid={`text-${stat.title.toLowerCase().replace(/\s+/g, '-')}-change`}>
                ↑ {stat.change} vs mes pasado
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Distribución de Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total de Usuarios</span>
                <span className="text-sm font-medium">{totalUsers}</span>
              </div>
              <div className="relative h-48 flex items-center justify-center">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 70 * 0.75} ${2 * Math.PI * 70}`}
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold font-mono">75%</span>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-muted-foreground">Activos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-muted"></div>
                  <span className="text-muted-foreground">Inactivos</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  data-testid={`activity-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.status}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{item.percentage}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Estadísticas Mensuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2 px-4">
            {[65, 85, 45, 90, 60, 75, 95, 70, 80, 55, 88, 92].map((height, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-primary/80 rounded-t-sm transition-all duration-500 hover:bg-primary"
                  style={{ height: `${height}%` }}
                  data-testid={`bar-${index}`}
                ></div>
                <span className="text-xs text-muted-foreground">{index + 1}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
