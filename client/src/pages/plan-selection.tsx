import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: string;
  currency: string;
  isActive: boolean;
  stripePriceId?: string;
  features: string[];
}

type BillingPeriod = "monthly" | "yearly";

export default function PlanSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  
  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ['/api/session'],
  });

  const user = sessionData?.user;

  const { data: plansData, isLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/plans'],
  });

  const selectPlanMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: BillingPeriod }) => {
      const result = await apiRequest("POST", "/api/select-plan", {
        planId,
        billingPeriod,
      });
      return result.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your plan has been activated. Welcome aboard!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/session'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate plan",
        variant: "destructive",
      });
    },
  });

  const plans = plansData?.plans || [];
  const activePlans = plans.filter(p => p.isActive && p.stripePriceId);

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  const getDisplayPrice = (plan: Plan) => {
    const monthlyPrice = plan.price;
    if (billingPeriod === "yearly") {
      // Apply 20% discount for yearly
      return monthlyPrice * 0.8;
    }
    return monthlyPrice;
  };

  const getYearlyPrice = (plan: Plan) => {
    const monthlyPrice = plan.price;
    // Yearly with 20% discount
    return (monthlyPrice * 0.8) * 12;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Choose Your Plan
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your business needs. You can upgrade or downgrade at any time.
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
            className="rounded-full px-6"
            data-testid="button-billing-monthly"
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingPeriod("yearly")}
            className="rounded-full px-6 relative"
            data-testid="button-billing-yearly"
          >
            Yearly
            <Badge className="ml-2 bg-primary/20 text-primary border-0 hover:bg-primary/20">
              -20%
            </Badge>
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8 max-w-6xl mx-auto">
          {activePlans.map((plan, index) => {
            const isPopular = index === 1;
            const displayPrice = getDisplayPrice(plan);
            const yearlyTotal = getYearlyPrice(plan);
            
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isPopular 
                    ? 'border-primary shadow-xl scale-[1.02] lg:scale-105' 
                    : 'border-border'
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1 bg-gradient-to-r from-pink-500 to-purple-500 border-0 text-white">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-6 pt-8">
                  <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                  
                  <div className="mt-6 mb-2">
                    <span className="text-5xl font-bold tracking-tight">
                      {formatCurrency(displayPrice, plan.currency)}
                    </span>
                    <span className="text-muted-foreground text-base">
                      /month
                    </span>
                  </div>

                  {billingPeriod === "yearly" && (
                    <p className="text-sm text-muted-foreground">
                      or {formatCurrency(yearlyTotal, plan.currency)}/year billed annually
                    </p>
                  )}

                  {billingPeriod === "monthly" && (
                    <p className="text-sm text-muted-foreground">
                      or {formatCurrency(displayPrice * 0.8, plan.currency)}/month billed yearly
                    </p>
                  )}

                  <p className="text-sm text-muted-foreground mt-4">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="flex-1 pt-0">
                  <div className="space-y-1">
                    <p className="font-medium text-sm mb-3">
                      {index === 0 && "Includes:"}
                      {index === 1 && "Includes everything in Starter, plus:"}
                      {index === 2 && "Includes everything in Growth, plus:"}
                    </p>
                    {plan.features && plan.features.length > 0 ? (
                      plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-3 py-1">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground/90">{feature}</span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-start gap-3 py-1">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground/90">All core features included</span>
                        </div>
                        <div className="flex items-start gap-3 py-1">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground/90">24/7 customer support</span>
                        </div>
                        <div className="flex items-start gap-3 py-1">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground/90">Regular updates</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-6">
                  <Button
                    className="w-full"
                    size="lg"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => selectPlanMutation.mutate({ planId: plan.id, billingPeriod })}
                    disabled={selectPlanMutation.isPending}
                    data-testid={`button-select-plan-${plan.id}`}
                  >
                    {selectPlanMutation.isPending ? "Activating..." : "Start Free Trial"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>All plans include a 30-day money-back guarantee</p>
          <p>Need help choosing? Contact our sales team</p>
        </div>
      </div>
    </div>
  );
}
