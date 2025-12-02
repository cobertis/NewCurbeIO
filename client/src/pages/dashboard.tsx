import { ChevronLeft, Plus, Upload, Calendar, Check, Archive, MessageSquare, MoreHorizontal, Star, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback, useState } from "react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer } from "recharts";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

interface AgentLeaderboard {
  agents: Array<{ name: string; avatar: string | null; policies: number; applicants: number }>;
}

interface WorkflowData {
  policyAssignment: Array<{ id: string; title: string; agent?: { name: string; avatar: string | null }; status: 'pending' | 'done' }>;
  statusReview: Array<{ id: string; title: string; status: 'pending' | 'done' | 'in_progress' }>;
  processing: Array<{ id: string; title: string; status: 'pending' | 'done' | 'in_progress'; hasEstimate?: boolean }>;
  pendingActions: Array<{ id: string; title: string; category: string }>;
}

interface RecentPolicy {
  id: string;
  policyNumber: string;
  status: string;
  startDate: string;
  endDate: string;
  agentName: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  'Active': { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-500/20' },
  'Pending': { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-500/20' },
  'Cancelled': { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-500/20' },
  'Executed': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-500/20' },
  'Scheduled': { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-500/20' },
  'Terminated': { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-500/20' },
  'Expired': { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-500/20' },
  'In Review': { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-500/20' },
  'Approved': { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-500/20' },
  'Rejected': { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-500/20' },
};

const getStatusColor = (status: string) => {
  return STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-500/20' };
};

function WorkflowCard({ 
  children, 
  hasCheck, 
  hasArchive, 
  hasChat,
  hasMore,
  className 
}: { 
  children: React.ReactNode; 
  hasCheck?: boolean;
  hasArchive?: boolean;
  hasChat?: boolean;
  hasMore?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(
      "bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 hover:shadow-md transition-shadow",
      className
    )}>
      {children}
      <div className="flex items-center gap-1.5 ml-auto">
        {hasCheck && (
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <Check className="w-3 h-3 text-gray-500" />
          </div>
        )}
        {hasArchive && (
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <Archive className="w-3 h-3 text-gray-500" />
          </div>
        )}
        {hasChat && (
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageSquare className="w-3 h-3 text-gray-500" />
          </div>
        )}
        {hasMore && (
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <MoreHorizontal className="w-3 h-3 text-gray-500" />
          </div>
        )}
      </div>
    </div>
  );
}

function TaskGridCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
      <p className="text-xs font-medium text-gray-900 leading-tight">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ConnectingLine({ from, to }: { from: string; to: string }) {
  return (
    <svg className="absolute pointer-events-none" style={{ width: '100%', height: '100%', left: 0, top: 0, zIndex: 0 }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
        </marker>
      </defs>
    </svg>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'notification_update' || message.type === 'dashboard_update' || message.type === 'data_invalidation') {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
    }
  }, [queryClient]);
  
  useWebSocket(handleWebSocketMessage);
  
  const { data: statsData, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery<PoliciesAnalytics>({
    queryKey: ["/api/policies-analytics"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: agentsData, isLoading: isLoadingAgents } = useQuery<AgentLeaderboard>({
    queryKey: ["/api/dashboard-agents"],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: recentPoliciesData, isLoading: isLoadingRecent } = useQuery<{ policies: RecentPolicy[] }>({
    queryKey: ["/api/dashboard-recent-policies"],
    refetchInterval: 5 * 60 * 1000,
  });

  const isLoading = isLoadingStats || isLoadingAnalytics || isLoadingAgents || isLoadingRecent;

  const agents = agentsData?.agents || [];
  const topAgents = agents.slice(0, 8);

  const statusData = analyticsData?.byStatus || [];
  const activeCount = statusData.find(s => s.status === 'Active')?.count || 0;
  const pendingCount = statusData.find(s => s.status === 'Pending')?.count || 0;
  const cancelledCount = statusData.find(s => s.status === 'Cancelled')?.count || 0;
  const terminatedCount = statusData.reduce((sum, s) => 
    (s.status === 'Terminated' || s.status === 'Expired') ? sum + s.count : sum, 0
  );

  const recentPolicies = recentPoliciesData?.policies || [];

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard data..." />;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]" data-testid="dashboard-container">
      <div className="max-w-[1600px] mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white shadow-sm hover:bg-gray-50"
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900" data-testid="text-page-title">
            Policy Journeys
          </h1>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Policy Management
              </CardTitle>
              <div className="flex items-center gap-6">
                <div className="flex items-center -space-x-2">
                  {topAgents.map((agent, idx) => (
                    <div key={idx} className="relative" data-testid={`avatar-agent-${idx}`}>
                      <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                        {agent.avatar ? (
                          <AvatarImage src={agent.avatar} alt={agent.name} />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-medium">
                          {agent.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {idx < 3 && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {idx >= 3 && idx < 6 && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center">
                          <span className="text-[8px] text-white font-bold">{idx - 2}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {agents.length > 8 && (
                    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center shadow-sm">
                      <span className="text-xs font-medium text-gray-600">+{agents.length - 8}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100" data-testid="button-add">
                    <Plus className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100" data-testid="button-upload">
                    <Upload className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100" data-testid="button-calendar">
                    <Calendar className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-4 gap-4 relative">
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#d1d5db" />
                  </marker>
                </defs>
                <path d="M 190 80 Q 220 80 235 80" stroke="#d1d5db" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
                <path d="M 420 80 Q 450 80 465 80" stroke="#d1d5db" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
                <path d="M 650 80 Q 680 80 695 80" stroke="#d1d5db" strokeWidth="2" fill="none" markerEnd="url(#arrow)" />
              </svg>

              <div className="space-y-3 relative z-10" data-testid="column-new-policies">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 text-center">
                  <div className="text-3xl font-bold text-blue-700">{pendingCount}</div>
                  <div className="text-xs text-blue-600 font-medium mt-1">New Policies</div>
                </div>
                <WorkflowCard hasCheck hasArchive>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-500 text-white text-xs">
                      {topAgents[0]?.name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-gray-700 flex-1">Assign to Agent</span>
                </WorkflowCard>
                <WorkflowCard hasCheck>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-gray-700 flex-1">Welcome Email</span>
                </WorkflowCard>
                <p className="text-xs font-medium text-gray-500 text-center pt-2">New Submissions</p>
              </div>

              <div className="space-y-3 relative z-10" data-testid="column-review">
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200 text-center">
                  <div className="text-3xl font-bold text-amber-700">{Math.round(pendingCount * 0.6)}</div>
                  <div className="text-xs text-amber-600 font-medium mt-1">Under Review</div>
                </div>
                <WorkflowCard hasCheck hasArchive>
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-gray-700 flex-1">Verify Coverage</span>
                </WorkflowCard>
                <WorkflowCard hasArchive hasMore>
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-medium text-gray-700 flex-1">Check Documents</span>
                </WorkflowCard>
                <p className="text-xs font-medium text-gray-500 text-center pt-2">Verification</p>
              </div>

              <div className="space-y-3 relative z-10" data-testid="column-active">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 text-center">
                  <div className="text-3xl font-bold text-emerald-700">{activeCount}</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">Active Policies</div>
                </div>
                <WorkflowCard hasCheck>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-gray-700 flex-1">Coverage Active</span>
                </WorkflowCard>
                <WorkflowCard hasCheck hasChat>
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-gray-700 flex-1">Notify Customer</span>
                </WorkflowCard>
                <p className="text-xs font-medium text-gray-500 text-center pt-2">Active Coverage</p>
              </div>

              <div className="space-y-3 relative z-10" data-testid="column-actions">
                <div className="grid grid-cols-2 gap-2">
                  <TaskGridCard title="Renewals" subtitle={`${Math.round(activeCount * 0.15)} due`} />
                  <TaskGridCard title="Claims" subtitle="Process" />
                  <TaskGridCard title="Updates" subtitle="Documents" />
                  <TaskGridCard title="Support" subtitle="Requests" />
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border border-gray-200 text-center">
                  <div className="text-xl font-bold text-gray-700">{terminatedCount + cancelledCount}</div>
                  <div className="text-xs text-gray-600 font-medium">Closed</div>
                </div>
                <p className="text-xs font-medium text-gray-500 text-center pt-1">Actions & Closed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Recent Policies
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100 h-8 w-8">
                    <Plus className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100 h-8 w-8">
                    <Upload className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100 h-8 w-8">
                    <Calendar className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-recent-policies">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Policy</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPolicies.length > 0 ? (
                      recentPolicies.map((policy, idx) => {
                        const statusStyle = getStatusColor(policy.status);
                        return (
                          <tr 
                            key={policy.id} 
                            className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                            onClick={() => setLocation(`/policies?id=${policy.id}`)}
                            data-testid={`row-policy-${idx}`}
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-gray-300 hover:text-amber-400 cursor-pointer" />
                                <span className="text-sm font-medium text-gray-900">{policy.policyNumber}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <Badge className={cn("text-xs font-medium", statusStyle.bg, statusStyle.text, "border-0")}>
                                {policy.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-sm text-gray-600">{policy.startDate}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{policy.endDate}</td>
                            <td className="py-3 px-3 text-sm text-gray-600">{policy.agentName}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-gray-400">
                          No recent policies found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Policy Status Journey
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100 h-8 w-8">
                    <Plus className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100 h-8 w-8">
                    <Upload className="h-4 w-4 text-gray-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-lg hover:bg-gray-100 h-8 w-8">
                    <Calendar className="h-4 w-4 text-gray-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-6 flex-wrap" data-testid="charts-policy-status">
                {(() => {
                  const totalPolicies = analyticsData?.totalPolicies || 1;
                  
                  const donutItems = [
                    { label: 'Closed', count: terminatedCount, color: '#ef4444', bgColor: '#fee2e2' },
                    { label: 'Active', count: activeCount, color: '#06b6d4', bgColor: '#cffafe' },
                    { label: 'Pending', count: pendingCount, color: '#f59e0b', bgColor: '#fef3c7' },
                    { label: 'Cancelled', count: cancelledCount, color: '#6b7280', bgColor: '#f3f4f6' },
                  ];
                  
                  return donutItems.map((item, idx) => {
                    const percentage = totalPolicies > 0 ? (item.count / totalPolicies) * 100 : 0;
                    const displayPercentage = Math.round(percentage);
                    return (
                      <div key={idx} className="relative">
                        <div className="w-[120px] h-[120px]">
                          <RechartsPie width={120} height={120}>
                            <Pie
                              data={[{ value: percentage }, { value: 100 - percentage }]}
                              cx="50%"
                              cy="50%"
                              innerRadius={38}
                              outerRadius={52}
                              startAngle={90}
                              endAngle={-270}
                              dataKey="value"
                              stroke="none"
                            >
                              <Cell fill={item.color} />
                              <Cell fill={item.bgColor} />
                            </Pie>
                          </RechartsPie>
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold text-gray-900">{item.count}</span>
                          <span className="text-[10px] text-gray-500">{displayPercentage}%</span>
                        </div>
                        <p className="text-center text-xs font-medium text-gray-600 mt-1">{item.label}</p>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
