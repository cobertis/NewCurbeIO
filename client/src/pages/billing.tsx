import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { 
  CreditCard, 
  FileText, 
  Download, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  Rocket,
  Clock,
  TrendingUp,
  Gift,
  Shield,
  AlertTriangle,
  RefreshCw,
  X,
  Zap,
  Trophy,
  Target,
  ChevronRight,
  Info,
  Receipt,
  Sparkles,
  ArrowRight,
  CreditCard as CardIcon,
  Building2,
  Pencil,
  MapPin
} from "lucide-react";
import { formatDate } from "@/lib/date-formatter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StripeCardForm } from "@/components/stripe-card-form";
import { ManagePaymentMethodsDialog } from "@/components/manage-payment-methods-dialog";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";

interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  billingCycle?: string;
  trialStart?: string;
  trialEnd?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  plan: {
    id: string;
    name: string;
    description?: string;
    price: number;
    annualPrice?: number;
    billingCycle: string;
    currency: string;
    features?: string[];
    trialDays?: number;
  };
  stripeDetails?: any;
}

interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: string;
  currency: string;
  features?: string[];
  stripePriceId?: string;
  stripeAnnualPriceId?: string;
  trialDays?: number;
  isActive: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  amountDue: number;
  amountPaid: number;
  currency: string;
  invoiceDate: string;
  dueDate?: string;
  paidAt?: string;
  stripeHostedInvoiceUrl?: string;
  stripeInvoicePdf?: string;
  description?: string;
  items?: any[];
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  processedAt?: string;
  createdAt: string;
  description?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

