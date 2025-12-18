import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { insertPlanSchema, insertPlanFeatureSchema, type Plan, type InsertPlan, type PlanFeature, type InsertPlanFeature, type PlanFeatureAssignment } from "@shared/schema";
import { Plus, Edit, Trash2, DollarSign, Clock, Check, RefreshCw, X, Users, Zap, Star, List, CreditCard, Loader2, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface FeatureAssignmentState {
  [featureId: string]: boolean;
}

function isPopularPlan(planName: string, planIndex: number, totalPlans: number): boolean {
  const nameLower = planName.toLowerCase();
  if (nameLower.includes('dedicated') || nameLower.includes('team') || nameLower.includes('professional')) return true;
  if (totalPlans === 3 && planIndex === 1) return true;
  return false;
}

function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

interface PublicPricingViewProps {
  planFeatures: PlanFeature[];
  publicPlans: Plan[];
  isLoading?: boolean;
  onSelectPlan?: (planId: string, billingCycle: 'monthly' | 'yearly') => void;
  isSelecting?: boolean;
  selectingPlanId?: string | null;
  showTrialInfo?: boolean;
}

const pricingTheme = {
  colors: {
    background: '#E9EFFD',
    gridLines: '#C2D2FF',
    cardBorder: '#E3EAF8',
    cardShadow: '0 22px 45px -20px rgba(15, 45, 92, 0.35)',
    ctaPrimary: '#1FADAE',
    ctaPrimaryHover: '#179B9C',
    ctaSecondary: '#D8E0F0',
    ctaSecondaryHover: '#F3F6FD',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#5B718E',
    checkmark: '#10B981',
    excluded: '#EF4444',
    excludedText: '#9CA3AF',
    excludedBg: '#FEF2F2',
  },
  spacing: {
    section: '32px',
    block: '20px',
    feature: '12px',
  },
};

export function PublicPricingView({ 
  planFeatures, 
  publicPlans, 
  isLoading,
  onSelectPlan,
  isSelecting,
  selectingPlanId,
  showTrialInfo = false
}: PublicPricingViewProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  
  const sortedFeatures = [...planFeatures].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedPlans = [...publicPlans].sort((a, b) => a.price - b.price);

  const getDisplayPrice = (plan: Plan): number => {
    if (billingCycle === 'yearly') {
      if (plan.annualPrice) {
        return plan.annualPrice;
      }
      // precio mensual * 12 * 0.8 (20% discount)
      return plan.price * 12 * 0.8;
    }
    return plan.price;
  };

  const getYearlyTotal = (plan: Plan): number => {
    if (plan.annualPrice) {
      return plan.annualPrice;
    }
    // precio mensual * 12 * 0.8 (20% discount)
    return plan.price * 12 * 0.8;
  };

  const getOriginalYearlyPrice = (plan: Plan): number => {
    // precio mensual * 12 sin descuento
    return plan.price * 12;
  };

  const isEnterprisePlan = (planName: string, index: number, total: number): boolean => {
    const nameLower = planName.toLowerCase();
    return nameLower.includes('enterprise') || (total >= 4 && index === total - 1);
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
  
  return (
    <div 
      className="min-h-screen relative overflow-auto flex flex-col"
      style={{ backgroundColor: '#F8FAFC' }}
    >
      {/* Subtle gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #F1F5F9 0%, #F8FAFC 50%, #FFFFFF 100%)',
        }}
      />
      
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto w-full flex flex-col">
          {/* Header Section - Two Column Layout */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
            <h1 
              className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight max-w-md"
              style={{ color: pricingTheme.colors.textPrimary }}
              data-testid="text-pricing-header"
            >
              Simple pricing based on your needs
            </h1>
            <p 
              className="text-base leading-relaxed max-w-sm text-right hidden lg:block"
              style={{ color: pricingTheme.colors.textSecondary }}
              data-testid="text-pricing-subtitle"
            >
              Discover a variety of our advanced features. Unlimited and free for individuals.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-6">
            <div 
              className="inline-flex items-center rounded-full p-1"
              style={{ backgroundColor: '#E0E7F1' }}
            >
              <button
                onClick={() => setBillingCycle('monthly')}
                className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: billingCycle === 'monthly' ? '#1E3A5F' : 'transparent',
                  color: billingCycle === 'monthly' ? '#FFFFFF' : '#4A5568',
                }}
                data-testid="button-billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 inline-flex items-center gap-2"
                style={{
                  backgroundColor: billingCycle === 'yearly' ? '#1E3A5F' : 'transparent',
                  color: billingCycle === 'yearly' ? '#FFFFFF' : '#4A5568',
                }}
                data-testid="button-billing-yearly"
              >
                Yearly
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    backgroundColor: '#BFDBFE',
                    color: '#1E40AF',
                  }}
                  data-testid="badge-save-percentage"
                >
                  Save 20%
                </span>
              </button>
            </div>
            {/* Arrow and 2 months free text */}
            <div className="flex items-center" style={{ marginLeft: '8px' }}>
              <img 
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 200'%3E%3Cpath d='M50 10 Q70 40 60 80 Q50 120 30 150' stroke='%231E3A5F' stroke-width='12' fill='none' stroke-linecap='round'/%3E%3Cpath d='M30 150 L40 135 L25 130' stroke='%231E3A5F' stroke-width='12' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E" 
                alt=""
                style={{ 
                  width: '32px', 
                  height: '32px',
                  transform: 'rotate(-90deg)',
                }}
              />
              <span 
                style={{ 
                  color: '#1E3A5F',
                  fontFamily: '"Architects Daughter", cursive',
                  fontSize: '18px',
                  marginLeft: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                2 months free
              </span>
            </div>
          </div>

          {/* Plans Grid */}
          {isLoading ? (
            <div className="flex-1 grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className="animate-pulse"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    boxShadow: pricingTheme.colors.cardShadow,
                  }}
                />
              ))}
            </div>
          ) : sortedPlans.length === 0 ? (
            <div 
              className="p-8 max-w-md mx-auto text-center"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                boxShadow: pricingTheme.colors.cardShadow,
              }}
            >
              <p style={{ color: pricingTheme.colors.textMuted }} data-testid="text-no-plans">
                No plans available
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto" style={{ alignItems: 'stretch' }}>
              {sortedPlans.map((plan, index) => {
                const popular = isPopularPlan(plan.name, index, sortedPlans.length);
                const enterprise = isEnterprisePlan(plan.name, index, sortedPlans.length);
                const displayFeatures = (plan.displayFeatures as string[]) || [];
                const displayPrice = getDisplayPrice(plan);
                const yearlyTotal = getYearlyTotal(plan);
                const planDescription = getPlanDescription(plan.name, plan.description || undefined);
                const featureHeader = getPlanFeatureHeader(plan.name, index);

                return (
                  <div 
                    key={plan.id} 
                    className="relative flex flex-col h-full"
                    data-testid={`card-public-plan-${index}`}
                  >
                    {/* Trial Badge for Popular Plan */}
                    {popular && plan.trialDays > 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span 
                          className="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: '#3B82F6',
                            color: '#FFFFFF',
                          }}
                          data-testid={`badge-trial-${index}`}
                        >
                          Preferred Plan
                        </span>
                      </div>
                    )}
                    
                    {/* Card */}
                    <div 
                      className="flex-1 flex flex-col p-6 h-full"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        border: popular ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                        boxShadow: popular ? '0 8px 32px -8px rgba(59, 130, 246, 0.25)' : '0 4px 16px -4px rgba(15, 45, 92, 0.08)',
                      }}
                    >
                      {/* Plan Name */}
                      <h3 
                        className="text-lg font-semibold mb-4"
                        style={{ color: pricingTheme.colors.textPrimary }}
                        data-testid={`text-plan-name-${index}`}
                      >
                        {plan.name}
                      </h3>
                      
                      {/* Price Section */}
                      <div className="mb-3">
                        <p className="text-xs mb-1" style={{ color: pricingTheme.colors.textMuted }}>
                          Starts at
                        </p>
                        {billingCycle === 'yearly' && (
                          <div className="mb-1 flex items-baseline gap-2">
                            <span 
                              className="text-lg"
                              style={{ 
                                color: '#EF4444',
                                textDecoration: 'line-through',
                                textDecorationColor: '#EF4444',
                                textDecorationThickness: '2px'
                              }}
                              data-testid={`text-plan-original-price-${index}`}
                            >
                              {formatPrice(getOriginalYearlyPrice(plan), plan.currency)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span 
                            className="text-4xl font-bold"
                            style={{ color: pricingTheme.colors.textPrimary }}
                            data-testid={`text-plan-price-${index}`}
                          >
                            {formatPrice(displayPrice, plan.currency)}
                          </span>
                          <span 
                            className="text-sm"
                            style={{ color: pricingTheme.colors.textMuted }}
                          >
                            {billingCycle === 'yearly' ? 'annual' : 'per month'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Plan Description */}
                      <p 
                        className="text-sm mb-5 leading-relaxed"
                        style={{ color: pricingTheme.colors.textSecondary }}
                      >
                        {planDescription}
                      </p>
                      
                      {/* CTA Button */}
                      <button
                        className="w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 mb-6"
                        style={{
                          backgroundColor: popular ? '#0099FF' : '#FFFFFF',
                          color: popular ? '#FFFFFF' : pricingTheme.colors.textPrimary,
                          border: popular ? 'none' : `1px solid ${pricingTheme.colors.cardBorder}`,
                        }}
                        onMouseEnter={(e) => {
                          if (popular) {
                            e.currentTarget.style.backgroundColor = '#0086E8';
                          } else {
                            e.currentTarget.style.backgroundColor = '#F8FAFC';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (popular) {
                            e.currentTarget.style.backgroundColor = '#0099FF';
                          } else {
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                          }
                        }}
                        onClick={() => !enterprise && !isSelecting && onSelectPlan?.(plan.id, billingCycle)}
                        disabled={isSelecting}
                        data-testid={`button-select-plan-${index}`}
                      >
                        {isSelecting && selectingPlanId === plan.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Selecting...
                          </span>
                        ) : 'Get started'}
                      </button>
                      
                      {/* Features Section */}
                      <div className="flex-1">
                        {/* Feature Header */}
                        <p 
                          className="text-sm font-semibold mb-3"
                          style={{ color: pricingTheme.colors.textPrimary }}
                        >
                          {featureHeader}
                        </p>
                        
                        {/* Feature List */}
                        <div className="space-y-2">
                          {sortedFeatures.filter(f => f.isActive).length > 0 ? (
                            sortedFeatures.filter(f => f.isActive).map((feature, idx) => {
                              const included = displayFeatures.includes(feature.id);
                              return (
                                <div
                                  key={feature.id}
                                  className="flex items-center gap-2"
                                  data-testid={`feature-${index}-${idx}`}
                                >
                                  {included ? (
                                    <Check 
                                      className="flex-shrink-0"
                                      style={{ 
                                        width: '16px', 
                                        height: '16px', 
                                        color: '#64748B'
                                      }} 
                                    />
                                  ) : (
                                    <X 
                                      className="flex-shrink-0"
                                      style={{ 
                                        width: '16px', 
                                        height: '16px', 
                                        color: '#EF4444'
                                      }} 
                                    />
                                  )}
                                  <span 
                                    className="text-sm"
                                    style={{ color: included ? pricingTheme.colors.textSecondary : '#9CA3AF' }}
                                  >
                                    {feature.name}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <Check className="flex-shrink-0" style={{ width: '16px', height: '16px', color: '#64748B' }} />
                                <span className="text-sm" style={{ color: pricingTheme.colors.textSecondary }}>
                                  {index === 0 ? '1 user' : index === 1 ? '1 team' : '1 parent team and unlimited sub-teams'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="flex-shrink-0" style={{ width: '16px', height: '16px', color: '#64748B' }} />
                                <span className="text-sm" style={{ color: pricingTheme.colors.textSecondary }}>
                                  {index === 0 ? 'Unlimited calendars' : index === 1 ? 'Schedule meetings as a team' : 'Organization workflows'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="flex-shrink-0" style={{ width: '16px', height: '16px', color: '#64748B' }} />
                                <span className="text-sm" style={{ color: pricingTheme.colors.textSecondary }}>
                                  {index === 0 ? 'Unlimited event types' : index === 1 ? 'Round-Robin, Fixed Round-Robin' : 'Insights - analyze your booking data'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="flex-shrink-0" style={{ width: '16px', height: '16px', color: '#64748B' }} />
                                <span className="text-sm" style={{ color: pricingTheme.colors.textSecondary }}>
                                  {index === 0 ? 'Workflows' : index === 1 ? 'Collective Events' : 'Active directory sync'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="flex-shrink-0" style={{ width: '16px', height: '16px', color: '#64748B' }} />
                                <span className="text-sm" style={{ color: pricingTheme.colors.textSecondary }}>
                                  {index === 0 ? 'Integrate with your favorite apps' : index === 1 ? 'Advanced Routing Forms' : '24/7 Email, Chat and Phone support'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Check className="flex-shrink-0" style={{ width: '16px', height: '16px', color: '#64748B' }} />
                                <span className="text-sm" style={{ color: pricingTheme.colors.textSecondary }}>
                                  {index === 0 ? 'Accept payments via Stripe' : index === 1 ? 'Team Workflows' : 'Sync your HRIS tools'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showTrialInfo && (
            <div className="text-center mt-4 py-2">
              <p className="text-xs" style={{ color: pricingTheme.colors.textMuted }}>
                All plans include a free trial. No credit card required.{' '}
                <a 
                  href="mailto:hello@curbe.io" 
                  className="hover:underline font-medium"
                  style={{ color: pricingTheme.colors.textPrimary }}
                  data-testid="link-contact-sales"
                >
                  Contact sales
                </a>
              </p>
            </div>
          )}
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
  const [editFormTab, setEditFormTab] = useState<"basic" | "pricing" | "features">("basic");
  const [featureAssignments, setFeatureAssignments] = useState<FeatureAssignmentState>({});
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  const { data: sessionData, isLoading: sessionLoading } = useQuery<{ user: { id: string; email: string; role: string; companyId: string | null } }>({
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

  const saveFeatureAssignmentsMutation = useMutation({
    mutationFn: async ({ planId, assignments }: { planId: string; assignments: { featureId: string; included: boolean; sortOrder: number }[] }) => {
      const response = await fetch(`/api/plans/${planId}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(assignments),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save feature assignments");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save feature assignments", description: error.message, variant: "destructive" });
    },
  });

  const loadFeatureAssignments = async (planId: string) => {
    setIsLoadingAssignments(true);
    try {
      const response = await fetch(`/api/plans/${planId}/features`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const assignments: FeatureAssignmentState = {};
        (data.assignments || []).forEach((a: PlanFeatureAssignment) => {
          assignments[a.featureId] = a.included;
        });
        setFeatureAssignments(assignments);
      } else {
        setFeatureAssignments({});
      }
    } catch {
      setFeatureAssignments({});
    }
    setIsLoadingAssignments(false);
  };

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
      maxUsers: undefined,
      annualPrice: undefined,
      stripeAnnualPriceId: "",
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

  async function onSubmit(values: InsertPlan) {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, values }, {
        onSuccess: async () => {
          const sortedFeaturesList = [...planFeatures].sort((a, b) => a.sortOrder - b.sortOrder);
          const assignments = sortedFeaturesList.map((feature, idx) => ({
            featureId: feature.id,
            included: featureAssignments[feature.id] ?? false,
            sortOrder: idx,
          }));
          await saveFeatureAssignmentsMutation.mutateAsync({ planId: editingPlan.id, assignments });
        },
      });
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
    setEditFormTab("basic");
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
      maxUsers: plan.maxUsers ?? undefined,
      annualPrice: plan.annualPrice ?? undefined,
      stripeAnnualPriceId: plan.stripeAnnualPriceId || "",
    });
    loadFeatureAssignments(plan.id);
    setIsDialogOpen(true);
  }

  function handleCreate() {
    setEditingPlan(null);
    setEditFormTab("basic");
    setFeatureAssignments({});
    form.reset({
      name: "",
      description: "",
      price: 0,
      setupFee: 0,
      currency: "usd",
      billingCycle: "monthly",
      trialDays: 0,
      isActive: true,
      maxUsers: undefined,
      annualPrice: undefined,
      stripeAnnualPriceId: "",
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

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user?.role !== "superadmin") {
    return <PublicPricingView planFeatures={planFeatures} publicPlans={publicPlans} isLoading={featuresLoading || publicPlansLoading} showTrialInfo={true} />;
  }

  if (viewMode === "public") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setViewMode("admin")}
            data-testid="button-toggle-admin-view"
          >
            Switch to Admin View
          </Button>
        </div>
        <PublicPricingView planFeatures={planFeatures} publicPlans={publicPlans} isLoading={featuresLoading || publicPlansLoading} showTrialInfo={true} />
      </div>
    );
  }

  const sortedPlanFeatures = [...planFeatures].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
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
            <div className="grid gamd:grid-cols-2 lg:grid-cols-3">
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
            <div className="grid gamd:grid-cols-2 lg:grid-cols-3">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan ? "Update plan details, pricing, and feature assignments" : "Create a new subscription plan"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Tabs value={editFormTab} onValueChange={(v) => setEditFormTab(v as "basic" | "pricing" | "features")} className="w-full">
                <TabsList className="grid w-full grid-cols-3" data-testid="tabs-plan-edit">
                  <TabsTrigger value="basic" data-testid="tab-plan-basic">
                    <Settings className="h-4 w-4 mr-2" />
                    Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="pricing" data-testid="tab-plan-pricing">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Pricing
                  </TabsTrigger>
                  <TabsTrigger value="features" data-testid="tab-plan-features" disabled={!editingPlan}>
                    <Zap className="h-4 w-4 mr-2" />
                    Features
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
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
                    name="maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Users</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="Leave empty for unlimited"
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === "" ? undefined : parseInt(val) || undefined);
                            }}
                            data-testid="input-plan-max-users"
                          />
                        </FormControl>
                        <FormDescription>
                          Leave empty for unlimited users. Suggested: Shared=1, Dedicated=5, Unlimited=empty
                        </FormDescription>
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
                </TabsContent>

                <TabsContent value="pricing" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Price (cents)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              placeholder="2999"
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-plan-price"
                            />
                          </FormControl>
                          <FormDescription>${((field.value || 0) / 100).toFixed(2)}/month</FormDescription>
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
                          <FormDescription>${((field.value || 0) / 100).toFixed(2)} one-time</FormDescription>
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
                        <FormLabel>Stripe Monthly Price ID (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="price_xxxxx" data-testid="input-stripe-price-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Annual Pricing (Optional)
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="annualPrice"
                        render={({ field }) => {
                          const monthlyPrice = form.watch("price") || 0;
                          const annualValue = field.value ?? 0;
                          const monthlyEquivalent = annualValue ? (annualValue / 12) : 0;
                          const fullYearlyAtMonthly = monthlyPrice * 12;
                          const savingsPercent = annualValue && fullYearlyAtMonthly > 0 
                            ? Math.round(((fullYearlyAtMonthly - annualValue) / fullYearlyAtMonthly) * 100)
                            : 0;
                          
                          return (
                            <FormItem>
                              <FormLabel>Annual Price (cents)</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  placeholder="Leave empty for default (10x monthly)"
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    field.onChange(val === "" ? undefined : parseInt(val) || undefined);
                                  }}
                                  data-testid="input-plan-annual-price"
                                />
                              </FormControl>
                              <FormDescription>
                                {annualValue ? (
                                  <span>
                                    ${(annualValue / 100).toFixed(2)}/year 
                                    (${(monthlyEquivalent / 100).toFixed(2)}/mo)
                                    {savingsPercent > 0 && (
                                      <Badge className="ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-annual-savings">
                                        Save {savingsPercent}%
                                      </Badge>
                                    )}
                                  </span>
                                ) : (
                                  <span>Default: ${((monthlyPrice * 10) / 100).toFixed(2)}/year (10 months)</span>
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />

                      <FormField
                        control={form.control}
                        name="stripeAnnualPriceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stripe Annual Price ID</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="price_xxxxx_annual" 
                                data-testid="input-stripe-annual-price-id" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="features" className="space-y-4 mt-4">
                  {!editingPlan ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Save the plan first to configure features</p>
                    </div>
                  ) : isLoadingAssignments ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading feature assignments...</span>
                    </div>
                  ) : planFeatures.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No features configured yet</p>
                      <p className="text-sm mt-1">Add features in the Features tab first</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-4">
                        Toggle which features are included in this plan. Green check = included, Red X = not included.
                      </p>
                      <div className="rounded-md border">
                        {[...planFeatures].sort((a, b) => a.sortOrder - b.sortOrder).map((feature) => {
                          const isIncluded = featureAssignments[feature.id] ?? false;
                          return (
                            <div 
                              key={feature.id}
                              className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                              data-testid={`feature-assignment-${feature.id}`}
                            >
                              <div className="flex items-center gap-3">
                                {isIncluded ? (
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900" data-testid={`feature-status-included-${feature.id}`}>
                                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900" data-testid={`feature-status-excluded-${feature.id}`}>
                                    <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-sm" data-testid={`feature-name-${feature.id}`}>{feature.name}</p>
                                  {feature.description && (
                                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                                  )}
                                </div>
                              </div>
                              <Switch
                                checked={isIncluded}
                                onCheckedChange={(checked) => {
                                  setFeatureAssignments(prev => ({
                                    ...prev,
                                    [feature.id]: checked,
                                  }));
                                }}
                                data-testid={`switch-feature-${feature.id}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-plan">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || saveFeatureAssignmentsMutation.isPending}
                  data-testid="button-submit-plan"
                >
                  {(createMutation.isPending || updateMutation.isPending || saveFeatureAssignmentsMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
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
