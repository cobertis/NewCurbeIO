import { TrendingUp, Users, Eye, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  {
    title: "Page Views",
    value: "12,345",
    change: "+15.3%",
    icon: Eye,
  },
  {
    title: "Unique Visitors",
    value: "8,432",
    change: "+8.7%",
    icon: Users,
  },
  {
    title: "Click Rate",
    value: "24.5%",
    change: "+12.1%",
    icon: MousePointerClick,
  },
  {
    title: "Conversion",
    value: "3.2%",
    change: "+2.4%",
    icon: TrendingUp,
  },
];

export default function Analytics() {
  return (
    <div className="flex flex-col gamin-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <metric.icon className="h-6 w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {metric.title}
              </p>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metric.value}
              </div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ↑ {metric.change} vs last week
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Traffic Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            <p>Analytics chart will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
