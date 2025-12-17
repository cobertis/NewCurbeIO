import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, Smartphone, Users, Link, Download, AlertCircle,
  BarChart3, Apple, Chrome, Eye, Plus, RefreshCw, Copy, ExternalLink
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface AnalyticsSummary {
  totalMembers: number;
  totalLinks: number;
  totalOpens: number;
  appleDownloads: number;
  appleInstalls: number;
  googleClicks: number;
  googleSaved: number;
  errors: number;
}

interface WalletMember {
  id: string;
  fullName: string;
  memberId: string;
  email: string | null;
  phone: string | null;
  plan: string | null;
  memberSince: string | null;
  createdAt: string;
}

interface WalletEvent {
  id: string;
  type: string;
  os: string | null;
  deviceType: string | null;
  browser: string | null;
  createdAt: string;
}

interface WalletConfig {
  appleConfigured: boolean;
  googleConfigured: boolean;
}

export default function WalletAnalyticsPage() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("30");
  const [showAddMember, setShowAddMember] = useState(false);
  
  const form = useForm({
    defaultValues: {
      fullName: "",
      memberId: "",
      email: "",
      phone: "",
      plan: "standard",
    },
  });

  const { data: config, isLoading: configLoading } = useQuery<WalletConfig>({
    queryKey: ["/api/wallet/config"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/wallet/analytics"],
  });

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = useQuery<WalletMember[]>({
    queryKey: ["/api/wallet/members"],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<WalletEvent[]>({
    queryKey: ["/api/wallet/events", { limit: 50 }],
  });

  const handleAddMember = async (values: any) => {
    try {
      await apiRequest("POST", "/api/wallet/members", values);
      toast({ title: "Member created successfully" });
      setShowAddMember(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/analytics"] });
    } catch (error) {
      toast({ title: "Failed to create member", variant: "destructive" });
    }
  };

  const handleGeneratePass = async (memberId: string) => {
    try {
      const result = await apiRequest("POST", `/api/wallet/members/${memberId}/pass`);
      const data = await result.json();
      toast({ title: "Pass and link generated" });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/members"] });
      if (data.link?.url) {
        navigator.clipboard.writeText(data.link.url);
        toast({ title: "Link copied to clipboard" });
      }
    } catch (error) {
      toast({ title: "Failed to generate pass", variant: "destructive" });
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/w/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const getEventTypeIcon = (type: string) => {
    if (type.includes("apple")) return <Apple className="h-4 w-4" />;
    if (type.includes("google")) return <Chrome className="h-4 w-4" />;
    if (type.includes("link") || type.includes("view")) return <Eye className="h-4 w-4" />;
    return <BarChart3 className="h-4 w-4" />;
  };

  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      link_open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      ios_offer_view: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      android_offer_view: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      desktop_offer_view: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      apple_pkpass_download: "bg-gray-900 text-white dark:bg-gray-700",
      apple_device_registered: "bg-gray-900 text-white dark:bg-gray-700",
      google_save_clicked: "bg-blue-500 text-white",
      google_saved_confirmed: "bg-green-500 text-white",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatEventType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  if (configLoading || summaryLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Wallet System</h1>
          <p className="text-muted-foreground">Manage member passes for Apple Wallet and Google Wallet</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config?.appleConfigured ? "default" : "secondary"} className="gap-1">
            <Apple className="h-3 w-3" />
            {config?.appleConfigured ? "Configured" : "Not Configured"}
          </Badge>
          <Badge variant={config?.googleConfigured ? "default" : "secondary"} className="gap-1">
            <Chrome className="h-3 w-3" />
            {config?.googleConfigured ? "Configured" : "Not Configured"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-members">{summary?.totalMembers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Link Opens</CardTitle>
            <Link className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-link-opens">{summary?.totalOpens || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Apple Installs</CardTitle>
            <Apple className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-apple-installs">{summary?.appleInstalls || 0}</div>
            <p className="text-xs text-muted-foreground">{summary?.appleDownloads || 0} downloads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Saved</CardTitle>
            <Chrome className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-google-saved">{summary?.googleSaved || 0}</div>
            <p className="text-xs text-muted-foreground">{summary?.googleClicks || 0} clicks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>Manage wallet pass members</CardDescription>
            </div>
            <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-member">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Member</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAddMember)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      rules={{ required: "Name is required" }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-member-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="memberId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Member ID (optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Auto-generated if empty" data-testid="input-member-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} data-testid="input-member-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-member-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="plan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plan</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-member-plan">
                                <SelectValue placeholder="Select plan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                              <SelectItem value="vip">VIP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" data-testid="button-submit-member">
                      Create Member
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <LoadingSpinner fullScreen={false} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No members yet. Add your first member to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members?.slice(0, 10).map((member) => (
                      <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                        <TableCell className="font-medium">{member.fullName}</TableCell>
                        <TableCell className="font-mono text-sm">{member.memberId}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{member.plan || "standard"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleGeneratePass(member.id)}
                            data-testid={`button-generate-pass-${member.id}`}
                          >
                            <Wallet className="h-4 w-4 mr-1" />
                            Generate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Latest wallet activity</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <LoadingSpinner fullScreen={false} />
            ) : (
              <div className="space-y-3">
                {events?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No events yet. Share wallet links to see activity.
                  </p>
                ) : (
                  events?.slice(0, 10).map((event) => (
                    <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`row-event-${event.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-full">
                          {getEventTypeIcon(event.type)}
                        </div>
                        <div>
                          <Badge className={getEventTypeBadge(event.type)} variant="secondary">
                            {formatEventType(event.type)}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.os && `${event.os} • `}{event.deviceType || "Unknown device"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!config?.appleConfigured && !config?.googleConfigured && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-5 w-5" />
              Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-amber-700 dark:text-amber-300">
            <p>To generate wallet passes, you need to configure at least one wallet provider:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Apple Wallet:</strong> Set APPLE_TEAM_ID, APPLE_PASS_TYPE_ID, and APPLE_P12_B64 environment variables</li>
              <li><strong>Google Wallet:</strong> Set GOOGLE_SERVICE_ACCOUNT_JSON_B64 and GOOGLE_ISSUER_ID environment variables</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
