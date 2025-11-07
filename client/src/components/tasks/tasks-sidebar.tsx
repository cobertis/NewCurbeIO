import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckSquare, Bell, Clock, ListTodo, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task, StandaloneReminder } from "@shared/schema";

interface TasksSidebarProps {
  tasks: Task[];
  reminders: StandaloneReminder[];
  activeTab: "tasks" | "reminders";
  onTabChange: (tab: "tasks" | "reminders") => void;
}

export function TasksSidebar({ tasks, reminders, activeTab, onTabChange }: TasksSidebarProps) {
  // Calculate task stats
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(task => task.status === "pending").length;
  
  // Overdue tasks: due date is in the past and status is not completed or cancelled
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = tasks.filter(task => {
    if (task.status === "completed" || task.status === "cancelled") return false;
    const dueDate = new Date(task.dueDate + "T00:00:00");
    return dueDate < today;
  }).length;

  // Calculate reminder stats
  const totalReminders = reminders.length;
  const pendingReminders = reminders.filter(r => r.status === "pending").length;
  const overdueReminders = reminders.filter(r => {
    if (r.status === "completed") return false;
    const dueDate = new Date(r.dueDate + "T00:00:00");
    return dueDate < today;
  }).length;

  return (
    <div className="w-full lg:w-64 flex-shrink-0 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tasks and Reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as "tasks" | "reminders")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tasks" data-testid="tab-tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="reminders" data-testid="tab-reminders" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Reminders
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total {activeTab === "tasks" ? "Tasks" : "Reminders"}</span>
              </div>
              <Badge variant="secondary" data-testid={`badge-total-${activeTab}`}>
                {activeTab === "tasks" ? totalTasks : totalReminders}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Pending</span>
              </div>
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" data-testid={`badge-pending-${activeTab}`}>
                {activeTab === "tasks" ? pendingTasks : pendingReminders}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Overdue</span>
              </div>
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20" data-testid={`badge-overdue-${activeTab}`}>
                {activeTab === "tasks" ? overdueTasks : overdueReminders}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