// Helper component to render card brand logo
const CardBrandLogo = ({ brand }: { brand: string }) => {
  if (!brand) {
    // Fallback when brand is not provided
    return (
      <div className="flex items-center justify-center w-16 h-10 bg-muted rounded border border-border">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  
  const brandLower = brand.toLowerCase();
  
  // Return styled brand name with appropriate colors
  if (brandLower === 'visa') {
    return (
      <div className="flex items-center justify-center w-16 h-10 bg-white dark:bg-gray-100 rounded border border-border px-2">
        <span className="text-[#1434CB] font-bold text-xl tracking-tight">VISA</span>
      </div>
    );
  } else if (brandLower === 'mastercard') {
    return (
      <div className="flex items-center justify-center w-16 h-10 bg-white dark:bg-gray-100 rounded border border-border">
        <div className="flex -space-x-2">
          <div className="w-4 h-4 rounded-full bg-[#EB001B]"></div>
          <div className="w-4 h-4 rounded-full bg-[#F79E1B]"></div>
        </div>
      </div>
    );
  } else if (brandLower === 'amex' || brandLower === 'american express') {
    return (
      <div className="flex items-center justify-center w-16 h-10 bg-[#006FCF] rounded border border-border px-1">
        <span className="text-white font-bold text-xs">AMEX</span>
      </div>
    );
  } else if (brandLower === 'discover') {
    return (
      <div className="flex items-center justify-center w-16 h-10 bg-[#FF6000] rounded border border-border px-1">
        <span className="text-white font-bold text-xs">DISCOVER</span>
      </div>
    );
  } else {
    // Default fallback
    return (
      <div className="flex items-center justify-center w-16 h-10 bg-muted rounded border border-border">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
};

export default function Billing() {
  const { toast } = useToast();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showManageCards, setShowManageCards] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [showSkipTrialDialog, setShowSkipTrialDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pendingSkipTrial, setPendingSkipTrial] = useState(false);

  // Fetch session data to get user info
  const { data: sessionData } = useQuery({
    queryKey: ['/api/session'],
  });

  const user = sessionData?.user;

  // Fetch company data
  const { data: companyData } = useQuery({
    queryKey: ['/api/companies', user?.companyId],
    enabled: !!user?.companyId,
  });

  const company = companyData?.company;

  // Fetch subscription data with enhanced trial info
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['/api/billing/subscription'],
  });

  // Fetch available plans
  const { data: plansData } = useQuery({
    queryKey: ['/api/plans'],
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['/api/billing/invoices'],
  });

  // Fetch payments
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['/api/billing/payments'],
  });

  // Fetch payment methods
  const { data: paymentMethodsData } = useQuery({
    queryKey: ['/api/billing/payment-methods'],
  });

  // Fetch billing address
  const { data: billingAddressData } = useQuery({
    queryKey: ['/api/billing/address'],
  });

  const billingAddress = billingAddressData?.billingAddress;

  // Fetch active discount
  const { data: discountData } = useQuery({
    queryKey: ['/api/billing/active-discount'],
    enabled: !!subscriptionData?.subscription,
  });

  const activeDiscount = discountData?.discount;

  // Billing address form state
  const [billingForm, setBillingForm] = useState({
    fullName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  });

  // Update form when billing address or company data loads
  useEffect(() => {
    if (billingAddress) {
      // If billing address exists, use it
      setBillingForm({
        fullName: billingAddress.fullName || '',
        addressLine1: billingAddress.addressLine1 || '',
        addressLine2: billingAddress.addressLine2 || '',
        city: billingAddress.city || '',
        state: billingAddress.state || '',
        postalCode: billingAddress.postalCode || '',
      });
    } else if (company) {
      // Otherwise, use company data as default
      const fullName = company.representativeFirstName && company.representativeLastName
        ? `${company.representativeFirstName} ${company.representativeLastName}`
        : user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : '';
      
      setBillingForm({
        fullName,
        addressLine1: company.address || '',
        addressLine2: company.addressLine2 || '',
        city: company.city || '',
        state: company.state || '',
        postalCode: company.postalCode || '',
      });
    }
  }, [billingAddress, company, user]);

  // Save billing address mutation
  const saveBillingAddressMutation = useMutation({
    mutationFn: async (data: typeof billingForm) => {
      const result = await apiRequest("POST", "/api/billing/address", data);
      return result.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Billing information saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/address'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save billing information",
        variant: "destructive",
      });
    },
  });

  const handleBillingFormChange = (field: string, value: string) => {
    setBillingForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBillingFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveBillingAddressMutation.mutate(billingForm);
  };

  const handleBillingFormCancel = () => {
    // Reset form to original values
    if (billingAddress) {
      setBillingForm({
        fullName: billingAddress.fullName || '',
        addressLine1: billingAddress.addressLine1 || '',
        addressLine2: billingAddress.addressLine2 || '',
        city: billingAddress.city || '',
        state: billingAddress.state || '',
        postalCode: billingAddress.postalCode || '',
      });
    } else if (company) {
      const fullName = company.representativeFirstName && company.representativeLastName
        ? `${company.representativeFirstName} ${company.representativeLastName}`
        : user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : '';
      
      setBillingForm({
        fullName,
        addressLine1: company.address || '',
        addressLine2: company.addressLine2 || '',
        city: company.city || '',
        state: company.state || '',
        postalCode: company.postalCode || '',
      });
    }
  };

  // Create customer portal session
  const portalMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/portal", {});
      return result.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
        variant: "destructive",
      });
    },
  });

  // Skip trial mutation
  const skipTrialMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/skip-trial", {});
      return result.json();
    },
    onSuccess: () => {
      toast({
        title: "Trial Skipped",
        description: "Your subscription is now active. Enjoy all features!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to skip trial",
        variant: "destructive",
      });
    },
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod }: { planId: string; billingPeriod: string }) => {
      const result = await apiRequest("POST", "/api/billing/change-plan", {
        planId,
        billingPeriod
      });
      return result.json();
    },
    onSuccess: () => {
      toast({
        title: "Plan Changed",
        description: "Your subscription plan has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
      setShowChangePlan(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change plan",
        variant: "destructive",
      });
    },
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/cancel-subscription", {});
      return result.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will be cancelled at the end of the billing period",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Apply coupon mutation
  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const result = await apiRequest("POST", "/api/billing/apply-coupon", { code });
      return result.json();
    },
    onSuccess: (data) => {
      setAppliedCoupon(data.coupon);
      toast({
        title: "Coupon Applied",
        description: `${data.coupon.percentOff || data.coupon.amountOff}% discount applied!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Invalid coupon code",
        variant: "destructive",
      });
    },
  });

  const subscription: Subscription | null = (subscriptionData as any)?.subscription || null;
  const plans: Plan[] = (plansData as any)?.plans || [];
  const invoices: Invoice[] = (invoicesData as any)?.invoices || [];
  const payments: Payment[] = (paymentsData as any)?.payments || [];
  const paymentMethods: PaymentMethod[] = (paymentMethodsData as any)?.paymentMethods || [];

  // Calculate trial days remaining
  const calculateTrialDaysRemaining = () => {
    if (!subscription || subscription.status !== 'trialing' || !subscription.trialEnd) {
      return 0;
    }
    const now = new Date();
    const trialEndDate = new Date(subscription.trialEnd);
    const diffTime = trialEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const trialDaysRemaining = calculateTrialDaysRemaining();
  const trialProgress = subscription?.plan?.trialDays 
    ? ((subscription.plan.trialDays - trialDaysRemaining) / subscription.plan.trialDays) * 100 
    : 0;


  // Calculate savings for annual billing
  const calculateAnnualSavings = (monthlyPrice: number) => {
    const yearlyPrice = monthlyPrice * 12;
    const discountedYearlyPrice = yearlyPrice * 0.8; // 20% discount
    return yearlyPrice - discountedYearlyPrice;
  };

  // Calculate total spending
  const totalSpending = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      active: { label: "Active", variant: "default", icon: CheckCircle2 },
      trialing: { label: "Trial", variant: "secondary", icon: Clock },
      past_due: { label: "Past Due", variant: "destructive", icon: AlertTriangle },
      cancelled: { label: "Cancelled", variant: "outline", icon: X },
      unpaid: { label: "Unpaid", variant: "destructive", icon: AlertCircle },
    };

    const config = statusConfig[status] || { label: status, variant: "outline", icon: Info };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header with Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Manage your subscription, payment methods, and billing history
          </p>
        </div>
        {subscription && (
          <Button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            variant="outline"
            data-testid="button-customer-portal"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Customer Portal
          </Button>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subscription Details - 2 columns */}
        {isLoadingSubscription ? (
          <Card className="lg:col-span-2">
            <CardContent className="space-y-6 pt-6">
              {/* Plan Details Skeleton */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-full max-w-md" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-10 w-32 ml-auto" />
                  <Skeleton className="h-4 w-24 ml-auto" />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <Separator />
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : subscription ? (
          <Card className="lg:col-span-2">
            <CardContent className="space-y-6 pt-6">
              {/* Plan Details */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    {subscription.plan.name}
                    {subscription.status === 'trialing' && (
                      <Badge variant="secondary" className="ml-2">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Trial
                      </Badge>
                    )}
                  </h3>
                  {subscription.plan.description && (
                    <p className="text-sm text-muted-foreground">{subscription.plan.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {subscription.plan.features && Array.isArray(subscription.plan.features) && subscription.plan.features.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  {(() => {
                    const displayPrice = subscription.billingCycle === 'yearly' 
                      ? subscription.plan.annualPrice || subscription.plan.price 
                      : subscription.plan.price;

                    return activeDiscount && activeDiscount.percentOff ? (
                      <>
                        <div className="text-lg font-medium text-muted-foreground line-through">
                          {formatCurrency(displayPrice, subscription.plan.currency)}
                        </div>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          {formatCurrency(
                            Math.round(displayPrice * (1 - activeDiscount.percentOff / 100)),
                            subscription.plan.currency
                          )}
                        </div>
                        <Badge className="mt-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          <Gift className="h-3 w-3 mr-1" />
                          {activeDiscount.percentOff}% discount applied
                        </Badge>
                      </>
                    ) : (
                      <div className="text-3xl font-bold">
                        {formatCurrency(displayPrice, subscription.plan.currency)}
                      </div>
                    );
                  })()}
                  <p className="text-sm text-muted-foreground mt-1">
                    {subscription.billingCycle === 'yearly' ? 'Billed Annually' : 'per month'}
                  </p>
                  {subscription.billingCycle === 'yearly' && (
                    <Badge variant="secondary" className="mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Annual Plan
                    </Badge>
                  )}
                </div>
              </div>

              {/* Active Discount Alert */}
              {activeDiscount && activeDiscount.percentOff && (
                <Alert className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                  <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-900 dark:text-green-100">
                    {activeDiscount.percentOff}% Discount Active
                  </AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    {activeDiscount.durationInMonths ? (
                      <>
                        You have a {activeDiscount.percentOff}% discount applied for {activeDiscount.durationInMonths} month{activeDiscount.durationInMonths > 1 ? 's' : ''}.
                        {activeDiscount.end && (
                          <> This discount will expire on {formatDate(new Date(activeDiscount.end))}.</>
                        )}
                      </>
                    ) : (
                      activeDiscount.duration === 'forever' ? 
                        `You have a permanent ${activeDiscount.percentOff}% discount on your subscription.` : 
                        activeDiscount.duration === 'once' ? 
                        `You have a one-time ${activeDiscount.percentOff}% discount applied to your current billing period.` :
                        `You have a ${activeDiscount.percentOff}% discount active on your subscription.`
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              {/* Billing Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Current Period
                  </div>
                  <p className="text-sm font-medium">
                    {formatDate(new Date(subscription.currentPeriodStart))} - {formatDate(new Date(subscription.currentPeriodEnd))}
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Next Payment
                  </div>
                  <p className="text-sm font-medium">
                    {subscription.status === 'trialing' && subscription.trialEnd
                      ? `After trial ends (${formatDate(new Date(subscription.trialEnd))})`
                      : formatDate(new Date(subscription.currentPeriodEnd))
                    }
                  </p>
                </div>
                {subscription.stripeCustomerId && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      Customer ID
                    </div>
                    <p className="text-sm font-mono">{subscription.stripeCustomerId}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    Renewal
                  </div>
                  <p className="text-sm font-medium">
                    {subscription.cancelAtPeriodEnd ? "Cancelling at period end" : "Auto-renew enabled"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {subscription.status === 'trialing' && trialDaysRemaining > 0 && (
                  <Button
                    variant="default"
                    onClick={() => {
                      // Check if payment method exists first
                      if (!paymentMethods || paymentMethods.length === 0) {
                        // No payment method - open add card modal and set pending flag
                        setPendingSkipTrial(true);
                        setShowAddCard(true);
                        toast({
                          title: "Payment Method Required",
                          description: "Please add a payment method to skip your trial and activate your subscription.",
                        });
                      } else {
                        // Payment method exists - show confirmation dialog
                        setShowSkipTrialDialog(true);
                      }
                    }}
                    disabled={skipTrialMutation.isPending}
                    data-testid="button-skip-trial"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {skipTrialMutation.isPending ? 'Activating...' : 'Skip Trial & Pay Now'}
                  </Button>
                )}
                <Button
                  variant={subscription.status === 'trialing' ? "outline" : "default"}
                  onClick={() => setShowChangePlan(true)}
                  data-testid="button-change-plan"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Change Plan
                </Button>
                {!subscription.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                    className="text-red-600 hover:text-red-700"
                    data-testid="button-cancel-subscription"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>

              {subscription.cancelAtPeriodEnd && (
                <Alert className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <AlertTitle className="text-orange-900 dark:text-orange-100">
                    Subscription Ending
                  </AlertTitle>
                  <AlertDescription className="text-orange-700 dark:text-orange-300">
                    Your subscription will end on {formatDate(new Date(subscription.currentPeriodEnd))}.
                    You can reactivate anytime before this date.
                  </AlertDescription>
                </Alert>
              )}
            {/* Payment Methods */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                <span>Payment Methods</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowManageCards(true)}
                  data-testid="button-manage-cards"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Manage Cards
                </Button>
              </h3>
              {paymentMethods && paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                      <CardBrandLogo brand={method.brand || ''} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">
                            {method.brand ? (method.brand.charAt(0).toUpperCase() + method.brand.slice(1)) : 'Card'} •••• {method.last4 || '****'}
                          </p>
                          {method.isDefault && (
                            <Badge variant="secondary" className="shrink-0 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expMonth || '**'}/{method.expYear || '****'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg bg-muted/30">
                  <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No payment method on file
                  </p>
                  <Button
                    onClick={() => setShowAddCard(true)}
                    data-testid="button-add-first-card"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              )}
            </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Billing Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Billing Information
            </CardTitle>
            <CardDescription>Update your billing information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBillingFormSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name on Card</label>
                <Input
                  placeholder="John Doe"
                  value={billingForm.fullName}
                  onChange={(e) => handleBillingFormChange('fullName', e.target.value)}
                  data-testid="input-billing-name"
                />
              </div>

              {/* Address Line 1 with Google Places Autocomplete */}
              <GooglePlacesAddressAutocomplete
                value={billingForm.addressLine1}
                onChange={(value) => handleBillingFormChange('addressLine1', value)}
                onAddressSelect={(address) => {
                  // Auto-populate city, state, and postal code when address is selected
                  setBillingForm(prev => ({
                    ...prev,
                    addressLine1: address.street,
                    city: address.city,
                    state: address.state,
                    postalCode: address.postalCode,
                  }));
                }}
                label="Address Line 1"
                placeholder="Start typing your address..."
                testId="input-billing-address1"
              />

              {/* Address Line 2 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Address Line 2</label>
                <Input
                  placeholder="Apt., suite, unit number, etc. (optional)"
                  value={billingForm.addressLine2}
                  onChange={(e) => handleBillingFormChange('addressLine2', e.target.value)}
                  data-testid="input-billing-address2"
                />
              </div>

              {/* City, State and ZIP Code */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">City</label>
                  <Input
                    placeholder="New York"
                    value={billingForm.city}
                    onChange={(e) => handleBillingFormChange('city', e.target.value)}
                    data-testid="input-billing-city"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <Input
                    placeholder="NY"
                    value={billingForm.state}
                    onChange={(e) => handleBillingFormChange('state', e.target.value)}
                    data-testid="input-billing-state"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">ZIP Code</label>
                  <Input
                    placeholder="10001"
                    value={billingForm.postalCode}
                    onChange={(e) => handleBillingFormChange('postalCode', e.target.value)}
                    data-testid="input-billing-zip"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBillingFormCancel}
                  data-testid="button-billing-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saveBillingAddressMutation.isPending}
                  data-testid="button-billing-save"
                >
                  {saveBillingAddressMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>View your invoices and payment history</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="invoices" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="space-y-4 mt-4">
              {isLoadingInvoices ? (
                <div className="flex items-center justify-center py-12">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                </div>
              ) : invoices.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.invoiceNumber}
                          </TableCell>
                          <TableCell>{formatDate(new Date(invoice.invoiceDate))}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={invoice.status === 'paid' ? 'default' : invoice.status === 'open' ? 'secondary' : 'outline'}
                            >
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.total, invoice.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {invoice.stripeHostedInvoiceUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(invoice.stripeHostedInvoiceUrl, '_blank')}
                                  data-testid={`button-view-invoice-${invoice.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              {invoice.stripeInvoicePdf && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(invoice.stripeInvoicePdf, '_blank')}
                                  data-testid={`button-download-invoice-${invoice.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Invoices Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Invoices will appear here once you start your subscription.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="space-y-4 mt-4">
              {isLoadingPayments ? (
                <div className="flex items-center justify-center py-12">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                </div>
              ) : payments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(new Date(payment.createdAt))}</TableCell>
                          <TableCell>{payment.paymentMethod || 'Card'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={payment.status === 'succeeded' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(payment.amount, payment.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Payments Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Your payment history will appear here.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Change Your Plan</DialogTitle>
            <DialogDescription>
              Select a new plan and billing period. Changes will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center gap-4 p-3 rounded-lg bg-muted/50">
              <span className={billingPeriod === 'monthly' ? 'font-bold' : 'text-muted-foreground'}>
                Monthly
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              >
                {billingPeriod === 'yearly' ? 'Switch to Monthly' : 'Switch to Yearly (Save 20%)'}
              </Button>
              <span className={billingPeriod === 'yearly' ? 'font-bold' : 'text-muted-foreground'}>
                Yearly
              </span>
            </div>

            {/* Plans List */}
            <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan}>
              {plans.filter(p => p.isActive).map((plan) => (
                <div key={plan.id} className="relative">
                  <RadioGroupItem
                    value={plan.id}
                    id={plan.id}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={plan.id}
                    className="flex items-center justify-between rounded-lg border-2 border-muted bg-card p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          billingPeriod === 'yearly' ? plan.price * 12 * 0.8 : plan.price,
                          plan.currency
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        per {billingPeriod === 'yearly' ? 'year' : 'month'}
                      </p>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePlan(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => changePlanMutation.mutate({ planId: selectedPlan, billingPeriod })}
              disabled={!selectedPlan || changePlanMutation.isPending}
            >
              {changePlanMutation.isPending ? "Changing..." : "Change Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddCard} onOpenChange={(open) => {
        setShowAddCard(open);
        // If closing the dialog, clear pending skip trial flag
        if (!open) {
          setPendingSkipTrial(false);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Enter your card details below. Your payment information is securely processed by Stripe.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <StripeCardForm
              onSuccess={() => {
                toast({
                  title: "Success!",
                  description: "Payment method added successfully.",
                });
                setShowAddCard(false);
                // Refresh payment methods
                queryClient.invalidateQueries({ queryKey: ['/api/billing/payment-methods'] });
                
                // If we were waiting to skip trial, do it now
                if (pendingSkipTrial) {
                  setPendingSkipTrial(false);
                  skipTrialMutation.mutate();
                }
              }}
              onError={(error) => {
                toast({
                  title: "Error",
                  description: error,
                  variant: "destructive",
                });
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Payment Methods Dialog */}
      <ManagePaymentMethodsDialog
        open={showManageCards}
        onOpenChange={setShowManageCards}
        paymentMethods={paymentMethods || []}
      />

      {/* Skip Trial Confirmation Dialog */}
      <AlertDialog open={showSkipTrialDialog} onOpenChange={setShowSkipTrialDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip Trial & Activate Now?</AlertDialogTitle>
            <AlertDialogDescription>
              Your trial will end immediately and your card will be charged for the subscription. You can still cancel anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                skipTrialMutation.mutate();
                setShowSkipTrialDialog(false);
              }}
              disabled={skipTrialMutation.isPending}
            >
              {skipTrialMutation.isPending ? 'Activating...' : 'Activate Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of your current billing period. You can reactivate anytime before then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelSubscriptionMutation.mutate();
                setShowCancelDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}