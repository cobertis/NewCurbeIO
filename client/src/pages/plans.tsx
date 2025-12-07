import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPlanSchema, insertPlanFeatureSchema, type Plan, type InsertPlan, type PlanFeature, type InsertPlanFeature } from "@shared/schema";
import { Plus, Edit, Trash2, DollarSign, Clock, Check, RefreshCw, X, Users, Zap, Star, List, CreditCard, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function getIconForPlan(planName: string): typeof Users {
  const nameLower = planName.toLowerCase();
  if (nameLower.includes('unlimited')) return Star;
  if (nameLower.includes('dedicated')) return Zap;
  return Users;
}

function getAccountsText(plan: Plan): string {
  const nameLower = plan.name.toLowerCase();
  if (nameLower.includes('unlimited')) return 'Unlimited accounts';
  if (nameLower.includes('dedicated')) return '5 accounts included';
  return '1 account included';
}

function isPopularPlan(planName: string): boolean {
  return planName.toLowerCase().includes('dedicated');
}

interface PublicPricingViewProps {
  planFeatures: PlanFeature[];
  publicPlans: Plan[];
  isLoading?: boolean;
}

function PublicPricingView({ planFeatures, publicPlans, isLoading }: PublicPricingViewProps) {
  const sortedFeatures = [...planFeatures].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedPlans = [...publicPlans].sort((a, b) => a.price - b.price);
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="flex flex-col gap-8 w-full max-w-7xl">
        <div className="text-center space-y-4">
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="badge-planes">
            PLANS & PRICING
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            Choose the <span className="text-blue-600">perfect plan for you</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start with 14 days free. Cancel anytime. No surprises.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-muted rounded-t-lg" />
                <CardContent className="h-40" />
              </Card>
            ))}
          </div>
        ) : sortedPlans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No plans available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {sortedPlans.map((plan, index) => {
              const Icon = getIconForPlan(plan.name);
              const popular = isPopularPlan(plan.name);
              const displayFeatures = (plan.displayFeatures as string[]) || [];
              return (
                <div key={plan.id} className="relative" data-testid={`card-public-plan-${index}`}>
                  {popular && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                      <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1">
                        MOST POPULAR
                      </Badge>
                    </div>
                  )}
                  <Card className={`h-full ${popular ? 'border-blue-600 shadow-lg scale-105' : 'bg-gray-50'}`}>
                    <CardHeader className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${popular ? 'bg-blue-100' : 'bg-gray-200'}`}>
                          <Icon className={`h-6 w-6 ${popular ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold">${(plan.price / 100).toFixed(0)}</span>
                          <span className="text-muted-foreground">/month</span>
                        </div>
                        {plan.trialDays > 0 && (
                          <p className="text-sm text-green-600 font-medium mt-1">{plan.trialDays} days free trial</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.description || getAccountsText(plan)}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {sortedFeatures.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No features configured
                        </p>
                      ) : (
                        sortedFeatures.filter(f => f.isActive).map((feature, idx) => {
                          const included = displayFeatures.includes(feature.id);
                          return (
                            <div
                              key={feature.id}
                              className="flex items-start gap-3"
                              data-testid={`feature-${index}-${idx}`}
                            >
                              {included ? (
                                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <X className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                              )}
                              <span className={`text-sm ${included ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {feature.name}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        className={`w-full ${popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                        variant={popular ? 'default' : 'outline'}
                        data-testid={`button-select-plan-${index}`}
                      >
                        {popular ? 'Get Started' : 'Choose Plan'}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            All plans include the core CRM features
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"public" | "admin">("admin");
  const [activeTab, setActiveTab] = useState<"plans" | "features">("plans");
  const [editingFeature, setEditingFeature] = useState<PlanFeature | null>(null);
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false);

  const { data: sessionData } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;

  const { data, isLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["/api/plans"],
  });

  const plans = data?.plans || [];

  const { data: featuresData, isLoading: featuresLoading } = useQuery<{ features: PlanFeature[] }>({
    queryKey: ['/api/plan-features'],
  });
  const planFeatures = featuresData?.features || [];

  const { data: publicPlansData, isLoading: publicPlansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/public/plans'],
  });
  const publicPlans = publicPlansData?.plans || [];

  const createMutation = useMutation({
    mutationFn: async (values: InsertPlan) => {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ title: "Plan created successfully" });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create plan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<InsertPlan> }) => {
      const response = await fetch(`/api/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ title: "Plan updated successfully" });
      setIsDialogOpen(false);
      setEditingPlan(null);
    },
    onError: () => {
      toast({ title: "Failed to update plan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/plans/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ title: "Plan deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    },
  });

  const syncFromStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/plans/sync-from-stripe", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync plans from Stripe");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      const created = data.created?.length || 0;
      const updated = data.updated?.length || 0;
      const failed = data.failed?.length || 0;
      
      toast({ 
        title: "Plans synced from Stripe", 
        description: `Created: ${created}, Updated: ${updated}${failed > 0 ? `, Failed: ${failed}` : ''}`
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to sync plans", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const syncStripeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(`/api/plans/${planId}/sync-stripe`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to sync plan with Stripe");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ 
        title: "Success", 
        description: "Plan synchronized with Stripe successfully"
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Sync Failed", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: async (values: InsertPlanFeature) => {
      const response = await fetch("/api/plan-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan-features"] });
      toast({ title: "Feature created successfully" });
      setIsFeatureDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to create feature", variant: "destructive" });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<InsertPlanFeature> }) => {
      const response = await fetch(`/api/plan-features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan-features"] });
      toast({ title: "Feature updated successfully" });
      setIsFeatureDialogOpen(false);
      setEditingFeature(null);
    },
    onError: () => {
      toast({ title: "Failed to update feature", variant: "destructive" });
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/plan-features/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete feature");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plan-features"] });
      toast({ title: "Feature deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete feature", variant: "destructive" });
    },
  });

  const form = useForm<InsertPlan>({
    resolver: zodResolver(insertPlanSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      setupFee: 0,
      currency: "usd",
      billingCycle: "monthly",
      trialDays: 0,
      isActive: true,
    },
  });

  const featureForm = useForm<InsertPlanFeature>({
    resolver: zodResolver(insertPlanFeatureSchema),
    defaultValues: {
      name: "",
      description: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  function onSubmit(values: InsertPlan) {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, values });
    } else {
      createMutation.mutate(values);
    }
  }

  function onFeatureSubmit(values: InsertPlanFeature) {
    if (editingFeature) {
      updateFeatureMutation.mutate({ id: editingFeature.id, values });
    } else {
      createFeatureMutation.mutate(values);
    }
  }

  function handleEdit(plan: Plan) {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      setupFee: plan.setupFee,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      stripePriceId: plan.stripePriceId || "",
      trialDays: plan.trialDays,
      isActive: plan.isActive,
    });
    setIsDialogOpen(true);
  }

  function handleCreate() {
    setEditingPlan(null);
    form.reset({
      name: "",
      description: "",
      price: 0,
      setupFee: 0,
      currency: "usd",
      billingCycle: "monthly",
      trialDays: 0,
      isActive: true,
    });
    setIsDialogOpen(true);
  }

  function handleEditFeature(feature: PlanFeature) {
    setEditingFeature(feature);
    featureForm.reset({
      name: feature.name,
      description: feature.description || "",
      sortOrder: feature.sortOrder,
      isActive: feature.isActive,
    });
    setIsFeatureDialogOpen(true);
  }

  function handleCreateFeature() {
    setEditingFeature(null);
    featureForm.reset({
      name: "",
      description: "",
      sortOrder: planFeatures.length,
      isActive: true,
    });
    setIsFeatureDialogOpen(true);
  }

  if (user?.role !== "superadmin") {
    return <PublicPricingView planFeatures={planFeatures} publicPlans={publicPlans} isLoading={featuresLoading || publicPlansLoading} />;
  }

  if (viewMode === "public") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end p-4 sm:p-6">
          <Button
            variant="outline"
            onClick={() => setViewMode("admin")}
            data-testid="button-toggle-admin-view"
          >
            Switch to Admin View
          </Button>
        </div>
        <PublicPricingView planFeatures={planFeatures} publicPlans={publicPlans} isLoading={featuresLoading || publicPlansLoading} />
      </div>
    );
  }

  const sortedPlanFeatures = [...planFeatures].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle>Subscription Plans</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("public")}
                data-testid="button-toggle-public-view"
              >
                View Public Page
              </Button>
            </div>
            <Button 
              onClick={() => syncFromStripeMutation.mutate()} 
              disabled={syncFromStripeMutation.isPending}
              data-testid="button-sync-stripe"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncFromStripeMutation.isPending ? 'animate-spin' : ''}`} />
              {syncFromStripeMutation.isPending ? 'Syncing...' : 'Sync from Stripe'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "plans" | "features")} className="w-full">
        <TabsList className="mb-4" data-testid="tabs-plans-features">
          <TabsTrigger value="plans" data-testid="tab-plans">
            <CreditCard className="h-4 w-4 mr-2" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">
            <List className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-32 bg-muted rounded-t-lg" />
                  <CardContent className="h-40" />
                </Card>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No plans found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Sync from Stripe" above to import your plans from Stripe
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id} data-testid={`card-plan-${plan.id}`} className="hover-elevate">
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {plan.name}
                          {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                        </CardTitle>
                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-1">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <span className="text-3xl font-bold">${(plan.price / 100).toFixed(2)}</span>
                        <span className="text-muted-foreground">/{plan.billingCycle === "monthly" ? "mo" : "yr"}</span>
                      </div>
                      {plan.setupFee > 0 && (
                        <p className="text-sm text-muted-foreground">
                          + ${(plan.setupFee / 100).toFixed(2)} setup fee
                        </p>
                      )}
                    </div>

                    {plan.trialDays > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{plan.trialDays} days free trial</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Features:</p>
                      <div className="space-y-1">
                        {sortedPlanFeatures.filter(f => f.isActive).map((feature, idx) => {
                          const planNameLower = plan.name.toLowerCase();
                          const included = planNameLower.includes('unlimited') ? idx < 8 :
                                           planNameLower.includes('dedicated') ? idx < 6 :
                                           idx < 5;
                          return (
                            <div key={feature.id} className="flex items-center gap-2 text-sm">
                              {included ? (
                                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <span className={included ? 'text-foreground' : 'text-muted-foreground'}>
                                {feature.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {(plan.stripeProductId || plan.stripePriceId) && (
                      <div className="space-y-1 pt-2 border-t">
                        <p className="text-sm font-medium">Stripe IDs:</p>
                        {plan.stripeProductId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Product: {plan.stripeProductId}
                          </p>
                        )}
                        {plan.stripePriceId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Price: {plan.stripePriceId}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(plan)}
                      data-testid={`button-edit-plan-${plan.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant={plan.stripePriceId ? "secondary" : "default"}
                      size="sm"
                      onClick={() => syncStripeMutation.mutate(plan.id)}
                      disabled={syncStripeMutation.isPending}
                      data-testid={`button-sync-stripe-${plan.id}`}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${syncStripeMutation.isPending ? 'animate-spin' : ''}`} />
                      {plan.stripePriceId ? 'Re-sync' : 'Sync'} Stripe
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(plan.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-plan-${plan.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plan Features</CardTitle>
                  <CardDescription>
                    Manage the features displayed on the public pricing page
                  </CardDescription>
                </div>
                <Button onClick={handleCreateFeature} data-testid="button-create-feature">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Feature
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {featuresLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : planFeatures.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No features configured yet</p>
                  <p className="text-sm mt-1">Add features to display on the pricing page</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[100px]">Sort Order</TableHead>
                        <TableHead className="w-[80px]">Active</TableHead>
                        <TableHead className="text-right w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPlanFeatures.map((feature) => (
                        <TableRow key={feature.id} data-testid={`row-feature-${feature.id}`}>
                          <TableCell className="font-medium" data-testid={`cell-feature-name-${feature.id}`}>
                            {feature.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground" data-testid={`cell-feature-description-${feature.id}`}>
                            {feature.description || "-"}
                          </TableCell>
                          <TableCell data-testid={`cell-feature-order-${feature.id}`}>
                            {feature.sortOrder}
                          </TableCell>
                          <TableCell data-testid={`cell-feature-active-${feature.id}`}>
                            {feature.isActive ? (
                              <Badge variant="default" className="bg-green-600">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditFeature(feature)}
                                data-testid={`button-edit-feature-${feature.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteFeatureMutation.mutate(feature.id)}
                                disabled={deleteFeatureMutation.isPending}
                                data-testid={`button-delete-feature-${feature.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "Update plan details and pricing" : "Create a new subscription plan"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Pro Plan" data-testid="input-plan-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Perfect for growing teams" data-testid="input-plan-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (cents)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="2999"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-plan-price"
                        />
                      </FormControl>
                      <FormDescription>${((field.value || 0) / 100).toFixed(2)}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="setupFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Setup Fee (cents)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-plan-setup-fee"
                        />
                      </FormControl>
                      <FormDescription>${((field.value || 0) / 100).toFixed(2)}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="billingCycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Cycle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-billing-cycle">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trialDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trial Days</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-trial-days"
                        />
                      </FormControl>
                      <FormDescription>0 = No trial</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="stripePriceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stripe Price ID (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} placeholder="price_xxxxx" data-testid="input-stripe-price-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive plans won't be visible to customers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-plan-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-plan"
                >
                  {editingPlan ? "Update Plan" : "Create Plan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFeatureDialogOpen} onOpenChange={setIsFeatureDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFeature ? "Edit Feature" : "Create Feature"}</DialogTitle>
            <DialogDescription>
              {editingFeature ? "Update feature details" : "Add a new feature to display on the pricing page"}
            </DialogDescription>
          </DialogHeader>
          <Form {...featureForm}>
            <form onSubmit={featureForm.handleSubmit(onFeatureSubmit)} className="space-y-4">
              <FormField
                control={featureForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="CMS API (CRM Integration)" data-testid="input-feature-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={featureForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        value={field.value || ""} 
                        placeholder="Optional description for this feature" 
                        data-testid="input-feature-description" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={featureForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="0"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-feature-sort-order"
                      />
                    </FormControl>
                    <FormDescription>
                      Lower numbers appear first
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={featureForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Inactive features won't be displayed
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-feature-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFeatureDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createFeatureMutation.isPending || updateFeatureMutation.isPending}
                  data-testid="button-submit-feature"
                >
                  {createFeatureMutation.isPending || updateFeatureMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {editingFeature ? "Update Feature" : "Create Feature"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
