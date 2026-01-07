import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Shield,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  Heart,
  Activity,
  Star,
  Check,
  X,
  Info,
  Building2,
  Calendar,
  Users,
  CreditCard,
  ChevronDown,
  Database,
  FileText,
  ExternalLink,
  MapPin,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { extractCostShareFromCMS, formatCostShareValueShort } from "@shared/cost-share-utils";

// Helper to format yyyy-MM-dd string without timezone conversion
const formatDateFromString = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const [year, month, day] = dateString.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[parseInt(month) - 1];
  return `${monthName} ${day}, ${year}`;
};

// Helper to calculate age from yyyy-MM-dd string without timezone conversion
const calculateAgeFromString = (dateString: string): number => {
  if (!dateString) return 0;
  const [year, month, day] = dateString.split('-').map(Number);
  const today = new Date();
  const birthDate = new Date(year, month - 1, day); // month is 0-indexed
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function MarketplacePlansPage() {
  const [location, setLocation] = useLocation();
  
  // Detect if we're in quotes or policies context
  const isPolicy = location.startsWith('/customers/');
  const basePath = isPolicy ? 'customers' : 'quotes';
  const apiBasePath = isPolicy ? 'policies' : 'quotes';
  
  const [, quotesParams] = useRoute("/quotes/:id/marketplace-plans");
  const [, policiesParams] = useRoute("/customers/:id/marketplace-plans");
  
  const { toast } = useToast();
  const quoteId = quotesParams?.id || policiesParams?.id;

  // Filter states
  const [metalLevelFilter, setMetalLevelFilter] = useState<string>("all");
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all");
  const [maxPremium, setMaxPremium] = useState<number>(3000); // Default max for slider
  const [maxDeductible, setMaxDeductible] = useState<number>(10000); // Default max for slider
  const [sortBy, setSortBy] = useState<string>("deductible_asc");
  
  // New comprehensive filters
  const [selectedCarriers, setSelectedCarriers] = useState<Set<string>>(new Set());
  const [selectedMetals, setSelectedMetals] = useState<Set<string>>(new Set());
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [selectedPlanFeatures, setSelectedPlanFeatures] = useState<Set<string>>(new Set());
  const [selectedDiseasePrograms, setSelectedDiseasePrograms] = useState<Set<string>>(new Set());
  
  // Poverty Guidelines Dialog
  const [isPovertyGuidelinesOpen, setIsPovertyGuidelinesOpen] = useState(false);
  
  // Plan Comparison States
  const [selectedPlansForComparison, setSelectedPlansForComparison] = useState<Set<string>>(new Set());
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Fetch quote/policy details
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/${apiBasePath}/${quoteId}/detail`],
    enabled: !!quoteId,
  });

  // CRITICAL FIX: Load REAL family members from quote_members/policy_members table
  const { data: membersDetailsData } = useQuery<{ members: any[] }>({
    queryKey: [`/api/${apiBasePath}/${quoteId}/members`],
    enabled: !!quoteId,
  });

  // Fetch Poverty Guidelines from HHS API
  const currentYear = new Date().getFullYear();
  const record = (quoteData as any)?.[isPolicy ? 'policy' : 'quote'];
  const quoteState = record?.physical_state;
  const { data: povertyGuidelines, isLoading: isLoadingPovertyGuidelines, error: povertyGuidelinesError } = useQuery({
    queryKey: ['/api/hhs/poverty-guidelines', currentYear, quoteState],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: currentYear.toString(),
        ...(quoteState && { state: quoteState }),
      });
      const response = await fetch(`/api/hhs/poverty-guidelines?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch poverty guidelines: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!quoteData,
  });

  // Mutation for selecting a plan
  const selectPlanMutation = useMutation({
    mutationFn: async (plan: any) => {
      if (isPolicy) {
        // Use multi-plan endpoint for policies - ADD plan, don't replace
        const response = await apiRequest('POST', `/api/policies/${quoteId}/plans`, { 
          planData: plan,
          source: 'marketplace'
        });
        return response;
      } else {
        // Keep old behavior for quotes
        const response = await apiRequest('POST', `/api/quotes/${quoteId}/select-plan`, { plan });
        return response;
      }
    },
    onSuccess: () => {
      toast({
        title: "Plan Added",
        description: `The plan has been successfully added to your ${isPolicy ? 'policy' : 'quote'}.`,
        duration: 3000,
      });
      // Invalidate data to refresh
      queryClient.invalidateQueries({ queryKey: [`/api/${apiBasePath}`, quoteId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: [`/api/${apiBasePath}/${quoteId}/detail`] });
      // Navigate back to detail page
      setLocation(`/${basePath}/${quoteId}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add plan. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // Show 10 plans per page

  // Fetch marketplace plans with useQuery (with pagination)
  const { data: marketplacePlans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['/api/', apiBasePath, quoteId, 'marketplace-plans', {
      page: currentPage,
      metalLevels: Array.from(selectedMetals),
      issuers: Array.from(selectedCarriers),
      diseasePrograms: Array.from(selectedDiseasePrograms),
      networks: Array.from(selectedNetworks),
      planFeatures: Array.from(selectedPlanFeatures),
      maxPremium,
      maxDeductible,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });

      // Send ALL filters to backend - server will handle everything
      if (selectedMetals.size > 0) {
        params.append('metalLevels', Array.from(selectedMetals).join(','));
      }
      if (selectedCarriers.size > 0) {
        params.append('issuers', Array.from(selectedCarriers).join(','));
      }
      if (selectedDiseasePrograms.size > 0) {
        params.append('diseasePrograms', Array.from(selectedDiseasePrograms).join(','));
      }
      if (selectedNetworks.size > 0) {
        params.append('networks', Array.from(selectedNetworks).join(','));
      }
      if (selectedPlanFeatures.size > 0) {
        params.append('planFeatures', Array.from(selectedPlanFeatures).join(','));
      }
      if (maxPremium < 3000) {
        params.append('maxPremium', maxPremium.toString());
      }
      if (maxDeductible < 10000) {
        params.append('maxDeductible', maxDeductible.toString());
      }

      const response = await fetch(
        `/api/${apiBasePath}/${quoteId}/marketplace-plans?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch plans');
      }

      const data = await response.json();
      
      console.log(`📊 CMS API Response - Page ${currentPage}:`);
      console.log(`  - Total plans available: ${data.total || 0}`);
      console.log(`  - Plans in this page: ${data.plans?.length || 0}`);
      console.log(`  - household_aptc (from API): ${data.household_aptc || 'Not provided'}`);
      console.log(`  - Backend filters applied:`, {
        metalLevels: Array.from(selectedMetals),
        issuers: Array.from(selectedCarriers),
        diseasePrograms: Array.from(selectedDiseasePrograms),
      });
      
      return data;
    },
    enabled: !!quoteId,
  });

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // Helper functions
  const formatCurrency = (amount: number) => {
    const isZero = amount === 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: isZero ? 0 : 2,
      maximumFractionDigits: isZero ? 0 : 2,
    }).format(amount);
  };

  const getMetalLevelColor = (metalLevel: string) => {
    const level = metalLevel?.toLowerCase();
    if (level?.includes('bronze')) return 'bg-amber-700 text-white';
    if (level?.includes('silver')) return 'bg-gray-400 text-white';
    if (level?.includes('gold')) return 'bg-yellow-500 text-black';
    if (level?.includes('platinum')) return 'bg-purple-500 text-white';
    if (level?.includes('catastrophic')) return 'bg-red-600 text-white';
    return 'bg-blue-500 text-white';
  };

  // Use carriers facets from backend (calculated from ALL filtered plans, not just current page)
  const carriers: Array<{ name: string; count: number }> = marketplacePlans?.facets?.carriers || [];

  // CRITICAL: Use API response DIRECTLY - no client-side filtering or pagination!
  // All filtering and pagination happens server-side now
  const displayedPlans = marketplacePlans?.plans || [];
  const totalPlans = marketplacePlans?.total || 0;
  const totalPages = marketplacePlans?.totalPages || Math.ceil(totalPlans / pageSize);
  
  // Helper functions for plan comparison
  const togglePlanForComparison = (planId: string) => {
    const newSelected = new Set(selectedPlansForComparison);
    if (newSelected.has(planId)) {
      newSelected.delete(planId);
    } else {
      if (newSelected.size >= 5) {
        toast({
          variant: "destructive",
          title: "Maximum plans reached",
          description: "You can compare up to 5 plans at a time",
        });
        return;
      }
      newSelected.add(planId);
    }
    setSelectedPlansForComparison(newSelected);
  };
  
  const removePlanFromComparison = (planId: string) => {
    const newSelected = new Set(selectedPlansForComparison);
    newSelected.delete(planId);
    setSelectedPlansForComparison(newSelected);
  };
  
  const clearAllComparisons = () => {
    setSelectedPlansForComparison(new Set());
  };
  
  // Get selected plans data
  const selectedPlansData = Array.from(selectedPlansForComparison)
    .map(id => marketplacePlans?.plans?.find((p: any) => p.id === id))
    .filter(Boolean);

  // Loading state
  if (isLoadingQuote || isLoadingPlans) {
    return <LoadingSpinner message={isLoadingQuote ? "Loading quote details..." : "Fetching marketplace plans..."} />;
  }

  const quote = (quoteData as any)?.[isPolicy ? 'policy' : 'quote'];
  
  // PERMANENT FIX: Show ALL family members from quote_members/policy_members table (exclude only 'client')
  // This matches the EXACT same logic as quotes.tsx/policies.tsx - loads REAL data from BD
  const allFamilyMembersFromDB = membersDetailsData?.members?.filter(m => m.role !== 'client') || [];
  
  // Build family members list from REAL DATABASE (NOT JSONB fields)
  const allFamilyMembers = allFamilyMembersFromDB.map((member: any) => ({
    firstName: member.firstName,
    lastName: member.lastName,
    dateOfBirth: member.dateOfBirth,
    gender: member.gender,
    role: member.role,
    isApplicant: member.isApplicant !== false,
  }));
  
  // Count applicants: primary client (if applicant) + family members with isApplicant=true
  const clientIsApplicant = quote?.clientIsApplicant !== false;
  const otherApplicants = allFamilyMembers.filter((m: any) => m.isApplicant === true).length;
  const totalApplicants = (clientIsApplicant ? 1 : 0) + otherApplicants;
  
  // Count dependents: family members with role in {dependent, child, other} OR isApplicant=false
  const totalDependents = allFamilyMembers.filter((m: any) => {
    const role = m.role;
    const isApplicant = m.isApplicant;
    return ['dependent', 'child', 'other'].includes(role) || isApplicant === false;
  }).length;

  return (
    <div className="p-4">
      {/* 3-column layout: Household Info | Plans | Filters */}
      {quote && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-4">
          {/* Left Sidebar: Household Information */}
          <div className="space-y-4">
            {/* Back to Policy/Quote Button - ALWAYS VISIBLE */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setLocation(`/${basePath}/${quoteId}`)}
              data-testid="button-back-to-quote"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {isPolicy ? 'Policy' : 'Quote'}
            </Button>

            {/* APTC Tax Credit Card */}
            {marketplacePlans && marketplacePlans.household_aptc > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-full bg-green-600 dark:bg-green-700 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">APTC Tax Credit</p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(marketplacePlans.household_aptc)}<span className="text-sm font-normal">/month</span>
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-600 dark:text-green-500 mb-1">Estimated Annual Savings</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300">
                        {formatCurrency(marketplacePlans.household_aptc * 12)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <h3 className="font-semibold text-sm">Household information</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Annual income and Address row */}
                <div className="grid grid-cols-[130px_1fr] gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Annual income</p>
                    <button
                      className="font-medium flex items-center gap-1 hover:underline"
                      onClick={() => setLocation(`/${basePath}/${quoteId}`)}
                      data-testid="link-annual-income"
                    >
                      {formatCurrency(marketplacePlans?.household_income || (quoteData as any)?.totalHouseholdIncome || 0)}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <p className="text-muted-foreground text-xs mt-1">Effective date</p>
                    <p className="text-sm">{quote.effectiveDate ? (() => {
                      const [year, month, day] = quote.effectiveDate.split('-');
                      return `${month}/${day}/${year}`;
                    })() : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Address
                    </p>
                    <p className="text-sm break-words">‣ {quote.physical_county || 'N/A'}</p>
                    <p className="text-sm">‣ {quote.physical_state || 'N/A'}</p>
                    <p className="text-sm">‣ {quote.physical_postal_code || 'N/A'}</p>
                  </div>
                </div>

                {/* Family members section */}
                <div className="pt-2 border-t">
                  <h4 className="font-semibold text-sm mb-3">Family members</h4>
                  
                  {/* Applicants and Dependents count */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Applicants</p>
                      <p className="text-2xl font-bold">{totalApplicants}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Dependents</p>
                      <p className="text-2xl font-bold">{totalDependents}</p>
                    </div>
                  </div>

                  {/* Client (primary applicant) */}
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {quote.clientFirstName?.charAt(0) || 'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{quote.clientFirstName} {quote.clientLastName}</p>
                        <Badge variant="secondary" className="text-xs">Self</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {quote.clientDateOfBirth ? `${formatDateFromString(quote.clientDateOfBirth)} (${calculateAgeFromString(quote.clientDateOfBirth)})` : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quote.clientGender || 'Not specified'} • {quote.clientIsApplicant !== false ? 'Primary' : 'Member'}
                      </p>
                    </div>
                  </div>

                  {/* Other family members */}
                  {allFamilyMembers?.map((member: any, index: number) => {
                    const isDependent = ['dependent', 'child', 'other'].includes(member.role) || member.isApplicant === false;
                    return (
                      <div key={`${member.firstName}-${member.lastName}-${index}`} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 mt-2">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                            {member.firstName?.charAt(0) || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{member.firstName} {member.lastName}</p>
                            {member.isApplicant && !isDependent && (
                              <Badge variant="secondary" className="text-xs">Applicant</Badge>
                            )}
                            {isDependent && (
                              <Badge variant="outline" className="text-xs">Dependent</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {member.dateOfBirth ? `${formatDateFromString(member.dateOfBirth)} (${calculateAgeFromString(member.dateOfBirth)})` : 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.gender || 'Not specified'} • {member.role || 'Family'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Poverty Guidelines Card */}
            <Card>
              <CardHeader className="pb-3">
                <h3 className="font-semibold text-sm">Poverty Guidelines</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Header Row */}
                <div className="grid grid-cols-2 gap-4 pb-2 border-b text-xs font-medium text-muted-foreground">
                  <div>Household size</div>
                  <div className="text-right">100% Poverty Guidelines</div>
                </div>

                {/* Poverty Guidelines Data */}
                {isLoadingPovertyGuidelines ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : povertyGuidelinesError ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
                    <p className="text-sm font-medium text-destructive mb-1">Data Unavailable</p>
                    <p className="text-xs text-muted-foreground text-center">
                      Poverty Guidelines for {new Date().getFullYear()} are not available. Please contact support.
                    </p>
                  </div>
                ) : (
                  (povertyGuidelines as any)?.guidelines?.map((item: any) => {
                    const size = item.household_size;
                    const amount = item.amount;
                    const householdSize = 1 + allFamilyMembers.length;
                    const isCurrentSize = size === householdSize;
                    return (
                      <div
                        key={size}
                        className={`grid grid-cols-2 gap-4 py-1.5 px-2 rounded ${
                          isCurrentSize ? 'bg-primary/10 border border-primary/20' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={isCurrentSize ? 'font-semibold' : ''}>{size}</span>
                        </div>
                        <div className={`text-sm text-right ${isCurrentSize ? 'font-semibold' : ''}`}>
                          {formatCurrency(amount)}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Additional Person Note */}
                {!isLoadingPovertyGuidelines && (povertyGuidelines as any)?.additional_person_increment && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Add {formatCurrency((povertyGuidelines as any).additional_person_increment)} for each additional person
                  </div>
                )}

                {/* More Information Button */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setIsPovertyGuidelinesOpen(true)}
                  data-testid="button-poverty-guidelines-info"
                >
                  <Info className="h-4 w-4 mr-2" />
                  More information
                </Button>

                {/* Disclaimer */}
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Poverty Guidelines data is retrieved from the HHS API. Curbe.io does not modify this information and is not responsible for its accuracy or timeliness.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Center: Plans List */}
          <div className="space-y-4">

          {marketplacePlans && displayedPlans && (
            <div className="grid gap-4">
              {/* Header with Sort, Order, and Pagination */}
              <div className="space-y-3 pb-2 border-b">
                {/* First Row: Sort, Order, and Pagination Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort by</span>
                    <Select value={sortBy.replace(/_asc|_desc/, '')} onValueChange={(value) => {
                      const order = sortBy.endsWith('_desc') ? '_desc' : '_asc';
                      setSortBy(`${value}${order}`);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-[180px] h-9" data-testid="header-sort">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">Monthly premium</SelectItem>
                        <SelectItem value="deductible">Deductible</SelectItem>
                        <SelectItem value="out_of_pocket">Out-of-Pocket cost</SelectItem>
                        <SelectItem value="total_cost">Total costs</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Order by</span>
                    <Select value={sortBy.endsWith('_desc') ? 'desc' : 'asc'} onValueChange={(order) => {
                      const baseSort = sortBy.replace(/_asc|_desc/, '');
                      setSortBy(`${baseSort}_${order}`);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-[140px] h-9" data-testid="header-order">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setCurrentPage(pageNum)}
                            data-testid={`button-page-${pageNum}`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="px-2 text-muted-foreground">...</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setCurrentPage(totalPages)}
                            data-testid={`button-page-${totalPages}`}
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Second Row: Total Plans Count */}
                <div className="flex items-center">
                  <span className="text-sm font-medium">
                    Total plans: {totalPlans} {totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
                  </span>
                </div>
              </div>

              {displayedPlans.map((plan: any, index: number) => {
                // Calculate APTC (tax credit) for this plan
                const aptcAmount = plan.premium - (plan.premium_w_credit || plan.premium);
                
                // Extract all deductible info
                const individualDeductible = plan.deductibles?.find((d: any) => !d.family);
                const familyDeductible = plan.deductibles?.find((d: any) => d.family);
                const mainDeductible = individualDeductible || familyDeductible || plan.deductibles?.[0];
                
                // Extract MOOP (out-of-pocket max)
                const individualMoop = plan.moops?.find((m: any) => !m.family);
                const outOfPocketMax = individualMoop?.amount || plan.out_of_pocket_limit;
                
                // Extract benefits with cost sharing info
                const getBenefitCost = (benefitName: string) => {
                  // For CMS plans: extract from benefits array
                  const benefit = plan.benefits?.find((b: any) => 
                    b.name?.toLowerCase().includes(benefitName.toLowerCase())
                  );
                  if (benefit) {
                    const costSharing = benefit.cost_sharings?.[0];
                    const costShareValue = extractCostShareFromCMS(costSharing);
                    return costShareValue ? formatCostShareValueShort(costShareValue) : null;
                  }
                  return null;
                };

                // CRITICAL FIX: Restore fallback to plan.copay_primary/copay_specialist fields
                const primaryCareCost = getBenefitCost('Primary Care') || (plan.copay_primary ? formatCurrency(plan.copay_primary) : null);
                const specialistCost = getBenefitCost('Specialist') || (plan.copay_specialist ? formatCurrency(plan.copay_specialist) : null);
                const urgentCareCost = getBenefitCost('Urgent Care') || (plan.copay_urgent_care ? formatCurrency(plan.copay_urgent_care) : null);
                const emergencyCost = getBenefitCost('Emergency') || (plan.copay_emergency ? formatCurrency(plan.copay_emergency) : null);
                const genericDrugsCost = getBenefitCost('Generic Drugs');
                const mentalHealthCost = getBenefitCost('Mental');

                return (
                <Card key={`${plan.id}-${index}`} className="overflow-hidden hover-elevate">
                  {/* Header with Logo */}
                  <div className="flex items-start justify-between gap-4 p-4 border-b bg-muted/20">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-background border flex items-center justify-center flex-shrink-0">
                        <Shield className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-0.5">{plan.issuer?.name || 'Insurance Provider'}</h3>
                        <p className="text-xs text-muted-foreground mb-2">Plan ID: {plan.id || 'N/A'}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {plan.metal_level || 'N/A'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {plan.type || 'N/A'}
                          </Badge>
                          {plan.quality_rating?.available ? (
                            <span className="text-xs">
                              Rating: {plan.quality_rating.global_rating > 0 
                                ? `${plan.quality_rating.global_rating}/5` 
                                : 'New/Ineligible'}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Rating: N/A</span>
                          )}
                          {plan.has_dental_child_coverage && (
                            <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700">
                              Dental Child
                            </Badge>
                          )}
                          {plan.has_dental_adult_coverage && (
                            <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700">
                              Dental Adult
                            </Badge>
                          )}
                          {plan.hsa_eligible && (
                            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700">
                              HSA
                            </Badge>
                          )}
                          {plan.simple_choice && (
                            <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700">
                              Simple Choice
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Grid */}
                  <div className="p-6">
                    {/* Plan Name */}
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-medium text-primary">{plan.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {marketplacePlans?.year || new Date().getFullYear()}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr] gap-6 mb-6">
                      {/* Left: Prima mensual */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-semibold">Premium</p>
                          {aptcAmount > 0 && (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">
                              Tax Credit
                            </Badge>
                          )}
                        </div>
                        <p className="text-4xl font-bold mb-1">
                          {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null 
                            ? formatCurrency(plan.premium_w_credit)
                            : formatCurrency(plan.premium)}
                        </p>
                        {aptcAmount > 0 && (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              <DollarSign className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                              <p className="text-sm font-medium text-green-600 dark:text-green-500">
                                {formatCurrency(aptcAmount)}/month tax credit
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground line-through">
                              Original price: {formatCurrency(plan.premium)}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Center: Deductible */}
                      <div>
                        <p className="text-sm font-semibold mb-2">Deductible</p>
                        <p className="text-4xl font-bold mb-1">
                          {mainDeductible ? formatCurrency(mainDeductible.amount) : '$0'}
                        </p>
                        {mainDeductible && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Individual total ({formatCurrency(mainDeductible.amount)} per person)
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Health & drug combined
                            </p>
                          </>
                        )}
                      </div>

                      {/* Right: Out-of-pocket max */}
                      <div>
                        <p className="text-sm font-semibold mb-2">Out-of-pocket max</p>
                        <p className="text-4xl font-bold mb-1">
                          {outOfPocketMax ? formatCurrency(outOfPocketMax) : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">Individual total</p>
                        <p className="text-xs text-muted-foreground">
                          Maximum for Medical and Drug EHB Benefits
                        </p>
                      </div>
                    </div>

                    {/* Benefits Grid - 2x3 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Primary Doctor visits</p>
                        <p className="text-sm text-muted-foreground">
                          {primaryCareCost || 'No Charge After Deductible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Specialist Visits</p>
                        <p className="text-sm text-muted-foreground">
                          {specialistCost || 'No Charge After Deductible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Urgent care</p>
                        <p className="text-sm text-muted-foreground">
                          {urgentCareCost || 'No Charge After Deductible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Emergencies</p>
                        <p className="text-sm text-muted-foreground">
                          {emergencyCost || '40% Coinsurance after deductible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Mental health</p>
                        <p className="text-sm text-muted-foreground">
                          {mentalHealthCost || 'No Charge After Deductible'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Generic drugs</p>
                        <p className="text-sm text-muted-foreground">
                          {genericDrugsCost || 'No Charge After Deductible'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer with Actions */}
                  <div className="px-6 pb-4 pt-2 border-t flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id={`compare-${plan.id}`} 
                        className="h-4 w-4 cursor-pointer"
                        checked={selectedPlansForComparison.has(plan.id)}
                        onChange={() => togglePlanForComparison(plan.id)}
                        data-testid={`checkbox-compare-${index}`}
                      />
                      <label htmlFor={`compare-${plan.id}`} className="text-sm cursor-pointer">
                        Compare
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      {plan.drug_formulary_url && (
                        <button 
                          className="text-sm text-primary hover:underline"
                          onClick={() => window.open(plan.drug_formulary_url, '_blank')}
                          data-testid={`button-drugs-${index}`}
                        >
                          Medicamentos
                        </button>
                      )}
                      {plan.network_url && (
                        <button 
                          className="text-sm text-primary hover:underline"
                          onClick={() => window.open(plan.network_url, '_blank')}
                          data-testid={`button-providers-${index}`}
                        >
                          Doctores
                        </button>
                      )}
                      {plan.brochure_url && (
                        <button 
                          className="text-sm text-primary hover:underline"
                          onClick={() => window.open(plan.brochure_url, '_blank')}
                          data-testid={`button-benefits-${index}`}
                        >
                          Beneficios
                        </button>
                      )}
                      {plan.brochure_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`button-view-details-${index}`}
                          onClick={() => window.open(plan.brochure_url, '_blank')}
                        >
                          Detalles del plan
                        </Button>
                      )}
                      <Button 
                        variant="default" 
                        size="sm"
                        data-testid={`button-select-plan-${index}`}
                        onClick={() => selectPlanMutation.mutate(plan)}
                        disabled={selectPlanMutation.isPending}
                      >
                        {selectPlanMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Selecting...
                          </>
                        ) : (
                          'Select Plan'
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
              })}

              {/* Traditional Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 pt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => {
                            if (currentPage > 1) {
                              setCurrentPage(currentPage - 1);
                            }
                          }}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          data-testid="button-previous-page"
                        />
                      </PaginationItem>
                      
                      {/* Page numbers */}
                      {(() => {
                        const pages = [];
                        const maxVisiblePages = 5;
                        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                        
                        if (endPage - startPage < maxVisiblePages - 1) {
                          startPage = Math.max(1, endPage - maxVisiblePages + 1);
                        }
                        
                        // First page
                        if (startPage > 1) {
                          pages.push(
                            <PaginationItem key={1}>
                              <PaginationLink
                                onClick={() => setCurrentPage(1)}
                                isActive={currentPage === 1}
                                className="cursor-pointer"
                                data-testid="button-page-1"
                              >
                                1
                              </PaginationLink>
                            </PaginationItem>
                          );
                          if (startPage > 2) {
                            pages.push(
                              <PaginationItem key="ellipsis-start">
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                        }
                        
                        // Middle pages
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <PaginationItem key={i}>
                              <PaginationLink
                                onClick={() => setCurrentPage(i)}
                                isActive={currentPage === i}
                                className="cursor-pointer"
                                data-testid={`button-page-${i}`}
                              >
                                {i}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        
                        // Last page
                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <PaginationItem key="ellipsis-end">
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          pages.push(
                            <PaginationItem key={totalPages}>
                              <PaginationLink
                                onClick={() => setCurrentPage(totalPages)}
                                isActive={currentPage === totalPages}
                                className="cursor-pointer"
                                data-testid={`button-page-${totalPages}`}
                              >
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                        
                        return pages;
                      })()}
                      
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => {
                            if (currentPage < totalPages) {
                              setCurrentPage(currentPage + 1);
                            }
                          }}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          data-testid="button-next-page"
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({totalPlans} total plans)
                  </p>
                </div>
              )}

              {displayedPlans.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Info className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-lg font-medium mb-2">No plans match your filters</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filter criteria to see more plans
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          </div>

          {/* Right Sidebar: Filters */}
          <div className="space-y-4">
            <Card className="sticky top-4 max-h-[calc(100vh-2rem)] flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <h3 className="font-semibold text-sm">Filters</h3>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto flex-1">
                {/* Monthly premium max */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Monthly premium max</Label>
                    <span className="text-xs font-medium text-primary">${maxPremium}</span>
                  </div>
                  <Slider
                    value={[maxPremium]}
                    onValueChange={(value) => {
                      setMaxPremium(value[0]);
                      setCurrentPage(1);
                    }}
                    min={0}
                    max={3000}
                    step={50}
                    data-testid="filter-monthly-premium-max"
                    className="w-full"
                  />
                </div>

                {/* Deductible max */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Deductible max</Label>
                    <span className="text-xs font-medium text-primary">${maxDeductible}</span>
                  </div>
                  <Slider
                    value={[maxDeductible]}
                    onValueChange={(value) => {
                      setMaxDeductible(value[0]);
                      setCurrentPage(1);
                    }}
                    min={0}
                    max={10000}
                    step={100}
                    data-testid="filter-deductible-max"
                    className="w-full"
                  />
                </div>

                {/* Carriers */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5">
                    <Label className="text-xs font-medium cursor-pointer">Carriers</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 mt-1.5">
                    {carriers.map((carrier) => (
                      <div key={carrier.name} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`carrier-${carrier.name}`}
                          checked={selectedCarriers.has(carrier.name)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedCarriers);
                            if (e.target.checked) {
                              newSelected.add(carrier.name);
                            } else {
                              newSelected.delete(carrier.name);
                            }
                            setSelectedCarriers(newSelected);
                            setCurrentPage(1);
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <label
                          htmlFor={`carrier-${carrier.name}`}
                          className="text-xs cursor-pointer flex-1"
                        >
                          {carrier.name} ({carrier.count})
                        </label>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Metal */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5">
                    <Label className="text-xs font-medium cursor-pointer">Metal</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 mt-1.5">
                    {['Bronze', 'Silver', 'Gold', 'Platinum'].map((metal) => {
                      const count = marketplacePlans?.plans?.filter((p: any) => 
                        p.metal_level?.toLowerCase().includes(metal.toLowerCase())
                      ).length || 0;
                      return (
                        <div key={metal} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`metal-${metal}`}
                            checked={selectedMetals.has(metal)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedMetals);
                              if (e.target.checked) {
                                newSelected.add(metal);
                              } else {
                                newSelected.delete(metal);
                              }
                              setSelectedMetals(newSelected);
                              setCurrentPage(1);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <label
                            htmlFor={`metal-${metal}`}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {metal} ({count})
                          </label>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>

                {/* Networks */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5">
                    <Label className="text-xs font-medium cursor-pointer">Networks</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 mt-1.5">
                    {['PPO', 'HMO', 'POS', 'EPO'].map((network) => {
                      const count = marketplacePlans?.plans?.filter((p: any) => 
                        p.type === network
                      ).length || 0;
                      return (
                        <div key={network} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`network-${network}`}
                            checked={selectedNetworks.has(network)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedNetworks);
                              if (e.target.checked) {
                                newSelected.add(network);
                              } else {
                                newSelected.delete(network);
                              }
                              setSelectedNetworks(newSelected);
                              setCurrentPage(1);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <label
                            htmlFor={`network-${network}`}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {network} ({count})
                          </label>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>

                {/* Plan features */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5">
                    <Label className="text-xs font-medium cursor-pointer">Plan features</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 mt-1.5">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="feature-dental-child"
                        checked={selectedPlanFeatures.has('dental_child')}
                        onChange={(e) => {
                          const newSelected = new Set(selectedPlanFeatures);
                          if (e.target.checked) {
                            newSelected.add('dental_child');
                          } else {
                            newSelected.delete('dental_child');
                          }
                          setSelectedPlanFeatures(newSelected);
                          setCurrentPage(1);
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor="feature-dental-child" className="text-xs cursor-pointer flex-1">
                        Dental coverage Children ({marketplacePlans?.plans?.filter((p: any) => p.has_dental_child_coverage).length || 0})
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="feature-dental-adult"
                        checked={selectedPlanFeatures.has('dental_adult')}
                        onChange={(e) => {
                          const newSelected = new Set(selectedPlanFeatures);
                          if (e.target.checked) {
                            newSelected.add('dental_adult');
                          } else {
                            newSelected.delete('dental_adult');
                          }
                          setSelectedPlanFeatures(newSelected);
                          setCurrentPage(1);
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor="feature-dental-adult" className="text-xs cursor-pointer flex-1">
                        Dental coverage Adult ({marketplacePlans?.plans?.filter((p: any) => p.has_dental_adult_coverage).length || 0})
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="feature-hsa-eligible"
                        checked={selectedPlanFeatures.has('hsa_eligible')}
                        onChange={(e) => {
                          const newSelected = new Set(selectedPlanFeatures);
                          if (e.target.checked) {
                            newSelected.add('hsa_eligible');
                          } else {
                            newSelected.delete('hsa_eligible');
                          }
                          setSelectedPlanFeatures(newSelected);
                          setCurrentPage(1);
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor="feature-hsa-eligible" className="text-xs cursor-pointer flex-1">
                        HSA qualified ({marketplacePlans?.plans?.filter((p: any) => p.hsa_eligible).length || 0})
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="feature-simple-choice"
                        checked={selectedPlanFeatures.has('simple_choice')}
                        onChange={(e) => {
                          const newSelected = new Set(selectedPlanFeatures);
                          if (e.target.checked) {
                            newSelected.add('simple_choice');
                          } else {
                            newSelected.delete('simple_choice');
                          }
                          setSelectedPlanFeatures(newSelected);
                          setCurrentPage(1);
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor="feature-simple-choice" className="text-xs cursor-pointer flex-1">
                        Simple choice ({marketplacePlans?.plans?.filter((p: any) => p.simple_choice).length || 0})
                      </label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Disease programs */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5">
                    <Label className="text-xs font-medium cursor-pointer">Disease programs</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5 mt-1.5">
                    {[
                      'Asthma',
                      'Heart Disease',
                      'Depression',
                      'Diabetes',
                      'High Blood Pressure',
                      'Low Back Pain',
                      'Maternity',
                      'Pregnancy',
                      'Weight Loss Programs'
                    ].map((program) => {
                      const count = marketplacePlans?.plans?.filter((p: any) => 
                        p.disease_mgmt_programs?.some((d: string) => d.toLowerCase().includes(program.toLowerCase()))
                      ).length || 0;
                      return (
                        <div key={program} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`disease-${program}`}
                            checked={selectedDiseasePrograms.has(program)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedDiseasePrograms);
                              if (e.target.checked) {
                                newSelected.add(program);
                              } else {
                                newSelected.delete(program);
                              }
                              setSelectedDiseasePrograms(newSelected);
                              setCurrentPage(1);
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <label
                            htmlFor={`disease-${program}`}
                            className="text-xs cursor-pointer flex-1"
                          >
                            {program} ({count})
                          </label>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>

                {/* Clear all filters */}
                {(selectedCarriers.size > 0 || selectedMetals.size > 0 || selectedNetworks.size > 0 || 
                  selectedPlanFeatures.size > 0 || selectedDiseasePrograms.size > 0 || maxPremium < 3000 || maxDeductible < 10000) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      setSelectedCarriers(new Set());
                      setSelectedMetals(new Set());
                      setSelectedNetworks(new Set());
                      setSelectedPlanFeatures(new Set());
                      setSelectedDiseasePrograms(new Set());
                      setMetalLevelFilter("all");
                      setPlanTypeFilter("all");
                      setMaxPremium(3000);
                      setMaxDeductible(10000);
                      setCurrentPage(1);
                    }}
                    data-testid="button-clear-all-filters"
                  >
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Disclaimer Section */}
      {quote && (
        <div className="mt-6 p-5 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-900">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-3 text-sm text-blue-900 dark:text-blue-100">
              <p>
                This website is operated by <strong>Curbe.io</strong> and is not the Health Insurance Marketplace® website. In offering this quote tool, Curbe.io users are required to comply with all applicable federal laws, including the standards established under 45 CFR §155.220(c) and (d) and standards established under 45 CFR §155.260 to protect the privacy and security of personally identifiable information.
              </p>
              <p>
                This is not an application for health coverage. This tool is designed to preview available plans and prices. You should visit <strong>HealthCare.gov</strong> if you want to enroll members. You'll know exactly what members will pay when you enroll them.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Poverty Guidelines Dialog */}
      <Dialog open={isPovertyGuidelinesOpen} onOpenChange={setIsPovertyGuidelinesOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {(povertyGuidelines as any)?.year || new Date().getFullYear()} Poverty Guidelines for {(povertyGuidelines as any)?.state || quote?.physical_state || 'the United States'}
            </DialogTitle>
            <DialogDescription>
              The Poverty Guidelines information displayed on this website is obtained directly from the U.S. Department of Health and Human Services (HHS).
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-x-auto mt-4">
            {isLoadingPovertyGuidelines ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="min-w-[1200px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2">
                      <th className="text-left py-3 px-4 font-semibold text-sm bg-muted/30">Household Size</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">50%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">75%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">100%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">125%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">133%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">135%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">138%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">150%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">175%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">180%</th>
                      <th className="text-right py-3 px-3 font-semibold text-sm bg-muted/30">185%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 14 }, (_, i) => {
                      const size = i + 1;
                      
                      // Get base amount for this household size
                      const baseGuideline = (povertyGuidelines as any)?.guidelines?.find((g: any) => g.household_size === size);
                      let p100 = baseGuideline?.amount || 0;
                      
                      // If size > 8, calculate using additional person increment
                      if (size > 8 && !baseGuideline && (povertyGuidelines as any)?.additional_person_increment) {
                        const base8 = (povertyGuidelines as any)?.guidelines?.find((g: any) => g.household_size === 8)?.amount || 0;
                        const additionalPeople = size - 8;
                        p100 = base8 + (additionalPeople * (povertyGuidelines as any).additional_person_increment);
                      }
                      
                      // Calculate all percentages based on 100% value
                      const p50 = Math.round(p100 * 0.50);
                      const p75 = Math.round(p100 * 0.75);
                      const p125 = Math.round(p100 * 1.25);
                      const p133 = Math.round(p100 * 1.33);
                      const p135 = Math.round(p100 * 1.35);
                      const p138 = Math.round(p100 * 1.38);
                      const p150 = Math.round(p100 * 1.50);
                      const p175 = Math.round(p100 * 1.75);
                      const p180 = Math.round(p100 * 1.80);
                      const p185 = Math.round(p100 * 1.85);
                      
                      const householdSize = 1 + allFamilyMembers.length;
                      const isCurrentSize = size === householdSize;
                      
                      return (
                        <tr
                          key={size}
                          className={`border-b ${
                            isCurrentSize ? 'bg-primary/10 font-semibold' : 'hover-elevate'
                          }`}
                        >
                          <td className="py-2.5 px-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {size}
                            </div>
                          </td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p50)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p75)}</td>
                          <td className="text-right py-2.5 px-3 text-sm font-medium">{formatCurrency(p100)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p125)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p133)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p135)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p138)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p150)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p175)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p180)}</td>
                          <td className="text-right py-2.5 px-3 text-sm">{formatCurrency(p185)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              The Poverty Guidelines information displayed on this website is obtained directly from the <strong>U.S. Department of Health and Human Services (HHS)</strong>. <strong>Curbe.io</strong> does not alter, modify, or validate this data. Accordingly, Curbe.io assumes no responsibility or liability for any errors, omissions, outdated information, or inaccuracies that may arise from the data provided by the HHS. Any discrepancies or concerns regarding the displayed information should be verified directly with the <strong>HHS</strong>.
            </p>
          </div>

          {/* Close Button */}
          <div className="mt-4 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setIsPovertyGuidelinesOpen(false)}
              data-testid="button-close-poverty-dialog"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky Bottom Bar - Plan Comparison */}
      {selectedPlansForComparison.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary/10 dark:bg-primary/20 border-t border-primary/30 p-4 z-50">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 overflow-x-auto">
              {selectedPlansData.map((plan: any) => (
                <div
                  key={plan.id}
                  className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border flex-shrink-0"
                >
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs font-medium truncate">{plan.issuer?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{formatCurrency(plan.premium_w_credit !== undefined ? plan.premium_w_credit : plan.premium)}/mo</p>
                  </div>
                  <button
                    onClick={() => removePlanFromComparison(plan.id)}
                    className="text-muted-foreground hover:text-destructive"
                    data-testid={`button-remove-comparison-${plan.id}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllComparisons}
                data-testid="button-clear-comparisons"
              >
                Clear
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsComparisonOpen(true)}
                disabled={selectedPlansForComparison.size < 2}
                data-testid="button-open-comparison"
              >
                <Shield className="h-4 w-4 mr-2" />
                Compare ({selectedPlansForComparison.size})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Comparison Dialog */}
      <Dialog open={isComparisonOpen} onOpenChange={setIsComparisonOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-5 border-b bg-muted/30">
            <DialogTitle className="text-xl">
              Compare Plans ({selectedPlansForComparison.size})
            </DialogTitle>
            <DialogDescription className="text-sm">
              Side-by-side comparison of selected health insurance plans
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
            {/* Plan Headers with Cards */}
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `200px repeat(${selectedPlansForComparison.size}, 1fr)` }}>
              <div></div>
              {selectedPlansData.map((plan: any) => (
                <Card key={plan.id} className="relative">
                  <button
                    onClick={() => removePlanFromComparison(plan.id)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive z-10"
                    data-testid={`button-remove-comparison-header-${plan.id}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <p className="font-semibold text-sm mb-1">{plan.issuer?.name || 'Unknown Carrier'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{plan.name}</p>
                    </div>
                    <Button variant="default" size="sm" className="w-full" data-testid={`button-select-plan-${plan.id}`}>
                      Select Plan
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Costs Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Main Costs</h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: `200px repeat(${selectedPlansForComparison.size}, 1fr)` }}>
                {/* Premium */}
                <div className="flex items-center h-20 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Premium</p>
                </div>
                {selectedPlansData.map((plan: any) => (
                  <Card key={plan.id}>
                    <CardContent className="p-4 h-20 flex flex-col justify-center">
                      <p className="text-2xl font-bold text-center">
                        {formatCurrency(plan.premium_w_credit !== undefined ? plan.premium_w_credit : plan.premium)}
                      </p>
                      {plan.premium_w_credit !== undefined && plan.premium > plan.premium_w_credit && (
                        <p className="text-xs text-center text-green-600 dark:text-green-500 mt-1">
                          Save {formatCurrency(plan.premium - plan.premium_w_credit)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Deductible */}
                <div className="flex items-center h-16 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Deductible</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const mainDeductible = plan.deductibles?.find((d: any) => !d.family) || plan.deductibles?.[0];
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-4 h-16 flex items-center justify-center">
                        <p className="text-lg font-semibold">
                          {mainDeductible ? formatCurrency(mainDeductible.amount) : '$0'}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Out-of-pocket max */}
                <div className="flex items-center h-16 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Out-of-pocket max</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const individualMoop = plan.moops?.find((m: any) => !m.family);
                  const outOfPocketMax = individualMoop?.amount || plan.out_of_pocket_limit;
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-4 h-16 flex items-center justify-center">
                        <p className="text-lg font-semibold">
                          {outOfPocketMax ? formatCurrency(outOfPocketMax) : 'N/A'}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Plan Details Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Plan Details</h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: `200px repeat(${selectedPlansForComparison.size}, 1fr)` }}>
                {/* Metal Level */}
                <div className="flex items-center h-12 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Metal Level</p>
                </div>
                {selectedPlansData.map((plan: any) => (
                  <Card key={plan.id}>
                    <CardContent className="p-3 h-12 flex items-center justify-center">
                      <Badge variant="outline" className="text-xs">
                        {plan.metal_level || 'N/A'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}

                {/* Network */}
                <div className="flex items-center h-12 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Network Type</p>
                </div>
                {selectedPlansData.map((plan: any) => (
                  <Card key={plan.id}>
                    <CardContent className="p-3 h-12 flex items-center justify-center">
                      <Badge variant="outline" className="text-xs">
                        {plan.type || 'N/A'}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}

                {/* Rating */}
                <div className="flex items-center h-12 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Quality Rating</p>
                </div>
                {selectedPlansData.map((plan: any) => (
                  <Card key={plan.id}>
                    <CardContent className="p-3 h-12 flex items-center justify-center">
                      <p className="text-sm font-medium">
                        {plan.quality_rating?.available ? (
                          plan.quality_rating.global_rating > 0 
                            ? `${plan.quality_rating.global_rating}/5` 
                            : 'Not Rated'
                        ) : (
                          'N/A'
                        )}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Benefits Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Benefits & Services</h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: `200px repeat(${selectedPlansForComparison.size}, 1fr)` }}>
                {/* Primary Doctor visits */}
                <div className="flex items-center h-14 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Primary Doctor</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const getBenefitCost = (benefitName: string) => {
                    const benefit = plan.benefits?.find((b: any) => 
                      b.name?.toLowerCase().includes(benefitName.toLowerCase())
                    );
                    if (!benefit) return null;
                    const costSharing = benefit.cost_sharings?.[0];
                    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                  };
                  const cost = getBenefitCost('Primary Care') || (plan.copay_primary ? formatCurrency(plan.copay_primary) : null);
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-3 h-14 flex items-center justify-center">
                        <p className="text-sm text-center">{cost || '$0'}</p>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Specialist Visits */}
                <div className="flex items-center h-14 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Specialist</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const getBenefitCost = (benefitName: string) => {
                    const benefit = plan.benefits?.find((b: any) => 
                      b.name?.toLowerCase().includes(benefitName.toLowerCase())
                    );
                    if (!benefit) return null;
                    const costSharing = benefit.cost_sharings?.[0];
                    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                  };
                  const cost = getBenefitCost('Specialist') || (plan.copay_specialist ? formatCurrency(plan.copay_specialist) : null);
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-3 h-14 flex items-center justify-center">
                        <p className="text-sm text-center">{cost || '$0'}</p>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Urgent care */}
                <div className="flex items-center h-14 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Urgent Care</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const getBenefitCost = (benefitName: string) => {
                    const benefit = plan.benefits?.find((b: any) => 
                      b.name?.toLowerCase().includes(benefitName.toLowerCase())
                    );
                    if (!benefit) return null;
                    const costSharing = benefit.cost_sharings?.[0];
                    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                  };
                  const cost = getBenefitCost('Urgent Care') || (plan.copay_urgent_care ? formatCurrency(plan.copay_urgent_care) : null);
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-3 h-14 flex items-center justify-center">
                        <p className="text-sm text-center">{cost || '$75'}</p>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Emergencies */}
                <div className="flex items-center h-14 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Emergency</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const getBenefitCost = (benefitName: string) => {
                    const benefit = plan.benefits?.find((b: any) => 
                      b.name?.toLowerCase().includes(benefitName.toLowerCase())
                    );
                    if (!benefit) return null;
                    const costSharing = benefit.cost_sharings?.[0];
                    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                  };
                  const cost = getBenefitCost('Emergency') || (plan.copay_emergency ? formatCurrency(plan.copay_emergency) : null);
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-3 h-14 flex items-center justify-center">
                        <p className="text-sm text-center">{cost || '50% after deductible'}</p>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Mental health */}
                <div className="flex items-center h-14 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Mental Health</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const getBenefitCost = (benefitName: string) => {
                    const benefit = plan.benefits?.find((b: any) => 
                      b.name?.toLowerCase().includes(benefitName.toLowerCase())
                    );
                    if (!benefit) return null;
                    const costSharing = benefit.cost_sharings?.[0];
                    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                  };
                  const cost = getBenefitCost('Mental');
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-3 h-14 flex items-center justify-center">
                        <p className="text-sm text-center">{cost || '$50'}</p>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Generic drugs */}
                <div className="flex items-center h-14 px-3 bg-muted/20 rounded-md">
                  <p className="font-medium text-sm">Generic Drugs</p>
                </div>
                {selectedPlansData.map((plan: any) => {
                  const getBenefitCost = (benefitName: string) => {
                    const benefit = plan.benefits?.find((b: any) => 
                      b.name?.toLowerCase().includes(benefitName.toLowerCase())
                    );
                    if (!benefit) return null;
                    const costSharing = benefit.cost_sharings?.[0];
                    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                  };
                  const cost = getBenefitCost('Generic Drugs');
                  return (
                    <Card key={plan.id}>
                      <CardContent className="p-3 h-14 flex items-center justify-center">
                        <p className="text-sm text-center">{cost || '$25'}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-muted/10 flex justify-end">
            <Button variant="outline" onClick={() => setIsComparisonOpen(false)} data-testid="button-close-comparison">
              Close Comparison
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}