import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getCompanyQueryOptions } from "@/lib/queryClient";
import { useLocation } from "wouter";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useTabsState } from "@/hooks/use-tabs-state";
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
  MapPin,
  Plus,
  Phone,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle
} from "lucide-react";
import { formatDate } from "@/lib/date-formatter";
import type { BulkvsPhoneNumber } from "@shared/schema";
import { formatForDisplay } from "@shared/phone";
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

// Reactivate Phone Button Component
function ReactivatePhoneButton({ phoneNumber }: { phoneNumber: BulkvsPhoneNumberWithDisplay }) {
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/bulkvs/numbers/${phoneNumber.id}/reactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "Number reactivated",
        description: "Your phone number has been reactivated successfully. Billing will resume immediately.",
      });
      setShowConfirm(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Reactivation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowConfirm(true)}
        data-testid={`button-reactivate-${phoneNumber.id}`}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Reactivate
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Phone Number?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reactivate your phone number <strong>{phoneNumber.didDisplay || formatForDisplay(phoneNumber.did)}</strong> and create a new subscription at ${phoneNumber.monthlyPrice}/month. Billing will start immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              data-testid="button-confirm-reactivate"
            >
              {reactivateMutation.isPending ? "Reactivating..." : "Reactivate Number"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Extended type for API responses that include display fields
interface BulkvsPhoneNumberWithDisplay extends BulkvsPhoneNumber {
  didDisplay?: string;
  callForwardNumberDisplay?: string;
}

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
  annualPrice?: number;
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
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useTabsState(["subscriptions", "payments", "transactions"], "subscriptions");
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
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [modifyDialogView, setModifyDialogView] = useState<'main' | 'financial-ineligible' | 'financial-support' | 'downgrade' | 'upgrade' | 'upgrade-timing' | 'cancel'>('main');
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<typeof plans[0] | null>(null);
  const [downgradeReason, setDowngradeReason] = useState("");
  const [downgradeConfirm1, setDowngradeConfirm1] = useState(false);
  const [downgradeConfirm2, setDowngradeConfirm2] = useState(false);
  const [cancelReason, setCancelReason] = useState("missing_features");
  const [financialSituation, setFinancialSituation] = useState("");
  const [proposedSolution, setProposedSolution] = useState("");

  // Fetch session data to get user info
  const { data: sessionData } = useQuery<{ user?: any }>({
    queryKey: ['/api/session'],
  });

  const user = sessionData?.user;

  // Fetch company data
  const { data: companyData } = useQuery<{ company?: any }>({
    ...getCompanyQueryOptions(user?.companyId),
  });

  const company = companyData?.company;

  // Fetch subscription data with enhanced trial info
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery<{ subscription?: any }>({
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
  const { data: billingAddressData } = useQuery<{ billingAddress?: any }>({
    queryKey: ['/api/billing/address'],
  });

  const billingAddress = billingAddressData?.billingAddress;

  // Fetch active discount
  const { data: discountData } = useQuery<{ discount?: any }>({
    queryKey: ['/api/billing/active-discount'],
    enabled: !!subscriptionData?.subscription,
  });

  const { data: bulkvsPhoneNumbers, isLoading: isLoadingBulkvsNumbers } = useQuery<BulkvsPhoneNumberWithDisplay[]>({
    queryKey: ["/api/bulkvs/numbers"],
  });

  // Fetch wallet transactions
  const { data: walletTransactionsData, isLoading: isLoadingWalletTransactions } = useQuery<{
    transactions: Array<{
      id: string;
      amount: string;
      type: string;
      description: string | null;
      externalReferenceId: string | null;
      balanceAfter: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/wallet/transactions"],
  });

  const walletTransactions = walletTransactionsData?.transactions || [];

  const activeDiscount = discountData?.discount;

  // Track last shown payment failure notification to avoid duplicates
  const lastPaymentFailureRef = useRef<string | null>(null);

  // WebSocket listener for payment failures
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'notification_update') {
      // Refetch notifications to get the latest
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
      // Also refetch subscription to update status
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
      
      // Check for payment failure notification
      queryClient.fetchQuery({ queryKey: ['/api/notifications'] }).then((data: any) => {
        if (data?.notifications) {
          // Find the most recent payment_failed notification
          const paymentFailedNotif = data.notifications.find(
            (n: any) => n.type === 'payment_failed' && n.id !== lastPaymentFailureRef.current
          );
          
          if (paymentFailedNotif) {
            lastPaymentFailureRef.current = paymentFailedNotif.id;
            toast({
              title: "Payment Failed",
              description: "Your payment was declined. Please update your payment method.",
              variant: "destructive",
            });
          }
        }
      });
    } else if (message.type === 'subscription_update') {
      // Refresh subscription data when updated
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
    }
  }, [toast]);

  useWebSocket(handleWebSocketMessage);

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
      return result;
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


  // Create customer portal session
  const portalMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/portal", {});
      return result;
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
      return result;
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
        title: "Payment Failed",
        description: error.message || "Failed to skip trial",
        variant: "destructive",
      });
      
      // Close skip trial dialog and open add card dialog
      setShowSkipTrialDialog(false);
      setShowAddCard(true);
      setPendingSkipTrial(true);
    },
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async ({ planId, billingPeriod, immediate }: { planId: string; billingPeriod: string; immediate?: boolean }) => {
      const result = await apiRequest("POST", "/api/billing/change-plan", {
        planId,
        billingPeriod,
        immediate: immediate ?? false // Default to false if not provided
      });
      return result;
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
      const result = await apiRequest("POST", "/api/billing/cancel", {});
      return result;
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

  // Reactivate subscription mutation
  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/billing/reactivate", {});
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Subscription Reactivated",
        description: "Your subscription will continue as normal",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/subscription'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate subscription",
        variant: "destructive",
      });
    },
  });

  // Apply coupon mutation
  const applyCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const result = await apiRequest("POST", "/api/billing/apply-coupon", { code });
      return result;
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

  // Financial support ticket mutation
  const financialSupportMutation = useMutation({
    mutationFn: async (data: { situation: string; proposedSolution: string }) => {
      const result = await apiRequest("POST", "/api/billing/financial-support", data);
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Request Submitted",
        description: data.message,
      });
      setShowModifyDialog(false); // Close the main dialog
      setFinancialSituation("");
      setProposedSolution("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Could not submit request",
        variant: "destructive",
      });
    },
  });

  // Set default payment method mutation
  // Track which specific payment method is being mutated
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [pendingSetDefaultId, setPendingSetDefaultId] = useState<string | null>(null);

  const setDefaultPaymentMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      setPendingSetDefaultId(paymentMethodId);
      const result = await apiRequest("POST", "/api/billing/set-default-payment-method", {
        paymentMethodId,
      });
      return result;
    },
    onSuccess: () => {
      setPendingSetDefaultId(null);
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payment-methods'] });
    },
    onError: (error: Error) => {
      setPendingSetDefaultId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to set default payment method",
        variant: "destructive",
      });
    },
  });

  // Remove payment method mutation
  const removePaymentMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      setPendingRemoveId(paymentMethodId);
      const result = await apiRequest("DELETE", `/api/billing/payment-method/${paymentMethodId}`, {});
      return result;
    },
    onSuccess: () => {
      setPendingRemoveId(null);
      toast({
        title: "Success",
        description: "Payment method removed",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/payment-methods'] });
    },
    onError: (error: Error) => {
      setPendingRemoveId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to remove payment method",
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

  // Get all higher plans for upgrade
  const getAllHigherPlans = () => {
    if (!subscription || !plans.length) return [];
    
    // Sort plans by monthly price (ascending)
    const sortedPlans = [...plans]
      .filter(p => p.isActive)
      .sort((a, b) => a.price - b.price);
    
    // Find current plan index
    const currentIndex = sortedPlans.findIndex(p => p.id === subscription.planId);
    if (currentIndex === -1) return [];
    
    // Return all plans higher than current
    return sortedPlans.slice(currentIndex + 1);
  };

  // Get next higher plan for upgrade (step-by-step upgrade)
  const getNextHigherPlan = () => {
    const higherPlans = getAllHigherPlans();
    return higherPlans.length > 0 ? higherPlans[0] : null;
  };

  // Get next lower plan for downgrade (step-by-step downgrade)
  const getNextLowerPlan = () => {
    if (!subscription || !plans.length) return null;
    
    // Sort plans by monthly price (ascending)
    const sortedPlans = [...plans]
      .filter(p => p.isActive)
      .sort((a, b) => a.price - b.price);
    
    // Find current plan index
    const currentIndex = sortedPlans.findIndex(p => p.id === subscription.planId);
    if (currentIndex === -1) return null;
    
    // Return next lower plan if current plan is not already the lowest
    if (currentIndex > 0) {
      return sortedPlans[currentIndex - 1];
    }
    
    return null; // Cannot downgrade if already at lowest plan
  };

  const nextHigherPlan = getNextHigherPlan();
  const nextLowerPlan = getNextLowerPlan();

  // Calculate total spending
  const totalSpending = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  // Format currency (amount is in cents from Stripe)
  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount / 100);
  };

  // Format currency without cents
  const formatCurrencyWhole = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  // Sync phone numbers mutation
  const syncPhonesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/billing/sync-phone-numbers');
    },
    onSuccess: (data: any) => {
      toast({
        title: "Phone Numbers Synced",
        description: `Updated: ${data.results.updated}, Skipped: ${data.results.skipped}, Errors: ${data.results.errors.length}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync phone numbers",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Superadmin Tools */}
      {user?.role === 'superadmin' && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <Shield className="h-5 w-5" />
              Superadmin Tools
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              Administrative utilities for managing billing system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => syncPhonesMutation.mutate()}
                disabled={syncPhonesMutation.isPending}
                variant="outline"
                className="border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900/50"
                data-testid="button-sync-phones"
              >
                <Phone className="h-4 w-4 mr-2" />
                {syncPhonesMutation.isPending ? "Syncing..." : "Sync Phone Numbers to Stripe"}
              </Button>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Updates all Stripe customer records with company phone numbers for invoices
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Billing Info</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-6">
          <div className="grid galg:grid-cols-2">
            {/* Subscription Details */}
            {isLoadingSubscription ? (
              <Card>
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
              <Card>
            <CardContent className="space-y-4 pt-6">
              {/* Header with Plan Name and Price */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">{subscription.plan.name}</h2>
                  {activeDiscount && activeDiscount.percentOff && (
                    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md">
                      <Gift className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        {activeDiscount.percentOff}% OFF for {activeDiscount.durationInMonths || 0} months
                      </span>
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {activeDiscount && activeDiscount.percentOff ? (
                    <>
                      <div className="text-xl font-medium text-muted-foreground line-through">
                        {(() => {
                          const displayPrice = subscription.billingCycle === 'yearly' 
                            ? subscription.plan.annualPrice || subscription.plan.price 
                            : subscription.plan.price;
                          
                          return formatCurrencyWhole(displayPrice, subscription.plan.currency);
                        })()}
                      </div>
                      <div className="text-5xl font-bold text-green-600 dark:text-green-400">
                        {(() => {
                          const originalPrice = subscription.billingCycle === 'yearly' 
                            ? subscription.plan.annualPrice || subscription.plan.price 
                            : subscription.plan.price;
                          const discountedPrice = originalPrice * (1 - activeDiscount.percentOff / 100);
                          
                          return formatCurrencyWhole(discountedPrice, subscription.plan.currency);
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="text-5xl font-bold">
                      {(() => {
                        const displayPrice = subscription.billingCycle === 'yearly' 
                          ? subscription.plan.annualPrice || subscription.plan.price 
                          : subscription.plan.price;
                        
                        return formatCurrencyWhole(displayPrice, subscription.plan.currency);
                      })()}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    {subscription.billingCycle === 'yearly' ? 'per year' : 'per month'}
                  </p>
                </div>
              </div>

              {/* Status Banner */}
              {subscription.status === 'trialing' && trialDaysRemaining > 0 ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100">
                        Free Trial Active - {trialDaysRemaining} {trialDaysRemaining === 1 ? 'Day' : 'Days'} Remaining
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Your trial ends on {subscription.trialEnd ? formatDate(new Date(subscription.trialEnd)) : 'N/A'}. No payment required until then.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-center">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{Math.round(trialProgress)}% Complete</p>
                      </div>
                      <Progress value={trialProgress} className="h-2 w-32" />
                    </div>
                    <Button
                      onClick={() => {
                        // Check if user has payment method
                        if (!paymentMethods || paymentMethods.length === 0) {
                          setPendingSkipTrial(true);
                          setShowAddCard(true);
                        } else {
                          setShowSkipTrialDialog(true);
                        }
                      }}
                      data-testid="button-skip-trial"
                      className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 font-semibold shadow-sm"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Skip Trial
                    </Button>
                  </div>
                </div>
              ) : subscription.status === 'active' && !subscription.cancelAtPeriodEnd ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        Plan Active
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Your subscription is active and in good standing. Next billing on {formatDate(new Date(subscription.currentPeriodEnd))}.
                      </p>
                    </div>
                  </div>
                </div>
              ) : subscription.status === 'past_due' ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                      <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-orange-900 dark:text-orange-100">
                        Payment Required
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Your payment is past due. Please update your payment method to continue service.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowAddCard(true)}
                    className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 font-semibold shadow-sm"
                  >
                    Update Payment
                  </Button>
                </div>
              ) : subscription.status === 'cancelled' || subscription.cancelAtPeriodEnd ? (
                <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100">
                        {subscription.status === 'cancelled' ? 'Subscription Cancelled' : 'Cancellation Scheduled'}
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {subscription.cancelAtPeriodEnd 
                          ? `Your subscription will end on ${formatDate(new Date(subscription.currentPeriodEnd))}.`
                          : 'Your subscription has been cancelled.'}
                      </p>
                    </div>
                  </div>
                  {subscription.cancelAtPeriodEnd && (
                    <Button
                      onClick={() => reactivateSubscriptionMutation.mutate()}
                      disabled={reactivateSubscriptionMutation.isPending}
                      className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 font-semibold shadow-sm"
                      data-testid="button-reactivate-subscription"
                    >
                      {reactivateSubscriptionMutation.isPending ? 'Processing...' : "Don't Cancel Subscription"}
                    </Button>
                  )}
                </div>
              ) : null}

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowModifyDialog(true)}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 text-left"
                  data-testid="button-modify-subscription"
                >
                  <span className="font-medium">Want to modify / cancel your subscription?</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Have a Billing Question?</p>
                    <a 
                      href="tel:+18449995077" 
                      className="text-sm text-primary hover:underline"
                      data-testid="link-billing-phone"
                    >
                      Contact us at +1 (844) 999-5077
                    </a>
                  </div>
                </div>
              </div>

              {/* Next Invoice - Only show when NOT active (active status already shows this in banner) */}
              {subscription.status !== 'active' && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    Your next invoice is scheduled on{' '}
                    <span className="font-medium text-foreground">
                      {formatDate(new Date(subscription.currentPeriodEnd))}
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
              </Card>
            ) : null}

          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <CardDescription>Complete history of all your invoices and wallet top-ups</CardDescription>
            </CardHeader>
            <CardContent>
              {(isLoadingInvoices || isLoadingWalletTransactions) ? (
                <div className="flex items-center justify-center py-12">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent"></div>
                </div>
              ) : (() => {
                // Combine invoices and wallet transactions into unified list
                const unifiedTransactions: Array<{
                  id: string;
                  type: 'invoice' | 'wallet';
                  description: string;
                  date: Date;
                  amount: number;
                  currency: string;
                  status: string;
                  receiptUrl?: string | null;
                  pdfUrl?: string | null;
                }> = [];

                // Add invoices
                invoices
                  .filter(inv => inv.status !== 'void' && inv.total !== 0)
                  .forEach(inv => {
                    unifiedTransactions.push({
                      id: `inv-${inv.id}`,
                      type: 'invoice',
                      description: inv.invoiceNumber || 'Subscription Invoice',
                      date: new Date(inv.invoiceDate),
                      amount: inv.total,
                      currency: inv.currency,
                      status: inv.status,
                      receiptUrl: inv.stripeHostedInvoiceUrl,
                      pdfUrl: inv.stripeInvoicePdf,
                    });
                  });

                // Add wallet deposits (type can be 'deposit' or 'DEPOSIT')
                // Note: Wallet amounts are in dollars, but formatCurrency expects cents, so multiply by 100
                walletTransactions
                  .filter(tx => tx.type.toLowerCase() === 'deposit')
                  .forEach(tx => {
                    unifiedTransactions.push({
                      id: `wallet-${tx.id}`,
                      type: 'wallet',
                      description: tx.description || 'Wallet Top-up',
                      date: new Date(tx.createdAt),
                      amount: parseFloat(tx.amount) * 100,
                      currency: 'usd',
                      status: 'paid',
                      receiptUrl: (tx as any).receiptUrl || null,
                      pdfUrl: null,
                    });
                  });

                // Sort by date descending
                unifiedTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

                return unifiedTransactions.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unifiedTransactions.map((tx) => (
                          <TableRow key={tx.id} data-testid={`tx-row-${tx.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {tx.type === 'invoice' ? (
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Wallet className="h-4 w-4 text-green-500" />
                                )}
                                <span className="capitalize">{tx.type === 'invoice' ? 'Subscription' : 'Wallet Top-up'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {tx.description}
                            </TableCell>
                            <TableCell>{formatDate(tx.date)}</TableCell>
                            <TableCell>
                              <Badge variant={tx.status === 'paid' ? 'default' : tx.status === 'open' ? 'secondary' : 'outline'}>
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(tx.amount, tx.currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {tx.receiptUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(tx.receiptUrl!, '_blank')}
                                    data-testid={`button-view-receipt-${tx.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                {tx.pdfUrl && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(tx.pdfUrl!, '_blank')}
                                    data-testid={`button-download-pdf-${tx.id}`}
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
                    <h3 className="text-lg font-semibold mb-2">No Transactions Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Invoices and wallet top-ups will appear here.
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

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

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => {
        setShowCancelDialog(open);
        if (!open) {
          setCancelReason("missing_features"); // Reset to default
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              Cancelling Your HighLevel Account?
            </DialogTitle>
            <DialogDescription>
              Why do you want to cancel?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="missing_features" id="missing_features" />
                  <Label htmlFor="missing_features" className="cursor-pointer font-normal">
                    Missing features
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="trouble_setting_up" id="trouble_setting_up" />
                  <Label htmlFor="trouble_setting_up" className="cursor-pointer font-normal">
                    Having trouble setting up
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="too_expensive" id="too_expensive" />
                  <Label htmlFor="too_expensive" className="cursor-pointer font-normal">
                    Too expensive
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="not_using_enough" id="not_using_enough" />
                  <Label htmlFor="not_using_enough" className="cursor-pointer font-normal">
                    Not using enough
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="technical_issues" id="technical_issues" />
                  <Label htmlFor="technical_issues" className="cursor-pointer font-normal">
                    Technical issues
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="unsatisfactory_experience" id="unsatisfactory_experience" />
                  <Label htmlFor="unsatisfactory_experience" className="cursor-pointer font-normal">
                    Unsatisfactory customer experience
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="out_of_business" id="out_of_business" />
                  <Label htmlFor="out_of_business" className="cursor-pointer font-normal">
                    Went out of business
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="different_account" id="different_account" />
                  <Label htmlFor="different_account" className="cursor-pointer font-normal">
                    Signing up for a different account
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="different_product" id="different_product" />
                  <Label htmlFor="different_product" className="cursor-pointer font-normal">
                    Switching to a different product
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
              data-testid="button-cancel-back"
            >
              Back
            </Button>
            <Button
              onClick={() => {
                cancelSubscriptionMutation.mutate();
                setShowCancelDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-cancel"
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Subscription Dialog */}
      <Dialog open={showModifyDialog} onOpenChange={(open) => {
        setShowModifyDialog(open);
        if (!open) {
          // Reset all states when dialog closes
          setModifyDialogView('main');
          setFinancialSituation("");
          setProposedSolution("");
          setDowngradeReason("");
          setDowngradeConfirm1(false);
          setDowngradeConfirm2(false);
          setCancelReason("missing_features");
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          {/* Main View - Options List */}
          {modifyDialogView === 'main' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  Modify subscription for {company?.name || 'Curbe.io'}
                </DialogTitle>
                <DialogDescription>
                  Hold up! Did you know about the options below?
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-3 py-4">
                {/* Upgrade Plan Option - Only show if there's a higher plan available */}
                {nextHigherPlan && (
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold">Upgrade to {nextHigherPlan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(
                            subscription?.billingCycle === 'yearly' 
                              ? nextHigherPlan.annualPrice || nextHigherPlan.price 
                              : nextHigherPlan.price,
                            nextHigherPlan.currency
                          )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setModifyDialogView('upgrade')}
                      data-testid="button-upgrade-plan"
                    >
                      Upgrade
                    </Button>
                  </div>
                )}

                {/* Financial Support Option */}
                <button
                  onClick={() => {
                    // Check if user already has an active discount
                    if (activeDiscount) {
                      setModifyDialogView('financial-ineligible');
                    } else {
                      setModifyDialogView('financial-support');
                    }
                  }}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-financial-support"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">Request Financial Support</p>
                      <p className="text-sm text-muted-foreground">
                        I need financial support due to unforeseen circumstances
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                {/* Downgrade Plan Option - Only show if there's a lower plan available (not the lowest) */}
                {nextLowerPlan && (
                  <button
                    onClick={() => setModifyDialogView('downgrade')}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                    data-testid="button-downgrade-plan"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                        <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400 rotate-180" />
                      </div>
                      <div>
                        <p className="font-semibold">Downgrade to {nextLowerPlan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(
                            subscription?.billingCycle === 'yearly' 
                              ? nextLowerPlan.annualPrice || nextLowerPlan.price 
                              : nextLowerPlan.price,
                            nextLowerPlan.currency
                          )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}

                {/* Cancel Plan Option */}
                <button
                  onClick={() => setModifyDialogView('cancel')}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-cancel-plan"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold">Cancel Plan</p>
                      <p className="text-sm text-muted-foreground">
                        I still want to cancel my subscription
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </>
          )}

          {/* Financial Ineligible View */}
          {modifyDialogView === 'financial-ineligible' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  You are ineligible for Financial Assistance at this point.
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-4">
                <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-orange-900 dark:text-orange-100 mb-1">Reason:</p>
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        Currently, you are not eligible for financial assistance support because you already have a discount applied to the upcoming invoice
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-ineligible-back"
                >
                  Back
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Financial Support Request View */}
          {modifyDialogView === 'financial-support' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Financial Support Request
                </DialogTitle>
                <DialogDescription>
                  We're here to help. Your success is our commitment. Share your situation and our team will review it within 48 hours.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Info Message */}
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Response Commitment</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Once your request is submitted, our team will review it and respond to you within 48 hours. 
                        We want to understand your situation and find the best solution together.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Situation Field */}
                <div className="space-y-2">
                  <Label htmlFor="situation" className="text-base font-semibold">
                    What is your current situation?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Briefly explain the circumstances affecting your payment ability.
                  </p>
                  <Textarea
                    id="situation"
                    value={financialSituation}
                    onChange={(e) => setFinancialSituation(e.target.value)}
                    placeholder="e.g., We are experiencing a temporary decline in sales due to..."
                    className="min-h-[120px] resize-none"
                    data-testid="input-situation"
                  />
                </div>

                {/* Proposed Solution Field */}
                <div className="space-y-2">
                  <Label htmlFor="proposed-solution" className="text-base font-semibold">
                    What solution do you propose?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    How could we work together to resolve this situation?
                  </p>
                  <Textarea
                    id="proposed-solution"
                    value={proposedSolution}
                    onChange={(e) => setProposedSolution(e.target.value)}
                    placeholder="e.g., I would need a temporary 30% discount for the next 3 months while..."
                    className="min-h-[120px] resize-none"
                    data-testid="input-proposed-solution"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-support-back"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (!financialSituation.trim() || !proposedSolution.trim()) {
                      toast({
                        title: "Required Fields",
                        description: "Please complete both fields before submitting",
                        variant: "destructive",
                      });
                      return;
                    }
                    financialSupportMutation.mutate({
                      situation: financialSituation,
                      proposedSolution: proposedSolution,
                    });
                  }}
                  disabled={financialSupportMutation.isPending}
                  data-testid="button-support-submit"
                >
                  {financialSupportMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Upgrade View - Select Plan */}
          {modifyDialogView === 'upgrade' && (() => {
            const higherPlans = getAllHigherPlans();
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    Select Upgrade Plan
                  </DialogTitle>
                  <DialogDescription>
                    Choose which plan you'd like to upgrade to
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 py-4">
                  {higherPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setSelectedUpgradePlan(plan);
                        setModifyDialogView('upgrade-timing');
                      }}
                      className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                      data-testid={`button-select-plan-${plan.name.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(
                              subscription?.billingCycle === 'yearly' 
                                ? plan.annualPrice || plan.price 
                                : plan.price,
                              plan.currency
                            )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setModifyDialogView('main')}
                    data-testid="button-upgrade-back"
                  >
                    Back
                  </Button>
                </DialogFooter>
              </>
            );
          })()}

          {/* Upgrade View - Select Timing */}
          {modifyDialogView === 'upgrade-timing' && selectedUpgradePlan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  Upgrade to {selectedUpgradePlan.name}
                </DialogTitle>
                <DialogDescription>
                  Choose when you'd like your upgrade to take effect
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Immediate Upgrade Option */}
                <button
                  onClick={() => {
                    if (subscription && subscription.billingCycle) {
                      changePlanMutation.mutate({
                        planId: selectedUpgradePlan.id,
                        billingPeriod: subscription.billingCycle,
                        immediate: true
                      });
                      setShowModifyDialog(false);
                    }
                  }}
                  className="flex flex-col p-4 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-upgrade-immediate"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-green-900 dark:text-green-100">Upgrade Immediately</span>
                    </div>
                    <Badge variant="default" className="bg-green-600">Recommended</Badge>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                    Get instant access to all premium features. We'll calculate a credit for your unused time on the current plan and apply it to your first payment.
                  </p>
                  <div className="p-3 rounded-md bg-white/50 dark:bg-black/20 border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">How it works:</p>
                    <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                      <li>• Credit for unused time on current plan</li>
                      <li>• Charge for new plan (prorated for remaining period)</li>
                      <li>• Pay only the difference today</li>
                      <li>• Start using premium features immediately</li>
                    </ul>
                  </div>
                </button>

                {/* Scheduled Upgrade Option */}
                <button
                  onClick={() => {
                    if (subscription && subscription.billingCycle) {
                      changePlanMutation.mutate({
                        planId: selectedUpgradePlan.id,
                        billingPeriod: subscription.billingCycle,
                        immediate: false
                      });
                      setShowModifyDialog(false);
                    }
                  }}
                  className="flex flex-col p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-upgrade-scheduled"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Upgrade at Next Renewal</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Schedule your upgrade for{' '}
                    <span className="font-semibold">
                      {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your next renewal date'}
                    </span>.
                    Continue using your current plan until then.
                  </p>
                </button>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('upgrade')}
                  data-testid="button-upgrade-timing-back"
                >
                  Back
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Downgrade View */}
          {modifyDialogView === 'downgrade' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400 rotate-180" />
                  </div>
                  Downgrade your plan
                </DialogTitle>
                <DialogDescription>
                  If you wish to move to a lower plan, you can downgrade your subscription to{' '}
                  {nextLowerPlan && (
                    <>
                      {nextLowerPlan.name} - {formatCurrency(
                        subscription?.billingCycle === 'yearly' 
                          ? nextLowerPlan.annualPrice || nextLowerPlan.price 
                          : nextLowerPlan.price,
                        nextLowerPlan.currency
                      )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Proration Information */}
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">How downgrade works</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Your downgrade will take effect at the end of your current billing period on{' '}
                        <span className="font-semibold">
                          {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your next renewal date'}
                        </span>. 
                        You'll continue to enjoy all features of your current plan until then, and the new lower-priced plan will begin on your next renewal. 
                        You won't lose any time you've already paid for.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason Textarea */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tell us why you want to downgrade? <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    placeholder="Please tell us why would you like to downgrade your subscription? This will help us in making our platform better in future."
                    value={downgradeReason}
                    onChange={(e) => setDowngradeReason(e.target.value)}
                    className="min-h-[100px] resize-none"
                    data-testid="textarea-downgrade-reason"
                  />
                </div>

                {/* Confirmation Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirm1"
                      checked={downgradeConfirm1}
                      onCheckedChange={(checked) => setDowngradeConfirm1(checked as boolean)}
                      data-testid="checkbox-confirm-1"
                    />
                    <label
                      htmlFor="confirm1"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      I understand that the{' '}
                      {nextLowerPlan && (
                        <>
                          {nextLowerPlan.name} plan ({formatCurrency(
                            subscription?.billingCycle === 'yearly' 
                              ? nextLowerPlan.annualPrice || nextLowerPlan.price 
                              : nextLowerPlan.price,
                            nextLowerPlan.currency
                          )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'})
                        </>
                      )}
                      {' '}has fewer features than my current plan
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirm2"
                      checked={downgradeConfirm2}
                      onCheckedChange={(checked) => setDowngradeConfirm2(checked as boolean)}
                      data-testid="checkbox-confirm-2"
                    />
                    <label
                      htmlFor="confirm2"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      I confirm that I understand the limitations of the lower plan and accept any feature restrictions that may apply
                    </label>
                  </div>
                </div>

                {/* Discount Warning */}
                {activeDiscount && (
                  <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                          Your discount coupon will be removed.
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                          A {activeDiscount.percentOff}% off for {activeDiscount.durationInMonths || 3} months coupon is applied to your subscription, which will be lost if you proceed to downgrade.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-downgrade-back"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (nextLowerPlan && subscription && subscription.billingCycle) {
                      changePlanMutation.mutate({
                        planId: nextLowerPlan.id,
                        billingPeriod: subscription.billingCycle
                      });
                      setShowModifyDialog(false);
                    }
                  }}
                  disabled={!downgradeReason || !downgradeConfirm1 || !downgradeConfirm2 || !nextLowerPlan || changePlanMutation.isPending}
                  data-testid="button-confirm-downgrade"
                >
                  {changePlanMutation.isPending ? 'Changing...' : `Downgrade to ${nextLowerPlan?.name || 'Lower Plan'}`}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Cancel View */}
          {modifyDialogView === 'cancel' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Are you sure you want to cancel?
                </DialogTitle>
                <DialogDescription>
                  We're sorry to see you go. Please let us know why you're cancelling.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Critical Warning about Account Deactivation */}
                <div className="p-4 rounded-lg border-2 border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900 dark:text-red-100 mb-2 text-base">
                        Important: Account Access Will End
                      </p>
                      <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                        <p>
                          After your subscription ends on{' '}
                          <span className="font-bold">
                            {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your end date'}
                          </span>, the following will happen automatically:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Your account will be deactivated</strong></li>
                          <li><strong>All users in your company will lose access</strong></li>
                          <li><strong>You will not be able to log in</strong></li>
                          <li><strong>All features and functions will be disabled</strong></li>
                        </ul>
                        <p className="font-semibold mt-3">
                          You can continue using all features until {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your end date'}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cancellation Reason */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">
                    Why are you cancelling? <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="missing_features" id="missing_features" />
                      <Label htmlFor="missing_features" className="cursor-pointer flex-1">
                        Missing features I need
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="too_expensive" id="too_expensive" />
                      <Label htmlFor="too_expensive" className="cursor-pointer flex-1">
                        Too expensive
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="switching_service" id="switching_service" />
                      <Label htmlFor="switching_service" className="cursor-pointer flex-1">
                        Switching to another service
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="not_using" id="not_using" />
                      <Label htmlFor="not_using" className="cursor-pointer flex-1">
                        Not using it enough
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="cursor-pointer flex-1">
                        Other
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-cancel-back"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    cancelSubscriptionMutation.mutate();
                    setShowModifyDialog(false);
                  }}
                  disabled={!cancelReason}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="button-confirm-cancel"
                >
                  I Understand, Cancel Subscription
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          <div className="grid galg:grid-cols-2">
            <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage your payment methods and billing information</CardDescription>
              </div>
              <Button 
                onClick={() => setShowAddCard(true)}
                size="sm"
                data-testid="button-add-payment-method"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Card
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Methods List */}
              {paymentMethods && paymentMethods.length > 0 ? (
                <div className="space-y-4">
                  {paymentMethods.map((method) => {
                    if (!method.brand) return null;
                    return (
                      <div 
                        key={method.id} 
                        className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                        data-testid={`payment-method-${method.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <CardBrandLogo brand={method.brand} />
                          <div>
                            <p className="font-medium">
                              {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {method.isDefault ? (
                            <Badge variant="secondary" data-testid="badge-default">
                              Default
                            </Badge>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setDefaultPaymentMutation.mutate(method.id)}
                              disabled={pendingSetDefaultId === method.id}
                              data-testid={`button-set-default-${method.id}`}
                            >
                              {pendingSetDefaultId === method.id ? "Setting..." : "Set Default"}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => removePaymentMutation.mutate(method.id)}
                            disabled={pendingRemoveId === method.id || method.isDefault}
                            data-testid={`button-remove-${method.id}`}
                          >
                            {pendingRemoveId === method.id ? "Removing..." : "Remove"}
                          </Button>
                        </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a payment method to manage your subscription
                  </p>
                </div>
              )}
            </CardContent>
            </Card>

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

                {/* Save Button */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={saveBillingAddressMutation.isPending}
                    data-testid="button-billing-save"
                  >
                    {saveBillingAddressMutation.isPending ? "Saving..." : "Save Billing Information"}
                  </Button>
                </div>
              </form>
            </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                          billingPeriod === 'yearly' ? (plan.annualPrice || plan.price) : plan.price,
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

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => {
        setShowCancelDialog(open);
        if (!open) {
          setCancelReason("missing_features"); // Reset to default
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              Cancelling Your HighLevel Account?
            </DialogTitle>
            <DialogDescription>
              Why do you want to cancel?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="missing_features" id="missing_features" />
                  <Label htmlFor="missing_features" className="cursor-pointer font-normal">
                    Missing features
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="trouble_setting_up" id="trouble_setting_up" />
                  <Label htmlFor="trouble_setting_up" className="cursor-pointer font-normal">
                    Having trouble setting up
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="too_expensive" id="too_expensive" />
                  <Label htmlFor="too_expensive" className="cursor-pointer font-normal">
                    Too expensive
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="not_using_enough" id="not_using_enough" />
                  <Label htmlFor="not_using_enough" className="cursor-pointer font-normal">
                    Not using enough
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="technical_issues" id="technical_issues" />
                  <Label htmlFor="technical_issues" className="cursor-pointer font-normal">
                    Technical issues
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="unsatisfactory_experience" id="unsatisfactory_experience" />
                  <Label htmlFor="unsatisfactory_experience" className="cursor-pointer font-normal">
                    Unsatisfactory customer experience
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="out_of_business" id="out_of_business" />
                  <Label htmlFor="out_of_business" className="cursor-pointer font-normal">
                    Went out of business
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="different_account" id="different_account" />
                  <Label htmlFor="different_account" className="cursor-pointer font-normal">
                    Signing up for a different account
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="different_product" id="different_product" />
                  <Label htmlFor="different_product" className="cursor-pointer font-normal">
                    Switching to a different product
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
              data-testid="button-cancel-back"
            >
              Back
            </Button>
            <Button
              onClick={() => {
                cancelSubscriptionMutation.mutate();
                setShowCancelDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-cancel"
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modify Subscription Dialog */}
      <Dialog open={showModifyDialog} onOpenChange={(open) => {
        setShowModifyDialog(open);
        if (!open) {
          // Reset all states when dialog closes
          setModifyDialogView('main');
          setFinancialSituation("");
          setProposedSolution("");
          setDowngradeReason("");
          setDowngradeConfirm1(false);
          setDowngradeConfirm2(false);
          setCancelReason("missing_features");
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          {/* Main View - Options List */}
          {modifyDialogView === 'main' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  Modify subscription for {company?.name || 'Curbe.io'}
                </DialogTitle>
                <DialogDescription>
                  Hold up! Did you know about the options below?
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-3 py-4">
                {/* Upgrade Plan Option - Only show if there's a higher plan available */}
                {nextHigherPlan && (
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-semibold">Upgrade to {nextHigherPlan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(
                            subscription?.billingCycle === 'yearly' 
                              ? nextHigherPlan.annualPrice || nextHigherPlan.price 
                              : nextHigherPlan.price,
                            nextHigherPlan.currency
                          )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setModifyDialogView('upgrade')}
                      data-testid="button-upgrade-plan"
                    >
                      Upgrade
                    </Button>
                  </div>
                )}

                {/* Financial Support Option */}
                <button
                  onClick={() => {
                    // Check if user already has an active discount
                    if (activeDiscount) {
                      setModifyDialogView('financial-ineligible');
                    } else {
                      setModifyDialogView('financial-support');
                    }
                  }}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-financial-support"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">Request Financial Support</p>
                      <p className="text-sm text-muted-foreground">
                        I need financial support due to unforeseen circumstances
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>

                {/* Downgrade Plan Option - Only show if there's a lower plan available (not the lowest) */}
                {nextLowerPlan && (
                  <button
                    onClick={() => setModifyDialogView('downgrade')}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                    data-testid="button-downgrade-plan"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                        <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400 rotate-180" />
                      </div>
                      <div>
                        <p className="font-semibold">Downgrade to {nextLowerPlan.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(
                            subscription?.billingCycle === 'yearly' 
                              ? nextLowerPlan.annualPrice || nextLowerPlan.price 
                              : nextLowerPlan.price,
                            nextLowerPlan.currency
                          )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}

                {/* Cancel Plan Option */}
                <button
                  onClick={() => setModifyDialogView('cancel')}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-cancel-plan"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-semibold">Cancel Plan</p>
                      <p className="text-sm text-muted-foreground">
                        I still want to cancel my subscription
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </>
          )}

          {/* Financial Ineligible View */}
          {modifyDialogView === 'financial-ineligible' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  You are ineligible for Financial Assistance at this point.
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-4">
                <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-orange-900 dark:text-orange-100 mb-1">Reason:</p>
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        Currently, you are not eligible for financial assistance support because you already have a discount applied to the upcoming invoice
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-ineligible-back"
                >
                  Back
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Financial Support Request View */}
          {modifyDialogView === 'financial-support' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Financial Support Request
                </DialogTitle>
                <DialogDescription>
                  We're here to help. Your success is our commitment. Share your situation and our team will review it within 48 hours.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Info Message */}
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Response Commitment</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Once your request is submitted, our team will review it and respond to you within 48 hours. 
                        We want to understand your situation and find the best solution together.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Situation Field */}
                <div className="space-y-2">
                  <Label htmlFor="situation" className="text-base font-semibold">
                    What is your current situation?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Briefly explain the circumstances affecting your payment ability.
                  </p>
                  <Textarea
                    id="situation"
                    value={financialSituation}
                    onChange={(e) => setFinancialSituation(e.target.value)}
                    placeholder="e.g., We are experiencing a temporary decline in sales due to..."
                    className="min-h-[120px] resize-none"
                    data-testid="input-situation"
                  />
                </div>

                {/* Proposed Solution Field */}
                <div className="space-y-2">
                  <Label htmlFor="proposed-solution" className="text-base font-semibold">
                    What solution do you propose?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    How could we work together to resolve this situation?
                  </p>
                  <Textarea
                    id="proposed-solution"
                    value={proposedSolution}
                    onChange={(e) => setProposedSolution(e.target.value)}
                    placeholder="e.g., I would need a temporary 30% discount for the next 3 months while..."
                    className="min-h-[120px] resize-none"
                    data-testid="input-proposed-solution"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-support-back"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (!financialSituation.trim() || !proposedSolution.trim()) {
                      toast({
                        title: "Required Fields",
                        description: "Please complete both fields before submitting",
                        variant: "destructive",
                      });
                      return;
                    }
                    financialSupportMutation.mutate({
                      situation: financialSituation,
                      proposedSolution: proposedSolution,
                    });
                  }}
                  disabled={financialSupportMutation.isPending}
                  data-testid="button-support-submit"
                >
                  {financialSupportMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Upgrade View - Select Plan */}
          {modifyDialogView === 'upgrade' && (() => {
            const higherPlans = getAllHigherPlans();
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    Select Upgrade Plan
                  </DialogTitle>
                  <DialogDescription>
                    Choose which plan you'd like to upgrade to
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 py-4">
                  {higherPlans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => {
                        setSelectedUpgradePlan(plan);
                        setModifyDialogView('upgrade-timing');
                      }}
                      className="flex items-center justify-between p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                      data-testid={`button-select-plan-${plan.name.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(
                              subscription?.billingCycle === 'yearly' 
                                ? plan.annualPrice || plan.price 
                                : plan.price,
                              plan.currency
                            )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setModifyDialogView('main')}
                    data-testid="button-upgrade-back"
                  >
                    Back
                  </Button>
                </DialogFooter>
              </>
            );
          })()}

          {/* Upgrade View - Select Timing */}
          {modifyDialogView === 'upgrade-timing' && selectedUpgradePlan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Rocket className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  Upgrade to {selectedUpgradePlan.name}
                </DialogTitle>
                <DialogDescription>
                  Choose when you'd like your upgrade to take effect
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Immediate Upgrade Option */}
                <button
                  onClick={() => {
                    if (subscription && subscription.billingCycle) {
                      changePlanMutation.mutate({
                        planId: selectedUpgradePlan.id,
                        billingPeriod: subscription.billingCycle,
                        immediate: true
                      });
                      setShowModifyDialog(false);
                    }
                  }}
                  className="flex flex-col p-4 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-upgrade-immediate"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-green-900 dark:text-green-100">Upgrade Immediately</span>
                    </div>
                    <Badge variant="default" className="bg-green-600">Recommended</Badge>
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                    Get instant access to all premium features. We'll calculate a credit for your unused time on the current plan and apply it to your first payment.
                  </p>
                  <div className="p-3 rounded-md bg-white/50 dark:bg-black/20 border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">How it works:</p>
                    <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                      <li>• Credit for unused time on current plan</li>
                      <li>• Charge for new plan (prorated for remaining period)</li>
                      <li>• Pay only the difference today</li>
                      <li>• Start using premium features immediately</li>
                    </ul>
                  </div>
                </button>

                {/* Scheduled Upgrade Option */}
                <button
                  onClick={() => {
                    if (subscription && subscription.billingCycle) {
                      changePlanMutation.mutate({
                        planId: selectedUpgradePlan.id,
                        billingPeriod: subscription.billingCycle,
                        immediate: false
                      });
                      setShowModifyDialog(false);
                    }
                  }}
                  className="flex flex-col p-4 rounded-lg border hover-elevate active-elevate-2 w-full text-left"
                  data-testid="button-upgrade-scheduled"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Upgrade at Next Renewal</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Schedule your upgrade for{' '}
                    <span className="font-semibold">
                      {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your next renewal date'}
                    </span>.
                    Continue using your current plan until then.
                  </p>
                </button>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('upgrade')}
                  data-testid="button-upgrade-timing-back"
                >
                  Back
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Downgrade View */}
          {modifyDialogView === 'downgrade' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400 rotate-180" />
                  </div>
                  Downgrade your plan
                </DialogTitle>
                <DialogDescription>
                  If you wish to move to a lower plan, you can downgrade your subscription to{' '}
                  {nextLowerPlan && (
                    <>
                      {nextLowerPlan.name} - {formatCurrency(
                        subscription?.billingCycle === 'yearly' 
                          ? nextLowerPlan.annualPrice || nextLowerPlan.price 
                          : nextLowerPlan.price,
                        nextLowerPlan.currency
                      )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'}
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Proration Information */}
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">How downgrade works</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Your downgrade will take effect at the end of your current billing period on{' '}
                        <span className="font-semibold">
                          {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your next renewal date'}
                        </span>. 
                        You'll continue to enjoy all features of your current plan until then, and the new lower-priced plan will begin on your next renewal. 
                        You won't lose any time you've already paid for.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reason Textarea */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tell us why you want to downgrade? <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    placeholder="Please tell us why would you like to downgrade your subscription? This will help us in making our platform better in future."
                    value={downgradeReason}
                    onChange={(e) => setDowngradeReason(e.target.value)}
                    className="min-h-[100px] resize-none"
                    data-testid="textarea-downgrade-reason"
                  />
                </div>

                {/* Confirmation Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirm1"
                      checked={downgradeConfirm1}
                      onCheckedChange={(checked) => setDowngradeConfirm1(checked as boolean)}
                      data-testid="checkbox-confirm-1"
                    />
                    <label
                      htmlFor="confirm1"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      I understand that the{' '}
                      {nextLowerPlan && (
                        <>
                          {nextLowerPlan.name} plan ({formatCurrency(
                            subscription?.billingCycle === 'yearly' 
                              ? nextLowerPlan.annualPrice || nextLowerPlan.price 
                              : nextLowerPlan.price,
                            nextLowerPlan.currency
                          )} / {subscription?.billingCycle === 'yearly' ? 'year' : 'month'})
                        </>
                      )}
                      {' '}has fewer features than my current plan
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="confirm2"
                      checked={downgradeConfirm2}
                      onCheckedChange={(checked) => setDowngradeConfirm2(checked as boolean)}
                      data-testid="checkbox-confirm-2"
                    />
                    <label
                      htmlFor="confirm2"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      I confirm that I understand the limitations of the lower plan and accept any feature restrictions that may apply
                    </label>
                  </div>
                </div>

                {/* Discount Warning */}
                {activeDiscount && (
                  <div className="p-4 rounded-lg border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                    <div className="flex gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                          Your discount coupon will be removed.
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                          A {activeDiscount.percentOff}% off for {activeDiscount.durationInMonths || 3} months coupon is applied to your subscription, which will be lost if you proceed to downgrade.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-downgrade-back"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (nextLowerPlan && subscription && subscription.billingCycle) {
                      changePlanMutation.mutate({
                        planId: nextLowerPlan.id,
                        billingPeriod: subscription.billingCycle
                      });
                      setShowModifyDialog(false);
                    }
                  }}
                  disabled={!downgradeReason || !downgradeConfirm1 || !downgradeConfirm2 || !nextLowerPlan || changePlanMutation.isPending}
                  data-testid="button-confirm-downgrade"
                >
                  {changePlanMutation.isPending ? 'Changing...' : `Downgrade to ${nextLowerPlan?.name || 'Lower Plan'}`}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Cancel View */}
          {modifyDialogView === 'cancel' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  Are you sure you want to cancel?
                </DialogTitle>
                <DialogDescription>
                  We're sorry to see you go. Please let us know why you're cancelling.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Critical Warning about Account Deactivation */}
                <div className="p-4 rounded-lg border-2 border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-900 dark:text-red-100 mb-2 text-base">
                        Important: Account Access Will End
                      </p>
                      <div className="space-y-2 text-sm text-red-800 dark:text-red-200">
                        <p>
                          After your subscription ends on{' '}
                          <span className="font-bold">
                            {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your end date'}
                          </span>, the following will happen automatically:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li><strong>Your account will be deactivated</strong></li>
                          <li><strong>All users in your company will lose access</strong></li>
                          <li><strong>You will not be able to log in</strong></li>
                          <li><strong>All features and functions will be disabled</strong></li>
                        </ul>
                        <p className="font-semibold mt-3">
                          You can continue using all features until {subscription?.currentPeriodEnd ? formatDate(new Date(subscription.currentPeriodEnd)) : 'your end date'}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cancellation Reason */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">
                    Why are you cancelling? <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="missing_features" id="missing_features" />
                      <Label htmlFor="missing_features" className="cursor-pointer flex-1">
                        Missing features I need
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="too_expensive" id="too_expensive" />
                      <Label htmlFor="too_expensive" className="cursor-pointer flex-1">
                        Too expensive
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="switching_service" id="switching_service" />
                      <Label htmlFor="switching_service" className="cursor-pointer flex-1">
                        Switching to another service
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="not_using" id="not_using" />
                      <Label htmlFor="not_using" className="cursor-pointer flex-1">
                        Not using it enough
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover-elevate">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="cursor-pointer flex-1">
                        Other
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setModifyDialogView('main')}
                  data-testid="button-cancel-back"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    cancelSubscriptionMutation.mutate();
                    setShowModifyDialog(false);
                  }}
                  disabled={!cancelReason}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="button-confirm-cancel"
                >
                  I Understand, Cancel Subscription
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </Tabs>
    </div>
  );
}