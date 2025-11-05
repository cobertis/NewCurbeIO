import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { LoadingSpinner } from "@/components/loading-spinner";

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
  annualPrice?: number;
  billingCycle: string;
  currency: string;
  isActive: boolean;
  stripePriceId?: string;
  stripeAnnualPriceId?: string;
  features: string[];
  trialDays?: number;
}

type BillingPeriod = "monthly" | "yearly";

export default function PlanSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  
  // Debug: Log when billing period changes
  const handleBillingPeriodChange = (period: BillingPeriod) => {
    console.log(`[BILLING-DEBUG] Changing billing period from "${billingPeriod}" to "${period}"`);
    setBillingPeriod(period);
  };
  
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
    onSuccess: (data, variables) => {
      // Find the selected plan details
      const selectedPlan = plans.find(p => p.id === variables.planId);
      const trialDays = selectedPlan?.trialDays || 14; // Default to 14 days if not specified
      const planName = selectedPlan?.name || "plan";
      
      // Calculate trial end date
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      const formattedDate = trialEndDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      // Get pricing information
      const monthlyPrice = selectedPlan ? formatCurrency(
        variables.billingPeriod === "yearly" && selectedPlan.annualPrice
          ? selectedPlan.annualPrice / 12
          : selectedPlan.price,
        selectedPlan.currency
      ) : "";
      const billingCycle = variables.billingPeriod === "yearly" ? "yearly" : "monthly";
      
      toast({
        title: "🎉 Free Trial Started!",
        description: `Your ${trialDays}-day free trial of the ${planName} plan has begun! You'll be charged ${monthlyPrice}/${billingCycle === "yearly" ? "month (billed annually)" : "month"} starting on ${formattedDate}. You can cancel anytime before then.`,
        duration: 8000, // Show for 8 seconds since it's important
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
    const price = billingPeriod === "yearly" && plan.annualPrice
      ? plan.annualPrice / 12
      : plan.price;
    
    console.log(`[BILLING-DEBUG] Plan: ${plan.name}, Period: ${billingPeriod}, Price: ${price}, Monthly: ${plan.price}, Annual: ${plan.annualPrice}`);
    return price;
  };

  const getYearlyPrice = (plan: Plan) => {
    if (plan.annualPrice) {
      return plan.annualPrice;
    }
    // Fallback: calculate annual from monthly if no annual price exists
    return plan.price * 12;
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading plans..." />;
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
            onClick={() => handleBillingPeriodChange("monthly")}
            className="rounded-full px-6"
            data-testid="button-billing-monthly"
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "outline"}
            size="sm"
            onClick={() => handleBillingPeriodChange("yearly")}
            className="rounded-full px-6 relative"
            data-testid="button-billing-yearly"
          >
            Yearly
            <Badge 
              className={`ml-2 border-0 ${
                billingPeriod === "yearly" 
                  ? "bg-white/20 text-white hover:bg-white/20" 
                  : "bg-primary/20 text-primary hover:bg-primary/20"
              }`}
            >
              Save
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

                  {billingPeriod === "yearly" && plan.annualPrice && (
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(yearlyTotal, plan.currency)}/year billed annually
                    </p>
                  )}

                  {billingPeriod === "monthly" && plan.annualPrice && (
                    <p className="text-sm text-muted-foreground">
                      or {formatCurrency(plan.annualPrice / 12, plan.currency)}/month billed yearly
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
                    onClick={() => {
                      console.log(`[BILLING-DEBUG] Selecting plan ${plan.name} with billing period: ${billingPeriod}`);
                      selectPlanMutation.mutate({ planId: plan.id, billingPeriod });
                    }}
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

        {/* No Credit Card Required Banner with Glow Effect */}
        <div className="my-8 flex items-center justify-center">
          <div 
            className="relative group flex items-center justify-center gap-2 px-6 py-3 rounded-full 
                       bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 
                       border border-primary/20 hover:border-primary/30 transition-all duration-500
                       animate-pulse-glow"
            data-testid="text-no-credit-card"
          >
            {/* Glow effect background */}
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl opacity-0 
                          group-hover:opacity-50 transition-opacity duration-500"></div>
            
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent 
                            animate-shimmer"></div>
            </div>
            
            {/* Content */}
            <CreditCard className="h-5 w-5 text-primary relative z-10" />
            <span className="text-base font-medium bg-gradient-to-r from-primary to-primary/80 
                           bg-clip-text text-transparent relative z-10">
              No credit card required to start your free trial
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>All plans include a 14-day money-back guarantee</p>
          <p>
            Need help choosing?{' '}
            <a 
              href="mailto:hello@curbe.io" 
              className="text-primary hover:underline"
              data-testid="link-contact-sales"
            >
              Contact our sales team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
