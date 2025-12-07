import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
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
  displayFeatures?: string[];
}

interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

type BillingCycle = "monthly" | "yearly";

function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function isPopularPlan(planName: string, planIndex: number, totalPlans: number): boolean {
  const nameLower = planName.toLowerCase();
  if (nameLower.includes('dedicated') || nameLower.includes('team') || nameLower.includes('professional')) return true;
  if (totalPlans === 3 && planIndex === 1) return true;
  return false;
}

export default function PlanSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  
  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ['/api/session'],
  });

  const user = sessionData?.user;

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/plans'],
  });

  const { data: featuresData } = useQuery<{ features: PlanFeature[] }>({
    queryKey: ['/api/plan-features'],
  });

  const selectPlanMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: BillingCycle }) => {
      const result = await apiRequest("POST", "/api/select-plan", {
        planId,
        billingPeriod,
      });
      return result.json();
    },
    onSuccess: (data, variables) => {
      const selectedPlan = plans.find(p => p.id === variables.planId);
      const trialDays = selectedPlan?.trialDays || 14;
      const planName = selectedPlan?.name || "plan";
      
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      const formattedDate = trialEndDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      const monthlyPrice = selectedPlan ? formatPrice(
        variables.billingPeriod === "yearly" && selectedPlan.annualPrice
          ? selectedPlan.annualPrice / 12
          : selectedPlan.price,
        selectedPlan.currency
      ) : "";
      const billingLabel = variables.billingPeriod === "yearly" ? "month (billed annually)" : "month";
      
      toast({
        title: "🎉 Free Trial Started!",
        description: `Your ${trialDays}-day free trial of the ${planName} plan has begun! You'll be charged ${monthlyPrice}/${billingLabel} starting on ${formattedDate}. You can cancel anytime before then.`,
        duration: 8000,
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
  const features = featuresData?.features || [];
  const activePlans = plans.filter(p => p.isActive && p.stripePriceId);
  const sortedPlans = [...activePlans].sort((a, b) => a.price - b.price);
  const sortedFeatures = [...features].sort((a, b) => a.sortOrder - b.sortOrder);

  const getDisplayPrice = (plan: Plan): number => {
    if (billingCycle === 'yearly') {
      if (plan.annualPrice) {
        return plan.annualPrice / 12;
      }
      return plan.price * 10 / 12;
    }
    return plan.price;
  };

  const getYearlyTotal = (plan: Plan): number => {
    if (plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.price * 10;
  };

  const getPlanDescription = (planName: string, description?: string): string => {
    if (description) return description;
    const nameLower = planName.toLowerCase();
    if (nameLower.includes('starter') || nameLower.includes('shared') || nameLower.includes('individual')) {
      return 'Good for individuals who are just starting out and simply want the essentials.';
    }
    if (nameLower.includes('team') || nameLower.includes('dedicated') || nameLower.includes('professional')) {
      return 'Highly recommended for small teams who seek to upgrade their time & perform.';
    }
    if (nameLower.includes('enterprise') || nameLower.includes('unlimited')) {
      return 'Robust scheduling for larger teams looking to have more control, privacy & security.';
    }
    return 'All the features you need to grow your business.';
  };

  const getPlanFeatureHeader = (planName: string, index: number): string => {
    const nameLower = planName.toLowerCase();
    if (nameLower.includes('starter') || nameLower.includes('shared') || nameLower.includes('individual') || index === 0) {
      return 'Free, forever';
    }
    if (nameLower.includes('team') || nameLower.includes('dedicated') || nameLower.includes('professional') || index === 1) {
      return 'Free plan features, plus:';
    }
    return 'Organization plan features, plus:';
  };

  if (plansLoading) {
    return <LoadingSpinner message="Loading plans..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-12">
          <div className="lg:max-w-xl">
            <h1 
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white leading-tight"
              data-testid="text-pricing-header"
            >
              Simple pricing based on your needs
            </h1>
          </div>
          <div className="lg:max-w-md lg:text-right">
            <p className="text-gray-600 dark:text-gray-400 text-lg" data-testid="text-pricing-subtitle">
              Discover a variety of our advanced features. Unlimited and free for individuals.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
              billingCycle === 'monthly'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-lg'
                : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
            data-testid="button-billing-monthly"
          >
            Monthly
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                billingCycle === 'yearly'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-lg'
                  : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
              data-testid="button-billing-yearly"
            >
              Yearly
            </button>
            <Badge 
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0 px-2.5 py-1 text-xs font-medium"
              data-testid="badge-save-percentage"
            >
              Save 20%
            </Badge>
          </div>
        </div>

        {billingCycle === 'yearly' && (
          <div className="text-center mb-8">
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium" data-testid="text-yearly-savings">
              🎉 2 months free with yearly billing
            </span>
          </div>
        )}

        {sortedPlans.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-plans">No plans available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto items-start">
            {sortedPlans.map((plan, index) => {
              const popular = isPopularPlan(plan.name, index, sortedPlans.length);
              const displayFeatures = (plan.displayFeatures as string[]) || [];
              const displayPrice = getDisplayPrice(plan);
              const yearlyTotal = getYearlyTotal(plan);

              return (
                <div 
                  key={plan.id} 
                  className={`relative ${popular ? 'md:-mt-4 md:mb-4' : ''}`}
                  data-testid={`card-plan-${plan.id}`}
                >
                  {popular && (plan.trialDays || 0) > 0 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge 
                        className="bg-blue-600 hover:bg-blue-600 text-white px-4 py-1.5 text-xs font-medium shadow-md"
                        data-testid={`badge-trial-${plan.id}`}
                      >
                        {plan.trialDays} days free trial
                      </Badge>
                    </div>
                  )}
                  
                  <Card className={`h-full bg-white dark:bg-gray-800 transition-all duration-300 ${
                    popular 
                      ? 'border-blue-200 dark:border-blue-800 shadow-xl ring-1 ring-blue-100 dark:ring-blue-900' 
                      : 'border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg'
                  }`}>
                    <CardHeader className="pb-4 pt-8">
                      <CardTitle 
                        className="text-xl font-semibold text-gray-900 dark:text-white"
                        data-testid={`text-plan-name-${plan.id}`}
                      >
                        {plan.name}
                      </CardTitle>
                      
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Starts at</p>
                        <div className="flex items-baseline gap-2">
                          <span 
                            className="text-4xl font-bold text-gray-900 dark:text-white"
                            data-testid={`text-plan-price-${plan.id}`}
                          >
                            {formatPrice(displayPrice, plan.currency)}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-sm">
                            per month/user
                          </span>
                        </div>
                        {billingCycle === 'yearly' && plan.price > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {formatPrice(yearlyTotal, plan.currency)}/year billed annually
                          </p>
                        )}
                      </div>
                      
                      <p 
                        className="text-sm text-gray-600 dark:text-gray-400 mt-4 leading-relaxed"
                        data-testid={`text-plan-description-${plan.id}`}
                      >
                        {getPlanDescription(plan.name, plan.description || undefined)}
                      </p>
                    </CardHeader>
                    
                    <CardContent className="pt-0 pb-6">
                      <Button
                        className={`w-full mb-6 ${
                          popular 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
                            : 'bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                        size="lg"
                        onClick={() => {
                          console.log(`[BILLING-DEBUG] Selecting plan ${plan.name} with billing cycle: ${billingCycle}`);
                          selectPlanMutation.mutate({ planId: plan.id, billingPeriod: billingCycle });
                        }}
                        disabled={selectPlanMutation.isPending}
                        data-testid={`button-select-plan-${plan.id}`}
                      >
                        {selectPlanMutation.isPending ? 'Selecting...' : 'Get started'}
                      </Button>
                      
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                        <p 
                          className="text-sm font-semibold text-gray-900 dark:text-white mb-4"
                          data-testid={`text-feature-header-${plan.id}`}
                        >
                          {getPlanFeatureHeader(plan.name, index)}
                        </p>
                        
                        <div className="space-y-3">
                          {sortedFeatures.filter(f => f.isActive).length > 0 && displayFeatures.length > 0 ? (
                            sortedFeatures.filter(f => f.isActive).map((feature, idx) => {
                              const included = displayFeatures.includes(feature.id);
                              if (!included) return null;
                              return (
                                <div
                                  key={feature.id}
                                  className="flex items-start gap-3"
                                  data-testid={`feature-${plan.id}-${idx}`}
                                >
                                  <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {feature.name}
                                  </span>
                                </div>
                              );
                            })
                          ) : plan.features && plan.features.length > 0 ? (
                            plan.features.map((feature, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3"
                                data-testid={`feature-${plan.id}-${idx}`}
                              >
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {feature}
                                </span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {index === 0 ? '1 user' : index === 1 ? '1 team' : '1 parent team and unlimited sub-teams'}
                                </span>
                              </div>
                              <div className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {index === 0 ? 'Unlimited calendars' : index === 1 ? 'Schedule meetings as a team' : 'Organization workflows'}
                                </span>
                              </div>
                              <div className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {index === 0 ? 'Unlimited event types' : index === 1 ? 'Round-Robin, Fixed Round-Robin' : 'Insights - analyze your booking data'}
                                </span>
                              </div>
                              <div className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {index === 0 ? 'Workflows' : index === 1 ? 'Collective Events' : 'Active directory sync'}
                                </span>
                              </div>
                              <div className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {index === 0 ? 'Integrate with your favorite apps' : index === 1 ? 'Advanced Routing Forms' : '24/7 Email, Chat and Phone support'}
                                </span>
                              </div>
                              <div className="flex items-start gap-3">
                                <Check className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {index === 0 ? 'Accept payments via Stripe' : index === 1 ? 'Team Workflows' : 'Sync your HRIS tools'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12 space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All plans include a free trial. No credit card required.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help choosing?{' '}
            <a 
              href="mailto:hello@curbe.io" 
              className="text-blue-600 dark:text-blue-400 hover:underline"
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
