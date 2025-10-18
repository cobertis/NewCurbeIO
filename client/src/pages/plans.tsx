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
import { insertPlanSchema, type Plan, type InsertPlan } from "@shared/schema";
import { Plus, Edit, Trash2, DollarSign, Clock, Check, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function PlansPage() {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: sessionData } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
    queryKey: ["/api/session"],
  });

  const user = sessionData?.user;

  const { data, isLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ["/api/plans"],
  });

  const plans = data?.plans || [];

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

  function onSubmit(values: InsertPlan) {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, values });
    } else {
      createMutation.mutate(values);
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

  if (user?.role !== "superadmin") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Access denied. Only superadmins can manage plans.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Subscription Plans</CardTitle>
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

                {plan.features && typeof plan.features === 'object' && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Features:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {Object.entries(plan.features as Record<string, unknown>).map(([key, value]) => (
                        <li key={key} className="flex items-center gap-2">
                          <Check className="h-3 w-3" />
                          <span className="capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}: {typeof value === 'string' ? value : JSON.stringify(value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

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
    </div>
  );
}
