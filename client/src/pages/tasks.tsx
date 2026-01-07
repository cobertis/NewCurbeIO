import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/loading-spinner";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { CreateReminderDialog } from "@/components/tasks/create-reminder-dialog";
import { TasksSidebar } from "@/components/tasks/tasks-sidebar";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Filter, MoreHorizontal, Pencil, CheckCircle, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Task, InsertTask, User, StandaloneReminder, InsertStandaloneReminder } from "@shared/schema";

export default function Tasks() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"tasks" | "reminders">("tasks");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: tasksData, isLoading: isLoadingTasks } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/tasks", { hideCompleted, showMyTasksOnly }],
  });

  const { data: remindersData, isLoading: isLoadingReminders } = useQuery<{ reminders: StandaloneReminder[] }>({
    queryKey: ["/api/standalone-reminders"],
  });

  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  const currentUser = sessionData?.user;
  const allTasks = tasksData?.tasks || [];
  const allReminders = remindersData?.reminders || [];
  const allUsers = usersData?.users || [];
  
  const isLoading = activeTab === "tasks" ? isLoadingTasks : isLoadingReminders;

  // Create a map of user IDs to user objects for quick lookup
  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach(user => map.set(user.id, user));
    return map;
  }, [allUsers]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = task.title?.toLowerCase() || "";
        const description = task.description?.toLowerCase() || "";
        const assignee = task.assigneeId ? usersById.get(task.assigneeId) : null;
        const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}`.toLowerCase() : "";

        if (!title.includes(query) && !description.includes(query) && !assigneeName.includes(query)) {
          return false;
        }
      }

      // Hide completed filter
      if (hideCompleted && task.status === "completed") {
        return false;
      }

      // Show my tasks only filter
      if (showMyTasksOnly && currentUser && task.assigneeId !== currentUser.id) {
        return false;
      }

      return true;
    });
  }, [allTasks, searchQuery, hideCompleted, showMyTasksOnly, currentUser, usersById]);

  // Filter reminders
  const filteredReminders = useMemo(() => {
    return allReminders.filter(reminder => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const title = reminder.title?.toLowerCase() || "";
        const description = reminder.description?.toLowerCase() || "";

        if (!title.includes(query) && !description.includes(query)) {
          return false;
        }
      }

      // Hide completed filter
      if (hideCompleted && reminder.status === "completed") {
        return false;
      }

      // Show my reminders only filter  
      if (showMyTasksOnly && currentUser && reminder.createdBy !== currentUser.id) {
        return false;
      }

      return true;
    });
  }, [allReminders, searchQuery, hideCompleted, showMyTasksOnly, currentUser]);

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: InsertTask) => {
      return await apiRequest("POST", "/api/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/tasks"
      });
      setCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: InsertStandaloneReminder) => {
      return await apiRequest("POST", "/api/standalone-reminders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/standalone-reminders"
      });
      setCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Reminder created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/tasks"
      });
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  // Mark task as complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/tasks"
      });
      toast({
        title: "Success",
        description: "Task marked as complete",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(task => task.id)));
    }
  };

  const handleSelectTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "pending":
        return "outline";
      case "in_progress":
        return "default";
      case "completed":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20";
      case "in_progress":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20";
      case "cancelled":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20 hover:bg-gray-500/20";
      default:
        return "";
    }
  };

  const getPriorityBadgeColor = (priority: string): string => {
    switch (priority) {
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20";
      case "medium":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20";
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20";
      default:
        return "";
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr + "T00:00:00"), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getUserInitials = (user: User | undefined): string => {
    if (!user) return "?";
    return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || user.email[0].toUpperCase();
  };

  const getUserDisplayName = (user: User | undefined): string => {
    if (!user) return "Unassigned";
    // Check if this is the current user
    if (currentUser && user.id === currentUser.id) {
      return "Myself";
    }
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
  };

  if (isLoading) {
    return <LoadingSpinner message={`Loading ${activeTab}...`} fullScreen={false} />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar - Hidden on mobile */}
        <div className="hidden lg:block">
          <TasksSidebar 
            tasks={allTasks} 
            reminders={allReminders}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="heading-tasks">
                {activeTab === "tasks" ? "Tasks" : "Reminders"}
              </h1>
              <p className="text-muted-foreground">
                {activeTab === "tasks" ? "Manage your tasks and reminders" : "Manage your standalone reminders"}
              </p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-new-task">
              <Plus className="h-4 w-4 mr-2" />
              {activeTab === "tasks" ? "New Task" : "New Reminder"}
            </Button>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type here to search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-tasks"
                  />
                </div>
                <Button variant="default" className="bg-green-600 hover:bg-green-700" data-testid="button-search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button variant="default" className="bg-purple-600 hover:bg-purple-700" data-testid="button-filters">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>

              {/* Filter Toggles */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hide-completed"
                    checked={hideCompleted}
                    onCheckedChange={(checked) => setHideCompleted(checked as boolean)}
                    data-testid="checkbox-hide-completed"
                  />
                  <label
                    htmlFor="hide-completed"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Hide completed tasks
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-my-tasks"
                    checked={showMyTasksOnly}
                    onCheckedChange={(checked) => setShowMyTasksOnly(checked as boolean)}
                    data-testid="checkbox-show-my-tasks"
                  />
                  <label
                    htmlFor="show-my-tasks"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Show my tasks only
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks/Reminders Table - Desktop */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              {activeTab === "tasks" ? (
                filteredTasks.length === 0 ? (
                  <div className="text-center py-12" data-testid="empty-state-tasks">
                    <p className="text-muted-foreground">
                      There are no records to show here. Please, start a new search
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                            onCheckedChange={handleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="w-12">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => {
                      const assignee = task.assigneeId ? usersById.get(task.assigneeId) : undefined;
                      return (
                        <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTasks.has(task.id)}
                              onCheckedChange={() => handleSelectTask(task.id)}
                              data-testid={`checkbox-task-${task.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={assignee?.avatar || undefined} />
                                <AvatarFallback>{getUserInitials(assignee)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium" data-testid={`text-assignee-${task.id}`}>
                                {getUserDisplayName(assignee)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-md">
                              <div className="font-medium" data-testid={`text-title-${task.id}`}>{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-muted-foreground truncate">{task.description}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusBadgeVariant(task.status)}
                              className={getStatusBadgeColor(task.status)}
                              data-testid={`badge-status-${task.id}`}
                            >
                              {task.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getPriorityBadgeColor(task.priority)}
                              data-testid={`badge-priority-${task.id}`}
                            >
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-due-date-${task.id}`}>
                            {formatDate(task.dueDate)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-actions-${task.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem data-testid={`menu-edit-${task.id}`}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => markCompleteMutation.mutate(task.id)}
                                  disabled={task.status === "completed"}
                                  data-testid={`menu-complete-${task.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Mark Complete
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => deleteTaskMutation.mutate(task.id)}
                                  className="text-red-600"
                                  data-testid={`menu-delete-${task.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                )
              ) : (
                filteredReminders.length === 0 ? (
                  <div className="text-center py-12" data-testid="empty-state-reminders">
                    <p className="text-muted-foreground">
                      There are no reminders to show here. Please, start a new search
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Created By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReminders.map((reminder: any) => {
                        const creator = usersById.get(reminder.createdBy);
                        return (
                          <TableRow key={reminder.id} data-testid={`row-reminder-${reminder.id}`}>
                            <TableCell>
                              <div className="max-w-md">
                                <div className="font-medium" data-testid={`text-title-${reminder.id}`}>{reminder.title}</div>
                                {reminder.description && (
                                  <div className="text-sm text-muted-foreground truncate">{reminder.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getStatusBadgeVariant(reminder.status)}
                                className={getStatusBadgeColor(reminder.status)}
                                data-testid={`badge-status-${reminder.id}`}
                              >
                                {reminder.status.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={getPriorityBadgeColor(reminder.priority)}
                                data-testid={`badge-priority-${reminder.id}`}
                              >
                                {reminder.priority}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`text-due-date-${reminder.id}`}>
                              {formatDate(reminder.dueDate)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={creator?.avatar || undefined} />
                                  <AvatarFallback>{getUserInitials(creator)}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium" data-testid={`text-creator-${reminder.id}`}>
                                  {getUserDisplayName(creator)}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )
              )}
            </CardContent>
          </Card>

          {/* Tasks/Reminders Cards - Mobile */}
          <div className="md:hidden space-y-4">
            {activeTab === "tasks" ? (
              filteredTasks.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12" data-testid="empty-state-tasks-mobile">
                    <p className="text-muted-foreground">
                      There are no records to show here. Please, start a new search
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredTasks.map((task) => {
                const assignee = task.assigneeId ? usersById.get(task.assigneeId) : undefined;
                return (
                  <Card key={task.id} data-testid={`card-task-${task.id}`}>
                    <CardContent className="pt-6 space-y-4">
                      {/* Header with checkbox and actions */}
                      <div className="flex items-start justify-between">
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => handleSelectTask(task.id)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => markCompleteMutation.mutate(task.id)}
                              disabled={task.status === "completed"}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Title and Description */}
                      <div>
                        <h3 className="font-semibold">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                      </div>

                      {/* Assignee */}
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={assignee?.avatar || undefined} />
                          <AvatarFallback>{getUserInitials(assignee)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {getUserDisplayName(assignee)}
                        </span>
                      </div>

                      {/* Status, Priority, Due Date */}
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={getStatusBadgeVariant(task.status)}
                          className={getStatusBadgeColor(task.status)}
                        >
                          {task.status.replace("_", " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={getPriorityBadgeColor(task.priority)}
                        >
                          {task.priority}
                        </Badge>
                        <Badge variant="outline">
                          Due: {formatDate(task.dueDate)}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
              )
            ) : (
              filteredReminders.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12" data-testid="empty-state-reminders-mobile">
                    <p className="text-muted-foreground">
                      There are no reminders to show here. Please, start a new search
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredReminders.map((reminder: any) => {
                  const creator = usersById.get(reminder.createdBy);
                  return (
                    <Card key={reminder.id} data-testid={`card-reminder-${reminder.id}`}>
                      <CardContent className="pt-6 space-y-4">
                        {/* Title and Description */}
                        <div>
                          <h3 className="font-semibold">{reminder.title}</h3>
                          {reminder.description && (
                            <p className="text-sm text-muted-foreground mt-1">{reminder.description}</p>
                          )}
                        </div>

                        {/* Creator */}
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={creator?.avatar || undefined} />
                            <AvatarFallback>{getUserInitials(creator)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {getUserDisplayName(creator)}
                          </span>
                        </div>

                        {/* Status, Priority, Due Date */}
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={getStatusBadgeVariant(reminder.status)}
                            className={getStatusBadgeColor(reminder.status)}
                          >
                            {reminder.status.replace("_", " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={getPriorityBadgeColor(reminder.priority)}
                          >
                            {reminder.priority}
                          </Badge>
                          <Badge variant="outline">
                            Due: {formatDate(reminder.dueDate)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )
            )}
          </div>
        </div>
      </div>

      {/* Create Dialog - Task or Reminder */}
      {activeTab === "tasks" ? (
        <CreateTaskDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={(data) => createTaskMutation.mutate(data)}
          isPending={createTaskMutation.isPending}
        />
      ) : (
        <CreateReminderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={(data) => createReminderMutation.mutate(data)}
          isPending={createReminderMutation.isPending}
        />
      )}
    </div>
  );
}
