import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

export default function MarketplacePlansPage() {
  const [, params] = useRoute("/quotes/:id/marketplace-plans");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;

  // Filter states
  const [metalLevelFilter, setMetalLevelFilter] = useState<string>("all");
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all");
  const [maxPremium, setMaxPremium] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("premium_asc");

  // Fetch quote details
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/quotes/${quoteId}/detail`],
    enabled: !!quoteId,
  });

  // State for marketplace plans and pagination
  const [marketplacePlans, setMarketplacePlans] = useState<any>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  // Auto-fetch marketplace plans when component mounts
  useEffect(() => {
    if (quoteId && !marketplacePlans && !isLoadingPlans) {
      fetchMarketplacePlans();
    }
  }, [quoteId]);

  const fetchMarketplacePlans = async () => {
    if (!quoteId) return;
    
    setIsLoadingPlans(true);
    try {
      const response = await fetch('/api/cms-marketplace/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ quoteId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch plans');
      }

      const data = await response.json();
      setMarketplacePlans(data);
      setCurrentPage(1);
      
      const totalPlans = data.plans?.length || 0;
      
      toast({
        title: "Plans loaded successfully",
        description: `Found ${totalPlans} available health insurance plans`,
      });
    } catch (error: any) {
      console.error('Error fetching marketplace plans:', error);
      toast({
        variant: "destructive",
        title: "Error fetching plans",
        description: error.message || "Failed to fetch marketplace plans",
      });
    } finally {
      setIsLoadingPlans(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  // Filter and sort all plans
  const allFilteredPlans = marketplacePlans?.plans?.filter((plan: any) => {
    if (metalLevelFilter !== "all" && !plan.metal_level?.toLowerCase().includes(metalLevelFilter)) {
      return false;
    }
    if (planTypeFilter !== "all" && plan.plan_type !== planTypeFilter) {
      return false;
    }
    if (maxPremium && plan.premium > parseFloat(maxPremium)) {
      return false;
    }
    return true;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case "premium_asc":
        return a.premium - b.premium;
      case "premium_desc":
        return b.premium - a.premium;
      case "deductible_asc":
        return (a.deductibles?.[0]?.amount || 0) - (b.deductibles?.[0]?.amount || 0);
      case "rating":
        return (b.quality_rating?.global_rating || 0) - (a.quality_rating?.global_rating || 0);
      default:
        return 0;
    }
  }) || [];

  // Calculate pagination for client-side
  const totalFilteredPlans = allFilteredPlans.length;
  const totalPages = Math.ceil(totalFilteredPlans / pageSize);
  
  // Get plans for current page
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const filteredPlans = allFilteredPlans.slice(startIndex, endIndex);

  // Loading state
  if (isLoadingQuote || isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            {isLoadingQuote ? "Loading quote details..." : "Fetching marketplace plans..."}
          </p>
        </div>
      </div>
    );
  }

  const quote = quoteData?.quote;
  const totalApplicants = (quote?.members || []).filter((m: any) => m.isApplicant).length + (quote?.clientIsApplicant ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/quotes/${quoteId}`)}
                data-testid="button-back-to-quote"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Quote
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
                <Shield className="h-6 w-6 text-primary" />
                Available Health Insurance Plans
              </h1>
              <p className="text-muted-foreground mb-4">
                Healthcare.gov Marketplace plans for {quote?.clientFirstName} {quote?.clientLastName}
              </p>
              {quote && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Quote #{quoteId}
                  </Badge>
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {totalApplicants} Applicants
                  </Badge>
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    Effective: {new Date(quote.effectiveDate).toLocaleDateString()}
                  </Badge>
                </div>
              )}
            </div>

            {marketplacePlans && (
              <div className="bg-muted/10 rounded-lg p-4 min-w-[250px]">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Plans</span>
                    <span className="font-semibold">{marketplacePlans.plans?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Coverage Year</span>
                    <span className="font-semibold">{marketplacePlans.year}</span>
                  </div>
                  {marketplacePlans.household_aptc !== undefined && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">APTC (Monthly Tax Credit)</span>
                        <span className="font-semibold text-green-600">
                          {marketplacePlans.household_aptc > 0 
                            ? formatCurrency(marketplacePlans.household_aptc) + '/mo'
                            : '$0/mo (Not Eligible)'}
                        </span>
                      </div>
                    </>
                  )}
                  {marketplacePlans.household_slcsp_premium !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">SLCSP Premium</span>
                      <span className="text-sm">{formatCurrency(marketplacePlans.household_slcsp_premium)}/mo</span>
                    </div>
                  )}
                  {marketplacePlans.household_lcbp_premium !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">LCBP Premium</span>
                      <span className="text-sm">{formatCurrency(marketplacePlans.household_lcbp_premium)}/mo</span>
                    </div>
                  )}
                  {marketplacePlans.household_csr && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">CSR Level</span>
                      <span className="text-sm">{marketplacePlans.household_csr}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="metal-level">Metal Level</Label>
              <Select value={metalLevelFilter} onValueChange={(value) => {
                setMetalLevelFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger id="metal-level" data-testid="filter-metal-level">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="bronze">Bronze</SelectItem>
                  <SelectItem value="silver">Silver</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                  <SelectItem value="catastrophic">Catastrophic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="plan-type">Plan Type</Label>
              <Select value={planTypeFilter} onValueChange={(value) => {
                setPlanTypeFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger id="plan-type" data-testid="filter-plan-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="HMO">HMO</SelectItem>
                  <SelectItem value="PPO">PPO</SelectItem>
                  <SelectItem value="EPO">EPO</SelectItem>
                  <SelectItem value="POS">POS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="max-premium">Max Monthly Premium</Label>
              <Input
                id="max-premium"
                type="number"
                placeholder="No limit"
                value={maxPremium}
                onChange={(e) => {
                  setMaxPremium(e.target.value);
                  setCurrentPage(1);
                }}
                data-testid="filter-max-premium"
              />
            </div>

            <div>
              <Label htmlFor="sort-by">Sort By</Label>
              <Select value={sortBy} onValueChange={(value) => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger id="sort-by" data-testid="filter-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium_asc">Premium: Low to High</SelectItem>
                  <SelectItem value="premium_desc">Premium: High to Low</SelectItem>
                  <SelectItem value="deductible_asc">Deductible: Low to High</SelectItem>
                  <SelectItem value="rating">Quality Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(metalLevelFilter !== "all" || planTypeFilter !== "all" || maxPremium) && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {totalFilteredPlans} of {marketplacePlans?.plans?.length || 0} plans
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMetalLevelFilter("all");
                  setPlanTypeFilter("all");
                  setMaxPremium("");
                  setCurrentPage(1);
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans List */}
      {!marketplacePlans && !isLoadingPlans && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No plans loaded</p>
            <p className="text-sm text-muted-foreground mb-4">
              Click the button below to fetch available health insurance plans
            </p>
            <Button onClick={fetchMarketplacePlans} data-testid="button-load-plans">
              Load Marketplace Plans
            </Button>
          </CardContent>
        </Card>
      )}

      {marketplacePlans && filteredPlans && (
        <div className="grid gap-4">
          {filteredPlans.map((plan: any, index: number) => (
            <Card key={plan.id || index} className="overflow-hidden hover-elevate">
              <div className="flex flex-col lg:flex-row">
                {/* Plan Info Section */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {plan.issuer?.name}
                        </span>
                        <Badge className={getMetalLevelColor(plan.metal_level)}>
                          {plan.metal_level}
                        </Badge>
                        {plan.plan_type && (
                          <Badge variant="outline">{plan.plan_type}</Badge>
                        )}
                      </div>
                    </div>
                    
                    {plan.quality_rating?.available && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Quality Rating</p>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < (plan.quality_rating.global_rating || 0)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-gray-200 text-gray-200'
                              }`}
                            />
                          ))}
                          <span className="text-sm font-medium ml-1">
                            {plan.quality_rating.global_rating}/5
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Key Features */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Heart className="h-3 w-3" />
                        Primary Care Visit
                      </p>
                      <p className="text-sm font-medium">
                        {plan.copay_primary ? formatCurrency(plan.copay_primary) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Activity className="h-3 w-3" />
                        Specialist Visit
                      </p>
                      <p className="text-sm font-medium">
                        {plan.copay_specialist ? formatCurrency(plan.copay_specialist) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <CreditCard className="h-3 w-3" />
                        Out of Pocket Max
                      </p>
                      <p className="text-sm font-medium">
                        {plan.out_of_pocket_limit ? formatCurrency(plan.out_of_pocket_limit) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Info className="h-3 w-3" />
                        HSA Eligible
                      </p>
                      <p className="text-sm font-medium">
                        {plan.hsa_eligible ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-gray-400" />
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Benefits */}
                  {plan.benefits && plan.benefits.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {plan.benefits.slice(0, 5).map((benefit: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {benefit.name || benefit}
                        </Badge>
                      ))}
                      {plan.benefits.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{plan.benefits.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Pricing Section */}
                <div className="bg-muted/30 p-6 lg:w-80 border-t lg:border-t-0 lg:border-l">
                  <div className="space-y-4">
                    {/* Monthly Premium */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Monthly Premium (Before APTC)</p>
                      <p className="text-3xl font-bold">{formatCurrency(plan.premium)}</p>
                      
                      {/* Show premium with credit if it exists, regardless of household_aptc value */}
                      {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null && (
                        <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-700 dark:text-green-400 mb-1 font-semibold">
                            After APTC (Tax Credit Applied)
                          </p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(plan.premium_w_credit)}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                            APTC Applied: {formatCurrency(plan.premium - plan.premium_w_credit)}/mo
                          </p>
                        </div>
                      )}
                      
                      {/* If no premium_w_credit but household has APTC, show message */}
                      {!plan.premium_w_credit && marketplacePlans.household_aptc > 0 && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            APTC not available for this plan
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Deductible */}
                    {plan.deductibles && plan.deductibles.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Annual Deductible</p>
                        {plan.deductibles.map((deductible: any, i: number) => (
                          <div key={i} className="text-lg font-semibold">
                            {deductible.family ? 'Family: ' : 'Individual: '}
                            {formatCurrency(deductible.amount)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-4 space-y-2">
                      <Button 
                        className="w-full" 
                        variant="default"
                        data-testid={`button-select-plan-${index}`}
                      >
                        Select This Plan
                      </Button>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        data-testid={`button-view-details-${index}`}
                      >
                        View Full Details
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {filteredPlans.length === 0 && (
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
          
          {/* Pagination Controls */}
          {totalFilteredPlans > pageSize && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min(((currentPage - 1) * pageSize) + 1, totalFilteredPlans)} - {Math.min(currentPage * pageSize, totalFilteredPlans)} of {totalFilteredPlans} plans
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        Page {currentPage} of {totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}