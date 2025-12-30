import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { LoadingSpinner } from "@/components/loading-spinner";
import { PublicPricingView } from "./plans";
import type { Plan, PlanFeature } from "@shared/schema";

interface User {
  id: string;
  email: string;
  role: string;
  companyId: string | null;
}

function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default function PlanSelection() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);
  
  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ['/api/session'],
  });

  const user = sessionData?.user;

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: Plan[] }>({
    queryKey: ['/api/plans'],
  });

  const { data: featuresData, isLoading: featuresLoading } = useQuery<{ features: PlanFeature[] }>({
    queryKey: ['/api/plan-features'],
  });

  const selectPlanMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: 'monthly' | 'yearly' }) => {
      return await apiRequest("POST", "/api/select-plan", {
        planId,
        billingPeriod,
      });
    },
    onSuccess: (data, variables) => {
      const plans = plansData?.plans || [];
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
        title: "Free Trial Started!",
        description: `Your ${trialDays}-day free trial of the ${planName} plan has begun! You'll be charged ${monthlyPrice}/${billingLabel} starting on ${formattedDate}. You can cancel anytime before then.`,
        duration: 8000,
      });
      setSelectingPlanId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/session'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/progress'] });
      setLocation("/");
    },
    onError: (error: Error) => {
      setSelectingPlanId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to activate plan",
        variant: "destructive",
      });
    },
  });

  const handleSelectPlan = (planId: string, billingCycle: 'monthly' | 'yearly') => {
    setSelectingPlanId(planId);
    selectPlanMutation.mutate({ planId, billingPeriod: billingCycle });
  };

  if (plansLoading || featuresLoading) {
    return <LoadingSpinner message="Loading plans..." />;
  }

  const plans = plansData?.plans || [];
  const features = featuresData?.features || [];
  const activePlans = plans.filter(p => p.isActive && p.stripePriceId);

  return (
    <PublicPricingView
      planFeatures={features}
      publicPlans={activePlans}
      isLoading={plansLoading}
      onSelectPlan={handleSelectPlan}
      isSelecting={selectPlanMutation.isPending}
      selectingPlanId={selectingPlanId}
      showTrialInfo={true}
    />
  );
}
