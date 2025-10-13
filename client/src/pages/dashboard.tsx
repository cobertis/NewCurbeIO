import { Users, TrendingUp, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const stats = [
  {
    title: "Total Users",
    value: "2,543",
    change: "+12.5%",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Revenue",
    value: "$45,231",
    change: "+8.2%",
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-600/10",
  },
  {
    title: "Active Sessions",
    value: "1,234",
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

const recentActivity = [
  { name: "Brandon Ingram", status: "Online", percentage: "9.3%" },
  { name: "Joe Ingram", status: "Online", percentage: "8.2%" },
  { name: "Alice Red", status: "Away", percentage: "6.8%" },
  { name: "Sam Rogers", status: "Busy", percentage: "5.1%" },
  { name: "Andrew Wiggins", status: "Offline", percentage: "4.9%" },
];

export default function Dashboard() {
  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Welcome back! Here's your overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-filter">
            Filter
          </Button>
          <Button size="sm" data-testid="button-export">
            Export
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
                ↑ {stat.change} vs last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Limit Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Limit Time</span>
                <span className="text-sm font-medium">75%</span>
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
              <div className="text-center text-sm text-muted-foreground">
                Revenue target achieved
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Top Performers</CardTitle>
            <span className="text-xs text-gray-500 dark:text-gray-400">By Progress Time Infinite</span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={activity.name}
                  className="flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-3 -mx-2 transition-colors"
                  data-testid={`row-performer-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {activity.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{activity.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-primary">{activity.percentage}</span>
                    <div className="w-20 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: activity.percentage }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Revenue Badge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="w-full max-w-3xl">
              <div className="flex items-end justify-between gap-2 h-48">
                {[
                  { height: "70%", label: "Mon" },
                  { height: "85%", label: "Tue" },
                  { height: "60%", label: "Wed" },
                  { height: "95%", label: "Thu" },
                  { height: "75%", label: "Fri" },
                  { height: "50%", label: "Sat" },
                  { height: "40%", label: "Sun" },
                ].map((bar, index) => (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: bar.height }}>
                      <div className="absolute bottom-0 w-full bg-primary rounded-t-lg transition-all duration-500" style={{ height: "75%" }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
