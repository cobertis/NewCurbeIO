import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  FileText, 
  Download, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign
} from "lucide-react";
import { formatDate } from "@/lib/date-formatter";

interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId?: string;
  plan: {
    id: string;
    name: string;
    description?: string;
    price: number;
    billingCycle: string;
    currency: string;
  };
  stripeDetails?: any;
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
}

export default function Billing() {
  const { toast } = useToast();

  // Fetch subscription data
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['/api/billing/subscription'],
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['/api/billing/invoices'],
  });

  // Fetch payments
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['/api/billing/payments'],
  });

  // Create customer portal session
  const portalMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/portal", {});
      return result.json();
    },
    onSuccess: (data) => {
      // Redirect to Stripe customer portal
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

  const subscription: Subscription | null = (subscriptionData as any)?.subscription || null;
  const invoices: Invoice[] = (invoicesData as any)?.invoices || [];
  const payments: Payment[] = (paymentsData as any)?.payments || [];

  // Calculate current balance from latest unpaid invoice
  const latestUnpaidInvoice = invoices.find(inv => inv.status === 'open' || inv.status === 'draft');
  const currentBalance = latestUnpaidInvoice ? latestUnpaidInvoice.amountDue : 0;
  const isPaid = currentBalance === 0;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Active", variant: "default" },
      trialing: { label: "Trial", variant: "secondary" },
      past_due: { label: "Past Due", variant: "destructive" },
      cancelled: { label: "Cancelled", variant: "outline" },
      unpaid: { label: "Unpaid", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getInvoiceStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
      paid: { label: "Paid", icon: CheckCircle2, className: "text-green-600 dark:text-green-400" },
      open: { label: "Open", icon: AlertCircle, className: "text-orange-600 dark:text-orange-400" },
      draft: { label: "Draft", icon: FileText, className: "text-gray-600 dark:text-gray-400" },
      void: { label: "Void", icon: AlertCircle, className: "text-gray-600 dark:text-gray-400" },
      uncollectible: { label: "Uncollectible", icon: AlertCircle, className: "text-red-600 dark:text-red-400" },
    };

    const config = statusConfig[status] || { label: status, icon: FileText, className: "text-gray-600" };
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${config.className}`} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
      succeeded: { label: "Succeeded", icon: CheckCircle2, className: "text-green-600 dark:text-green-400" },
      pending: { label: "Pending", icon: AlertCircle, className: "text-yellow-600 dark:text-yellow-400" },
      failed: { label: "Failed", icon: AlertCircle, className: "text-red-600 dark:text-red-400" },
      refunded: { label: "Refunded", icon: AlertCircle, className: "text-gray-600 dark:text-gray-400" },
    };

    const config = statusConfig[status] || { label: status, icon: AlertCircle, className: "text-gray-600" };
    const Icon = config.icon;
    
    return (
      <div className="flex items-center gap-1.5">
        <Icon className={`h-4 w-4 ${config.className}`} />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription, payment methods, and billing history
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Status Card - Highlighted */}
        {subscription && (
          <Card className="lg:col-span-3 border-2 border-primary/20 bg-gradient-to-br from-background to-muted/10">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Current Balance */}
                <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <DollarSign className="h-4 w-4" />
                    Current Balance
                  </div>
                  <div className={`text-4xl font-bold ${isPaid ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {formatCurrency(currentBalance, subscription.plan.currency)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {isPaid ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">Paid</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Payment Due</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Next Billing Date */}
                <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    Next Billing Date
                  </div>
                  <div className="text-2xl font-bold">
                    {formatDate(new Date(subscription.currentPeriodEnd))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {formatCurrency(subscription.plan.price, subscription.plan.currency)} will be charged
                  </p>
                </div>

                {/* Current Plan */}
                <div className="flex flex-col items-center justify-center text-center p-4 rounded-lg bg-background/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <CreditCard className="h-4 w-4" />
                    Current Plan
                  </div>
                  <div className="text-2xl font-bold">
                    {subscription.plan.name}
                  </div>
                  <div className="mt-2">
                    {getStatusBadge(subscription.status)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Subscription Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Details
            </CardTitle>
            <CardDescription>Your plan and billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoadingSubscription ? (
              <div className="flex items-center justify-center py-12">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
              </div>
            ) : subscription ? (
              <>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold">{subscription.plan.name}</h3>
                      {getStatusBadge(subscription.status)}
                    </div>
                    {subscription.plan.description && (
                      <p className="text-sm text-muted-foreground">{subscription.plan.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold">
                      {formatCurrency(subscription.plan.price, subscription.plan.currency)}
                    </div>
                    <p className="text-sm text-muted-foreground">per {subscription.plan.billingCycle}</p>
                  </div>
                </div>

                <Separator />

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
                      Billing Cycle
                    </div>
                    <p className="text-sm font-medium capitalize">
                      {subscription.plan.billingCycle}
                    </p>
                  </div>
                </div>

                {subscription.cancelAtPeriodEnd && (
                  <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 p-4 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                          Subscription Cancelling
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                          Your subscription will be cancelled at the end of the current billing period on {formatDate(new Date(subscription.currentPeriodEnd))}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    className="flex-1"
                    data-testid="button-manage-subscription"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {portalMutation.isPending ? "Opening..." : "Manage Subscription"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You don't have an active subscription yet.
                </p>
                <Button variant="outline" onClick={() => window.location.href = "/plans"} data-testid="button-view-plans">
                  View Available Plans
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your billing settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending || !subscription}
              data-testid="button-update-payment"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Update Payment Method
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending || !subscription}
              data-testid="button-view-invoices-quick"
            >
              <FileText className="h-4 w-4 mr-2" />
              View All Invoices
            </Button>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Powered by{" "}
              <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                Stripe
              </a>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>View and download your past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingInvoices ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
            </div>
          ) : invoices.length > 0 ? (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  data-testid={`invoice-${invoice.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">Invoice {invoice.invoiceNumber}</p>
                        {getInvoiceStatusBadge(invoice.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(new Date(invoice.invoiceDate))}
                        {invoice.paidAt && ` • Paid on ${formatDate(new Date(invoice.paidAt))}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Invoices Yet</h3>
              <p className="text-sm text-muted-foreground">
                Your billing history will appear here once you have an active subscription.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payment History
          </CardTitle>
          <CardDescription>Complete history of all payments processed</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
            </div>
          ) : payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  data-testid={`payment-${payment.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">Payment</p>
                        {getPaymentStatusBadge(payment.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(new Date(payment.createdAt))}
                        {payment.processedAt && ` • Processed on ${formatDate(new Date(payment.processedAt))}`}
                        {payment.paymentMethod && ` • ${payment.paymentMethod}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Payments Yet</h3>
              <p className="text-sm text-muted-foreground">
                Your payment history will appear here once payments are processed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
