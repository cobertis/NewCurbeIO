import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Gift, TrendingUp, DollarSign, Plus, Copy, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import type { ReferralProgram, Referrer, Referral, ReferralReward } from "@shared/schema";

export default function ReferralsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [showReferrerDialog, setShowReferrerDialog] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    programs: number;
    activeReferrers: number;
    referralsByStatus: Record<string, number>;
    pendingRewardsTotal: number;
    paidRewardsTotal: number;
  }>({
    queryKey: ["/api/referral-stats"],
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<ReferralProgram[]>({
    queryKey: ["/api/referral-programs"],
  });

  const { data: referrers = [], isLoading: referrersLoading } = useQuery<Referrer[]>({
    queryKey: ["/api/referrers"],
  });

  const { data: referralsData = [], isLoading: referralsLoading } = useQuery<Referral[]>({
    queryKey: ["/api/referrals"],
  });

  const { data: rewards = [], isLoading: rewardsLoading } = useQuery<ReferralReward[]>({
    queryKey: ["/api/referral-rewards"],
  });

  const createProgramMutation = useMutation({
    mutationFn: async (data: Partial<ReferralProgram>) => {
      return apiRequest("/api/referral-programs", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-stats"] });
      setShowProgramDialog(false);
      toast({ title: "Program created", description: "Referral program created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create program", variant: "destructive" });
    },
  });

  const createReferrerMutation = useMutation({
    mutationFn: async (data: Partial<Referrer>) => {
      return apiRequest("/api/referrers", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-stats"] });
      setShowReferrerDialog(false);
      toast({ title: "Referrer added", description: "Referrer added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add referrer", variant: "destructive" });
    },
  });

  const updateRewardMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/referral-rewards/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referral-stats"] });
      toast({ title: "Reward updated", description: "Reward status updated" });
    },
  });

  const handleCreateProgram = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createProgramMutation.mutate({
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      slug: (formData.get("name") as string).toLowerCase().replace(/\s+/g, "-"),
      referrerRewardType: formData.get("rewardType") as string,
      referrerRewardValue: formData.get("rewardValue") as string,
      referrerRewardDescription: formData.get("rewardDescription") as string,
      requireApproval: formData.get("requireApproval") === "on",
    });
  };

  const handleCreateReferrer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createReferrerMutation.mutate({
      programId: formData.get("programId") as string,
      email: formData.get("email") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      phone: formData.get("phone") as string,
    });
  };

  const copyReferralLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/ref/${code}`);
    toast({ title: "Copied", description: "Referral link copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
      pending: { variant: "secondary", icon: Clock },
      qualified: { variant: "outline", icon: AlertCircle },
      converted: { variant: "default", icon: CheckCircle },
      rewarded: { variant: "default", icon: Gift },
      rejected: { variant: "destructive", icon: XCircle },
      approved: { variant: "outline", icon: CheckCircle },
      processing: { variant: "secondary", icon: Clock },
      paid: { variant: "default", icon: DollarSign },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (statsLoading) {
    return <LoadingSpinner text="Loading referral data..." />;
  }

  const totalReferrals = Object.values(stats?.referralsByStatus || {}).reduce((a, b) => a + b, 0);
  const convertedReferrals = stats?.referralsByStatus?.converted || 0;

  return (
    <div className="flex-1 p-6 space-y-6" data-testid="referrals-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Referral Program</h1>
          <p className="text-muted-foreground">Manage your referral programs and track affiliate performance</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="programs" data-testid="tab-programs">Programs</TabsTrigger>
          <TabsTrigger value="referrers" data-testid="tab-referrers">Referrers</TabsTrigger>
          <TabsTrigger value="referrals" data-testid="tab-referrals">Referrals</TabsTrigger>
          <TabsTrigger value="rewards" data-testid="tab-rewards">Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Programs</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-programs-count">{stats?.programs || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Referrers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-referrers-count">{stats?.activeReferrers || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-conversion-rate">
                  {totalReferrals > 0 ? ((convertedReferrals / totalReferrals) * 100).toFixed(1) : 0}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Rewards</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-pending-rewards">
                  ${(stats?.pendingRewardsTotal || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Referral Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats?.referralsByStatus || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      {getStatusBadge(status)}
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats?.referralsByStatus || {}).length === 0 && (
                    <p className="text-muted-foreground text-center py-4">No referrals yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Rewards Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Paid</span>
                    <span className="font-medium text-green-600">${(stats?.paidRewardsTotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-medium text-yellow-600">${(stats?.pendingRewardsTotal || 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-program">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Program
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Referral Program</DialogTitle>
                  <DialogDescription>Set up a new referral program with rewards</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProgram} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Program Name</Label>
                    <Input id="name" name="name" required data-testid="input-program-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" data-testid="input-program-description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rewardType">Reward Type</Label>
                      <Select name="rewardType" defaultValue="cash">
                        <SelectTrigger data-testid="select-reward-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="credit">Account Credit</SelectItem>
                          <SelectItem value="discount_percent">Discount %</SelectItem>
                          <SelectItem value="discount_fixed">Fixed Discount</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rewardValue">Reward Value</Label>
                      <Input id="rewardValue" name="rewardValue" type="number" step="0.01" required data-testid="input-reward-value" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rewardDescription">Reward Description</Label>
                    <Input id="rewardDescription" name="rewardDescription" placeholder="e.g., $50 per referral" data-testid="input-reward-description" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="requireApproval" name="requireApproval" defaultChecked />
                    <Label htmlFor="requireApproval">Require approval for rewards</Label>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createProgramMutation.isPending} data-testid="button-submit-program">
                      {createProgramMutation.isPending ? "Creating..." : "Create Program"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {programsLoading ? (
            <LoadingSpinner text="Loading programs..." fullScreen={false} />
          ) : programs.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No programs yet</h3>
                <p className="text-muted-foreground mb-4">Create your first referral program to get started</p>
                <Button onClick={() => setShowProgramDialog(true)} data-testid="button-create-first-program">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Program
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <Card key={program.id} data-testid={`card-program-${program.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      <Badge variant={program.isActive ? "default" : "secondary"}>
                        {program.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reward Type</span>
                        <span className="font-medium">{program.referrerRewardType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reward Value</span>
                        <span className="font-medium">${program.referrerRewardValue}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="referrers" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showReferrerDialog} onOpenChange={setShowReferrerDialog}>
              <DialogTrigger asChild>
                <Button disabled={programs.length === 0} data-testid="button-add-referrer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Referrer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Referrer</DialogTitle>
                  <DialogDescription>Add a new affiliate to your referral program</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateReferrer} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="programId">Program</Label>
                    <Select name="programId" required>
                      <SelectTrigger data-testid="select-referrer-program">
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" name="firstName" data-testid="input-referrer-firstname" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" name="lastName" data-testid="input-referrer-lastname" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required data-testid="input-referrer-email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" type="tel" data-testid="input-referrer-phone" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createReferrerMutation.isPending} data-testid="button-submit-referrer">
                      {createReferrerMutation.isPending ? "Adding..." : "Add Referrer"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {referrersLoading ? (
            <LoadingSpinner text="Loading referrers..." fullScreen={false} />
          ) : referrers.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No referrers yet</h3>
                <p className="text-muted-foreground">Add affiliates to start tracking referrals</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Referral Code</TableHead>
                    <TableHead>Referrals</TableHead>
                    <TableHead>Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrers.map((referrer) => (
                    <TableRow key={referrer.id} data-testid={`row-referrer-${referrer.id}`}>
                      <TableCell className="font-medium">
                        {referrer.firstName} {referrer.lastName}
                      </TableCell>
                      <TableCell>{referrer.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">{referrer.referralCode}</code>
                          <Button variant="ghost" size="icon" onClick={() => copyReferralLink(referrer.referralCode)} data-testid={`button-copy-${referrer.id}`}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {referrer.successfulReferrals}/{referrer.totalReferrals}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-green-600">${Number(referrer.totalEarnings || 0).toFixed(2)}</div>
                          <div className="text-muted-foreground text-xs">
                            ${Number(referrer.pendingEarnings || 0).toFixed(2)} pending
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={referrer.isActive ? "default" : "secondary"}>
                          {referrer.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          {referralsLoading ? (
            <LoadingSpinner text="Loading referrals..." fullScreen={false} />
          ) : referralsData.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No referrals yet</h3>
                <p className="text-muted-foreground">Referrals will appear here when people use referral links</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referee</TableHead>
                    <TableHead>Referrer Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Conversion Value</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralsData.map((referral) => (
                    <TableRow key={referral.id} data-testid={`row-referral-${referral.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{referral.refereeName || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">{referral.refereeEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">{referral.referralCode}</code>
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status)}</TableCell>
                      <TableCell>
                        {referral.conversionValue ? `$${Number(referral.conversionValue).toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          {rewardsLoading ? (
            <LoadingSpinner text="Loading rewards..." fullScreen={false} />
          ) : rewards.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No rewards yet</h3>
                <p className="text-muted-foreground">Rewards will appear here when referrals convert</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reward</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id} data-testid={`row-reward-${reward.id}`}>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{reward.rewardDescription || "Referral Reward"}</div>
                          <div className="text-muted-foreground">
                            {new Date(reward.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{reward.rewardType}</TableCell>
                      <TableCell className="font-medium">${Number(reward.rewardValue).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(reward.status)}</TableCell>
                      <TableCell>
                        {reward.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateRewardMutation.mutate({ id: reward.id, status: "approved" })}
                              disabled={updateRewardMutation.isPending}
                              data-testid={`button-approve-${reward.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateRewardMutation.mutate({ id: reward.id, status: "rejected" })}
                              disabled={updateRewardMutation.isPending}
                              data-testid={`button-reject-${reward.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {reward.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => updateRewardMutation.mutate({ id: reward.id, status: "paid" })}
                            disabled={updateRewardMutation.isPending}
                            data-testid={`button-pay-${reward.id}`}
                          >
                            Mark as Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
