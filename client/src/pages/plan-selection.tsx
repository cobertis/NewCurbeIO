import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Sparkles, Rocket, Crown } from "lucide-react";
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

export default function PlanSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ['/api/session'],
  });

  const user = sessionData?.user;

  const { data: plansData, isLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/plans'],
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      if (!user?.companyId) {
        throw new Error("Company ID not found");
      }
      
      const result = await apiRequest("POST", `/api/companies/${user.companyId}/subscription`, {
        planId,
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
  // Only show active plans that have Stripe price configured
  const activePlans = plans.filter(p => p.isActive && p.stripePriceId);

  const getPlanIcon = (index: number) => {
    const icons = [Sparkles, Rocket, Crown];
    return icons[index] || Sparkles;
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your business needs. You can upgrade or downgrade at any time.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {activePlans.map((plan, index) => {
            const Icon = getPlanIcon(index);
            const isPopular = index === 1; // Middle plan is popular
            
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isPopular 
                    ? 'border-primary shadow-lg scale-105' 
                    : ''
                }`}
                data-testid={`card-plan-${plan.id}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1">Most Popular</Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-8">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                  
                  <div className="mt-6">
                    <span className="text-4xl font-bold">
                      {formatCurrency(plan.price, plan.currency)}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      / {plan.billingCycle}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features && plan.features.length > 0 ? (
                      plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))
                    ) : (
                      <>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">All core features included</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">24/7 customer support</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">Regular updates</span>
                        </li>
                      </>
                    )}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => selectPlanMutation.mutate(plan.id)}
                    disabled={selectPlanMutation.isPending}
                    data-testid={`button-select-plan-${plan.id}`}
                  >
                    {selectPlanMutation.isPending ? "Activating..." : "Select Plan"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include a 30-day money-back guarantee</p>
          <p className="mt-1">Need help choosing? Contact our sales team</p>
        </div>
      </div>
    </div>
  );
}
