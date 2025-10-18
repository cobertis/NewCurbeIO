import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Building2
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
import { useLocation } from "wouter";

interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: string;
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
  stripeYearlyPriceId?: string;
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
  isDefault?: boolean;
}

export default function Billing() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

  // Check user session and redirect superadmins
  const { data: sessionData } = useQuery({
    queryKey: ['/api/session'],
  });

  // Redirect superadmins to companies page
  useEffect(() => {
    if (sessionData?.user?.role === 'superadmin') {
      toast({
        title: "Access Restricted",
        description: "Superadmins manage billing through the Companies page",
        variant: "default",
      });
      setLocation('/companies');
    }
  }, [sessionData, setLocation, toast]);

  // Fetch subscription data with enhanced trial info
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['/api/billing/subscription'],
    enabled: sessionData?.user?.role !== 'superadmin', // Don't fetch if superadmin
  });

  // Fetch available plans
  const { data: plansData } = useQuery({
    queryKey: ['/api/plans'],
    enabled: sessionData?.user?.role !== 'superadmin',
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['/api/billing/invoices'],
    enabled: sessionData?.user?.role !== 'superadmin',
  });

  // Fetch payments
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['/api/billing/payments'],
    enabled: sessionData?.user?.role !== 'superadmin',
  });

  // Fetch payment methods
  const { data: paymentMethodsData } = useQuery({
    queryKey: ['/api/billing/payment-methods'],
    enabled: sessionData?.user?.role !== 'superadmin',
  });

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

      {/* Trial Status Alert */}
      {subscription?.status === 'trialing' && trialDaysRemaining > 0 && (
        <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <Rocket className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Trial Period - {trialDaysRemaining} days remaining
          </AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <div className="space-y-3 mt-2">
              <p>
                Your trial will end on {formatDate(new Date(subscription.trialEnd!))}. 
                After that, you'll be charged {formatCurrency(subscription.plan.price, subscription.plan.currency)} per {subscription.plan.billingCycle}.
              </p>
              <Progress value={trialProgress} className="h-2" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => skipTrialMutation.mutate()}
                  disabled={skipTrialMutation.isPending}
                  data-testid="button-skip-trial"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Skip Trial & Activate Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddCard(true)}
                  data-testid="button-add-payment"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Plan Card - Enhanced */}
        {subscription && (
          <Card className="lg:col-span-2 border-2">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">Current Plan</CardTitle>
                  <CardDescription>Your subscription details and usage</CardDescription>
                </div>
                {getStatusBadge(subscription.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
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
                    {subscription.plan.features?.map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">
                    {formatCurrency(subscription.plan.price, subscription.plan.currency)}
                  </div>
                  <p className="text-sm text-muted-foreground">per {subscription.plan.billingCycle}</p>
                  {subscription.plan.billingCycle === 'month' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Save {formatCurrency(calculateAnnualSavings(subscription.plan.price), subscription.plan.currency)}/year with annual
                    </p>
                  )}
                </div>
              </div>

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
                    {subscription.status === 'trialing' 
                      ? `After trial ends (${formatDate(new Date(subscription.trialEnd!))})`
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
                <Button
                  variant="default"
                  onClick={() => setShowChangePlan(true)}
                  data-testid="button-change-plan"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Change Plan
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddCard(true)}
                  data-testid="button-manage-payment"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Payment Method
                </Button>
                {!subscription.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel your subscription?")) {
                        cancelSubscriptionMutation.mutate();
                      }
                    }}
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
            </CardContent>
          </Card>
        )}

        {/* Quick Stats Card */}
        <div className="space-y-6">
          {/* Payment Method Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentMethods && paymentMethods.length > 0 ? (
                <>
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <CardIcon className="h-5 w-5" />
                        <div>
                          <p className="font-medium">{method.brand} •••• {method.last4}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {method.expMonth}/{method.expYear}
                          </p>
                        </div>
                      </div>
                      {method.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowAddCard(true)}
                    data-testid="button-update-card"
                  >
                    Update Payment Method
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No payment method on file
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => setShowAddCard(true)}
                    data-testid="button-add-first-card"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Usage Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Billing Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Spending</span>
                  <span className="font-bold">{formatCurrency(totalSpending)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Invoices</span>
                  <span className="font-bold">{invoices.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Payments</span>
                  <span className="font-bold">{payments.filter(p => p.status === 'succeeded').length}</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Estimated Annual Spending</p>
                <p className="text-2xl font-bold">
                  {subscription 
                    ? formatCurrency(
                        subscription.plan.price * (subscription.plan.billingCycle === 'month' ? 12 : 1),
                        subscription.plan.currency
                      )
                    : "$0.00"
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Discount/Coupon Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Apply Discount
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {appliedCoupon ? (
                <Alert>
                  <Trophy className="h-4 w-4" />
                  <AlertTitle>Discount Active</AlertTitle>
                  <AlertDescription>
                    {appliedCoupon.percentOff 
                      ? `${appliedCoupon.percentOff}% off`
                      : formatCurrency(appliedCoupon.amountOff)
                    } applied to your subscription!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    data-testid="input-coupon-code"
                  />
                  <Button
                    className="w-full"
                    onClick={() => applyCouponMutation.mutate(couponCode)}
                    disabled={!couponCode || applyCouponMutation.isPending}
                    data-testid="button-apply-coupon"
                  >
                    Apply Coupon
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Billing History Tabs */}
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
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new payment method to your account. This will be used for future charges.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Secure Payment</AlertTitle>
              <AlertDescription>
                Click the button below to securely add your payment method through Stripe.
                Your card information is never stored on our servers.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCard(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              <Shield className="h-4 w-4 mr-2" />
              {portalMutation.isPending ? "Opening..." : "Add Card via Stripe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}