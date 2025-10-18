import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, FileText, Receipt, MapPin, Calendar, DollarSign, CheckCircle2, XCircle, Clock, AlertCircle, Percent, Tag } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CompanyBillingTabProps {
  companyId: string;
}

export function CompanyBillingTab({ companyId }: CompanyBillingTabProps) {
  // Fetch billing subscription
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ["/api/billing/subscription", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/subscription?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch subscription");
      return res.json();
    },
    enabled: !!companyId,
  });

  // Fetch invoices
  const { data: invoicesData, isLoading: isLoadingInvoices } = useQuery<{ invoices: any[] }>({
    queryKey: ["/api/billing/invoices", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/invoices?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    enabled: !!companyId,
  });

  // Fetch payments
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery<{ payments: any[] }>({
    queryKey: ["/api/billing/payments", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/payments?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!companyId,
  });

  // Fetch payment methods
  const { data: paymentMethodsData, isLoading: isLoadingPaymentMethods } = useQuery<{ paymentMethods: any[] }>({
    queryKey: ["/api/billing/payment-methods", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/payment-methods?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch payment methods");
      return res.json();
    },
    enabled: !!companyId,
  });

  // Fetch billing address
  const { data: billingAddressData, isLoading: isLoadingBillingAddress } = useQuery<{ billingAddress: any }>({
    queryKey: ["/api/billing/address", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/address?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch billing address");
      return res.json();
    },
    enabled: !!companyId,
  });

  // Fetch active discount
  const { data: discountData, isLoading: isLoadingDiscount } = useQuery({
    queryKey: ["/api/billing/active-discount", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/active-discount?companyId=${companyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch discount");
      return res.json();
    },
    enabled: !!companyId,
  });

  const subscription = subscriptionData?.subscription;
  const invoices = invoicesData?.invoices || [];
  const payments = paymentsData?.payments || [];
  const paymentMethods = paymentMethodsData?.paymentMethods || [];
  const billingAddress = billingAddressData?.billingAddress;
  const activeDiscount = discountData?.discount;

  // State for discount dialog
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState("");
  const [discountMonths, setDiscountMonths] = useState("");
  const { toast } = useToast();

  // Mutation for applying discount
  const applyDiscountMutation = useMutation({
    mutationFn: async (data: { percentOff: number; months: number }) => {
      const response = await apiRequest("POST", "/api/billing/apply-temporary-discount", {
        companyId,
        percentOff: data.percentOff,
        months: data.months,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to apply discount");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Discount Applied",
        description: data.message,
      });
      setIsDiscountDialogOpen(false);
      setDiscountPercentage("");
      setDiscountMonths("");
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/billing/active-discount", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription", companyId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for removing discount
  const removeDiscountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/remove-discount", {
        companyId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to remove discount");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Discount Removed",
        description: "The discount has been removed successfully.",
      });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/billing/active-discount", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/subscription", companyId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApplyDiscount = () => {
    const percentage = parseInt(discountPercentage);
    const months = parseInt(discountMonths);

    if (isNaN(percentage) || percentage < 1 || percentage > 100) {
      toast({
        title: "Invalid Percentage",
        description: "Please enter a percentage between 1 and 100",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(months) || months < 1 || months > 36) {
      toast({
        title: "Invalid Duration",
        description: "Please enter duration between 1 and 36 months",
        variant: "destructive",
      });
      return;
    }

    applyDiscountMutation.mutate({ percentOff: percentage, months });
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "paid":
      case "succeeded":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" data-testid={`badge-status-${status}`}><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
      case "trialing":
        return <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" data-testid={`badge-status-${status}`}><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case "canceled":
      case "cancelled":
      case "failed":
        return <Badge variant="destructive" data-testid={`badge-status-${status}`}><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case "past_due":
      case "unpaid":
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400" data-testid={`badge-status-${status}`}><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* Subscription Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Details
            </CardTitle>
            <CardDescription>Current subscription status and plan information</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSubscription ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Plan</p>
                    <p className="text-lg font-semibold" data-testid="text-plan-name">
                      {subscription.plan?.name || "No plan"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <div data-testid="text-subscription-status">
                      {getStatusBadge(subscription.status)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Billing Period</p>
                    <p className="text-sm font-medium capitalize" data-testid="text-billing-period">
                      {subscription.billingPeriod || "Monthly"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Amount</p>
                    <p className="text-lg font-semibold" data-testid="text-subscription-amount">
                      {subscription.plan ? formatCurrency(subscription.plan.price, subscription.plan.currency) : "-"}
                    </p>
                  </div>
                  {subscription.currentPeriodEnd && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Next Billing Date</p>
                      <p className="text-sm font-medium" data-testid="text-next-billing">
                        {format(new Date(subscription.currentPeriodEnd), "MMM dd, yyyy")}
                      </p>
                    </div>
                  )}
                  {subscription.cancelAtPeriodEnd && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Cancellation</p>
                      <Badge variant="destructive" data-testid="badge-cancel-period-end">
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancels at period end
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Active Discount Section */}
                {activeDiscount && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="font-semibold text-green-900 dark:text-green-100">
                            {activeDiscount.percentOff}% discount applied
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {activeDiscount.durationInMonths ? (
                              <>
                                Active for {activeDiscount.durationInMonths} month{activeDiscount.durationInMonths > 1 ? 's' : ''}
                                {activeDiscount.end && (
                                  <> • Expires {format(new Date(activeDiscount.end), "MMM dd, yyyy")}</>
                                )}
                              </>
                            ) : (
                              activeDiscount.duration === 'forever' ? 'Permanent discount' : 
                              activeDiscount.duration === 'once' ? 'One-time discount' : 
                              'Active discount'
                            )}
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeDiscountMutation.mutate()}
                        disabled={removeDiscountMutation.isPending}
                        data-testid="button-remove-discount"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Discount Management for Superadmin */}
                <div className="mt-4 flex gap-2">
                  <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline"
                        size="sm"
                        data-testid="button-manage-discount"
                        disabled={!!activeDiscount}
                      >
                        <Percent className="h-4 w-4 mr-2" />
                        {activeDiscount ? 'Discount Active' : 'Apply Discount'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Apply Temporary Discount</DialogTitle>
                        <DialogDescription>
                          Apply a percentage discount for a specific number of months to this company's subscription.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="discount-percentage">Discount Percentage (%)</Label>
                          <Input
                            id="discount-percentage"
                            type="number"
                            min="1"
                            max="100"
                            placeholder="e.g., 20"
                            value={discountPercentage}
                            onChange={(e) => setDiscountPercentage(e.target.value)}
                            data-testid="input-discount-percentage"
                          />
                        </div>
                        <div>
                          <Label htmlFor="discount-months">Duration (months)</Label>
                          <Input
                            id="discount-months"
                            type="number"
                            min="1"
                            max="36"
                            placeholder="e.g., 3"
                            value={discountMonths}
                            onChange={(e) => setDiscountMonths(e.target.value)}
                            data-testid="input-discount-months"
                          />
                        </div>
                        {discountPercentage && discountMonths && (
                          <Alert>
                            <AlertDescription>
                              This will apply a {discountPercentage}% discount for {discountMonths} month{discountMonths === "1" ? "" : "s"} to the customer's subscription.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsDiscountDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleApplyDiscount}
                          disabled={applyDiscountMutation.isPending || !discountPercentage || !discountMonths}
                          data-testid="button-apply-discount"
                        >
                          {applyDiscountMutation.isPending ? 'Applying...' : 'Apply Discount'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No subscription found for this company
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Billing Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingBillingAddress ? (
              <Skeleton className="h-32 w-full" />
            ) : billingAddress ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold" data-testid="text-billing-fullname">{billingAddress.fullName}</p>
                <p data-testid="text-billing-address1">{billingAddress.addressLine1}</p>
                {billingAddress.addressLine2 && (
                  <p data-testid="text-billing-address2">{billingAddress.addressLine2}</p>
                )}
                <p data-testid="text-billing-city-state-zip">
                  {billingAddress.city}, {billingAddress.state} {billingAddress.postalCode}
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No billing address on file
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>Saved payment methods for this company</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPaymentMethods ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : paymentMethods.length > 0 ? (
            <div className="space-y-3">
              {paymentMethods.map((pm: any) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`card-payment-method-${pm.id}`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium capitalize">
                        {pm.brand} •••• {pm.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}
                      </p>
                    </div>
                  </div>
                  {pm.isDefault && (
                    <Badge variant="default" data-testid={`badge-default-${pm.id}`}>Default</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No payment methods on file
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices & Payments in two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoices
            </CardTitle>
            <CardDescription>Recent invoices for this company</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInvoices ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : invoices.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {invoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`card-invoice-${invoice.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          Invoice #{invoice.invoiceNumber}
                        </p>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {format(new Date(invoice.createdAt), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold ml-3" data-testid={`text-invoice-amount-${invoice.id}`}>
                      {formatCurrency(invoice.amountDue, invoice.currency)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No invoices found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Payments
            </CardTitle>
            <CardDescription>Payment history for this company</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : payments.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {payments.map((payment: any) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                    data-testid={`card-payment-${payment.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {payment.description || "Payment"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {format(new Date(payment.createdAt), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3">
                      <p className="text-sm font-semibold" data-testid={`text-payment-amount-${payment.id}`}>
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      {getStatusBadge(payment.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No payments found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
