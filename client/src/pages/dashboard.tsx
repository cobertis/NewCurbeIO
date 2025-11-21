import { Users, Bell, Cake, AlertTriangle, UserPlus, ChevronRight, BarChart3, PieChart, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useWebSocket } from "@/hooks/use-websocket";
import { useCallback, useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { geoCentroid } from "d3-geo";

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
  customers: number;
}

interface AgentLeaderboard {
  agents: Array<{ name: string; policies: number; applicants: number }>;
}

const CHART_COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

// US State abbreviations to full names mapping
const STATE_ABBR_TO_NAME: Record<string, string> = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
  "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
  "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
  "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
  "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
  "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
  "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
  "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
  "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
  "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
  "DC": "District of Columbia", "PR": "Puerto Rico"
};

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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

      {/* Monthly Chart & US Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Chart */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Monthly Performance Overview
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Total Policies and Total Customers (applicants only) by policy start date</p>
          </CardHeader>
          <CardContent>
            {monthlyData?.data && monthlyData.data.length > 0 ? (
              <div className="space-y-6">
                {/* Animated Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Policies</div>
                      <div className="text-3xl font-bold mt-1">
                        {monthlyData.data.reduce((sum, item) => sum + item.policies, 0).toLocaleString()}
                      </div>
                      <div className="text-xs mt-2 opacity-75">
                        {Math.round((monthlyData.data.reduce((sum, item) => sum + item.policies, 0) / 12) * 10) / 10} avg/month
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 p-4 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Customers</div>
                      <div className="text-3xl font-bold mt-1">
                        {monthlyData.data.reduce((sum, item) => sum + item.customers, 0).toLocaleString()}
                      </div>
                      <div className="text-xs mt-2 opacity-75">
                        {Math.round((monthlyData.data.reduce((sum, item) => sum + item.customers, 0) / 12) * 10) / 10} avg/month
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Avg per Policy</div>
                      <div className="text-3xl font-bold mt-1">
                        {monthlyData.data.reduce((sum, item) => sum + item.policies, 0) > 0 
                          ? (monthlyData.data.reduce((sum, item) => sum + item.customers, 0) / monthlyData.data.reduce((sum, item) => sum + item.policies, 0)).toFixed(1)
                          : 0}
                      </div>
                      <div className="text-xs mt-2 opacity-75">Customers per Policy</div>
                    </div>
                  </div>
                </div>

                {/* Hybrid Area + Line Chart */}
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart 
                    data={monthlyData.data} 
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPolicies" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorApplicants" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <filter id="shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis 
                      stroke="#9ca3af"
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                              <p className="font-bold text-gray-900 dark:text-white mb-2">{label}</p>
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-4 py-1">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-sm text-gray-600 dark:text-gray-400">{entry.name}</span>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: 20 }}
                      iconType="circle"
                      formatter={(value) => <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{value}</span>}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="policies" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      dot={{ fill: '#3b82f6', r: 6, strokeWidth: 2, stroke: '#fff', filter: 'url(#shadow)' }}
                      activeDot={{ r: 8, strokeWidth: 3 }}
                      name="Total Policies"
                      fill="url(#colorPolicies)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="customers" 
                      stroke="#06b6d4" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: '#06b6d4', r: 6, strokeWidth: 2, stroke: '#fff', filter: 'url(#shadow)' }}
                      activeDot={{ r: 8, strokeWidth: 3 }}
                      name="Total Customers"
                      fill="url(#colorApplicants)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-400">Loading...</div>
            )}
          </CardContent>
        </Card>

        {/* US Map - Interactive Heat Map */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Interactive US Heat Map - Customer Distribution
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Hover over states to see detailed statistics</p>
          </CardHeader>
          <CardContent className="p-0 -mt-4">
            {(() => {
              const statesData = analyticsData?.byState || [];
              const maxCount = Math.max(...statesData.map(s => s.count), 1);
              const totalCustomers = statesData.reduce((sum, s) => sum + s.count, 0);
              
              // Professional color scale: Light blue → Medium blue → Dark blue
              const colorScale = scaleLinear<string>()
                .domain([0, maxCount * 0.5, maxCount])
                .range(["#dbeafe", "#60a5fa", "#1e40af"]);
              
              // Convert state abbreviations to full names for matching with map geography
              const stateCountMap = new Map(
                statesData.map(s => {
                  const fullName = STATE_ABBR_TO_NAME[s.state.toUpperCase()] || s.state;
                  return [fullName.toUpperCase(), s.count];
                })
              );

              const [hoveredState, setHoveredState] = useState<{ name: string; count: number; percentage: number } | null>(null);
              const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

              const sortedStates = [...statesData].sort((a, b) => b.count - a.count).slice(0, 5);

              return (
                <div 
                  className="relative"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                >
                    <ComposableMap
                      projection="geoAlbersUsa"
                      projectionConfig={{ scale: 1200 }}
                      className="w-full h-[580px]"
                    >
                      <defs>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
                        {({ geographies }) => (
                          <>
                            {geographies.map((geo) => {
                              const stateName = geo.properties.name.toUpperCase();
                              const count = stateCountMap.get(stateName) || 0;
                              const displayName = geo.properties.name;
                              const percentage = totalCustomers > 0 ? (count / totalCustomers * 100).toFixed(1) : 0;
                              const isTopState = sortedStates.some(s => s.state.toUpperCase() === stateName);
                              
                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={count > 0 ? colorScale(count) : "#f3f4f6"}
                                  stroke="#ffffff"
                                  strokeWidth={count > 0 ? 1.5 : 0.8}
                                  onMouseEnter={() => {
                                    if (count > 0) {
                                      setHoveredState({ name: displayName, count, percentage: Number(percentage) });
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredState(null)}
                                  onClick={() => {
                                    if (count > 0) {
                                      console.log(`Clicked on ${displayName} with ${count} customers`);
                                    }
                                  }}
                                  style={{
                                    default: { 
                                      outline: "none",
                                      transition: "all 0.2s ease",
                                      cursor: count > 0 ? "pointer" : "default"
                                    },
                                    hover: count > 0 ? { 
                                      fill: "#4f46e5",
                                      stroke: "#6366f1",
                                      strokeWidth: 2,
                                      outline: "none",
                                      cursor: "pointer",
                                      opacity: 0.9
                                    } : {
                                      outline: "none"
                                    },
                                    pressed: { 
                                      outline: "none"
                                    }
                                  }}
                                />
                              );
                            })}
                            {geographies.map((geo) => {
                              const stateName = geo.properties.name.toUpperCase();
                              const count = stateCountMap.get(stateName) || 0;
                              
                              if (count === 0) return null;
                              
                              const centroid = geoCentroid(geo);
                              
                              return (
                                <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                                  <g>
                                    <circle
                                      r={count > maxCount * 0.7 ? 16 : count > maxCount * 0.4 ? 14 : 12}
                                      fill="rgba(0, 0, 0, 0.6)"
                                      stroke="#ffffff"
                                      strokeWidth={2}
                                      style={{ pointerEvents: "none" }}
                                    />
                                    <text
                                      textAnchor="middle"
                                      dy={4}
                                      fontSize={count > maxCount * 0.7 ? "13" : "11"}
                                      fontWeight="700"
                                      fill="#ffffff"
                                      style={{ pointerEvents: "none" }}
                                    >
                                      {count}
                                    </text>
                                  </g>
                                </Marker>
                              );
                            })}
                          </>
                        )}
                      </Geographies>
                    </ComposableMap>

                    {/* Custom Tooltip */}
                    {hoveredState && (
                      <div 
                        className="absolute pointer-events-none z-50"
                        style={{
                          left: mousePosition.x + 15,
                          top: mousePosition.y - 60,
                        }}
                      >
                        <div className="bg-gray-900 dark:bg-gray-800 text-white px-4 py-3 rounded-lg shadow-2xl border border-gray-700 min-w-[200px] animate-in fade-in duration-200">
                          <div className="font-bold text-base mb-2 flex items-center gap-2">
                            <span className="text-xl">📍</span>
                            {hoveredState.name}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-300">Customers:</span>
                              <span className="font-bold text-cyan-400">{hoveredState.count}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-300">Percentage:</span>
                              <span className="font-bold text-green-400">{hoveredState.percentage}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {statesData.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-gray-400">No geographic data available</p>
                      </div>
                    )}
                  </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Agents & Product Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agents Leaderboard */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agents leaderboard (Top 5)
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Top performing agents by policies and applicants</p>
          </CardHeader>
          <CardContent>
            {(agentsData?.agents || []).length > 0 ? (
              <div className="space-y-3">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="col-span-6 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Agent
                  </div>
                  <div className="col-span-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">
                    Policies
                  </div>
                  <div className="col-span-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">
                    Applicants
                  </div>
                </div>

                {/* Table Rows */}
                {(agentsData?.agents || []).slice(0, 5).map((agent, idx) => {
                  const positions = ['1st place', '2nd place', '3rd place', '4th place', '5th place'];
                  const avatarGradients = [
                    'from-yellow-400 via-yellow-500 to-yellow-600',
                    'from-gray-300 via-gray-400 to-gray-500',
                    'from-orange-400 via-orange-500 to-orange-600',
                    'from-blue-400 via-blue-500 to-blue-600',
                    'from-purple-400 via-purple-500 to-purple-600',
                  ];
                  
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg px-2 transition-colors">
                      {/* Agent Name with Avatar */}
                      <div className="col-span-6 flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradients[idx]} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {agent.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            {idx === 0 && <span className="text-yellow-500">🏆</span>}
                            {positions[idx]}
                          </p>
                        </div>
                      </div>

                      {/* Policies Count */}
                      <div className="col-span-3 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30">
                          <span className="text-blue-600 dark:text-blue-400 text-sm">🛡️</span>
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                            {agent.policies}
                          </span>
                        </div>
                      </div>

                      {/* Applicants Count */}
                      <div className="col-span-3 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-50 dark:bg-cyan-900/30">
                          <span className="text-cyan-600 dark:text-cyan-400 text-sm">👥</span>
                          <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">
                            {agent.applicants}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">No agents data available</p>
              </div>
            )}
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
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width="60%" height={280}>
                  <RechartsPie data={analyticsData.byProductType.slice(0, 10)}>
                    <defs>
                      {CHART_COLORS.map((color, idx) => (
                        <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie 
                      data={analyticsData.byProductType.slice(0, 10)} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={65} 
                      outerRadius={110} 
                      dataKey="count"
                      paddingAngle={3}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {analyticsData.byProductType.slice(0, 10).map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#gradient-${index % CHART_COLORS.length})`}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
                              <p className="font-semibold text-gray-900 dark:text-white">{payload[0].name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{payload[0].value} policies</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                
                <div className="flex-1 space-y-2">
                  {analyticsData.byProductType.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.type}</p>
                      </div>
                      <div className="text-xs font-bold text-gray-900 dark:text-white">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No product data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
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
  );
}
