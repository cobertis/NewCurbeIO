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
  ChevronDown,
  Database,
  FileText,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
      // Según documentación: Máximo permitido por la API es 100
      const limit = 100;
      let allPlans: any[] = [];
      let offset = 0;
      let totalPlansCount = 0;
      let hasMoreData = true;
      let marketplaceMetadata: any = null;
      let apiRequestData: any = null;
      
      console.log(`🔍 Iniciando búsqueda de planes para Quote: ${quoteId}`);

      // Fetch ALL plans as per documentation - NO LIMIT
      while (hasMoreData) {
        const currentPage = Math.floor(offset / limit) + 1;
        
        const response = await fetch(
          `/api/quotes/${quoteId}/marketplace-plans?page=${currentPage}&pageSize=${limit}`,
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
        
        // Primera iteración: guardar el total y metadata
        if (offset === 0) {
          totalPlansCount = data.total || 0;
          console.log(`📊 Total de planes disponibles: ${totalPlansCount || 'Unknown'}`);
          
          // Guardar los datos del request para mostrarlos al usuario
          apiRequestData = data.request_data || {
            household_income: (quoteData as any)?.quote?.householdIncome,
            people_count: totalApplicants,
            location: {
              zip: quote?.zipCode,
              state: quote?.state,
              county: quote?.county
            }
          };
          
          marketplaceMetadata = {
            year: data.year,
            household_aptc: data.household_aptc,
            household_csr: data.household_csr,
            household_slcsp_premium: data.household_slcsp_premium,
            household_lcbp_premium: data.household_lcbp_premium,
            request_data: apiRequestData,
          };
        }

        // Add plans from this page to the collection
        if (data.plans && data.plans.length > 0) {
          allPlans = allPlans.concat(data.plans);
          console.log(`✅ Página ${currentPage}: ${data.plans.length} planes obtenidos (Total acumulado: ${allPlans.length})`);
          
          // IMPORTANTE: La API puede devolver menos planes del límite solicitado
          // Continuar hasta obtener TODOS los planes disponibles
          if (totalPlansCount > 0 && allPlans.length >= totalPlansCount) {
            // Ya tenemos todos los planes
            hasMoreData = false;
            console.log(`✅ Búsqueda completa: obtenidos todos los ${totalPlansCount} planes`);
          } else if (data.plans.length === 0) {
            // No hay más planes
            hasMoreData = false;
            console.log(`✅ Búsqueda completa: no hay más planes disponibles`);
          } else {
            // Incrementar offset para la siguiente página
            offset += data.plans.length; // Usar el número real de planes devueltos
            console.log(`📋 Continuando búsqueda... (${allPlans.length}/${totalPlansCount} planes obtenidos)`);
          }
          
          // Pequeña pausa para no sobrecargar la API (según documentación)
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          // No hay más planes
          hasMoreData = false;
          console.log(`✅ Búsqueda completa: no hay más planes en página ${currentPage}`);
        }
      }

      // Combine all plans with metadata
      const combinedData = {
        ...marketplaceMetadata,
        plans: allPlans,
      };

      setMarketplacePlans(combinedData);
      setCurrentPage(1);
      
      const totalPlans = allPlans.length;
      
      console.log(`✅ Búsqueda completa: ${totalPlans} planes obtenidos en total`);
      
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

  const quote = (quoteData as any)?.quote;
  const totalApplicants = (quote?.members || []).filter((m: any) => m.isApplicant).length + (quote?.clientIsApplicant ? 1 : 0);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Combined Header & Summary Card */}
      {quote && (
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
            {/* Title Section */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
                <Shield className="h-6 w-6 text-primary" />
                Healthcare.gov Marketplace Plans
              </h1>
              <p className="text-muted-foreground">
                Quote #{quoteId} for {quote.clientFirstName} {quote.clientLastName}
              </p>
            </div>

            {/* Compact Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Location & Income */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase">Location</h4>
                <div className="text-sm">
                  {quote.city}, {quote.state} {quote.zipCode}
                  {quote.county && (
                    <div className="text-xs text-muted-foreground">{quote.county}</div>
                  )}
                </div>
                <div className="pt-2">
                  <div className="text-xs text-muted-foreground">Household Income</div>
                  <div className="font-semibold">{formatCurrency((quoteData as any)?.quote?.householdIncome || 0)}/year</div>
                </div>
              </div>

              {/* Coverage Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase">Coverage</h4>
                <div className="text-sm space-y-1">
                  <div>Effective: {new Date(quote.effectiveDate).toLocaleDateString()}</div>
                  <div>Members: {((quoteData as any)?.quote?.members?.filter((m: any) => m.isApplicant).length || 0) + (quote.clientIsApplicant !== false ? 1 : 0)}</div>
                </div>
              </div>

              {/* APTC Info */}
              {marketplacePlans && (
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase">Premium Tax Credit (APTC)</h4>
                  {marketplacePlans.household_aptc > 0 ? (
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 border border-green-200 dark:border-green-800">
                      <div className="text-xl font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(marketplacePlans.household_aptc)}/month
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-500 mt-1">
                        Annual Savings: <span className="font-semibold">{formatCurrency(marketplacePlans.household_aptc * 12)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        This tax credit reduces your monthly insurance premium
                      </div>
                      {marketplacePlans.household_csr && (
                        <div className="text-xs text-muted-foreground mt-1">
                          CSR Level: {marketplacePlans.household_csr}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="text-sm font-medium">Not Eligible for Tax Credit</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Based on household income and size
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Plans Info */}
              {marketplacePlans && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase">Results</h4>
                  <div className="text-sm space-y-1">
                    <div className="font-bold text-lg">{marketplacePlans.plans?.length || 0} Plans Available</div>
                    <div className="text-xs text-muted-foreground">Year {marketplacePlans.year}</div>
                  </div>
                </div>
              )}
            </div>

            {/* API Request Data - Collapsible Section */}
            {marketplacePlans?.request_data && (
              <>
                <Separator className="my-4" />
                <Collapsible className="space-y-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                    <Database className="h-4 w-4" />
                    View Data Sent to CMS Healthcare.gov API
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 bg-muted/30 rounded-lg space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-semibold mb-1">Household Income</div>
                          <div className="font-mono text-xs p-2 bg-background rounded">
                            {formatCurrency(marketplacePlans.request_data.household_income)}/year
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold mb-1">Location</div>
                          <div className="font-mono text-xs p-2 bg-background rounded space-y-1">
                            <div>ZIP: {marketplacePlans.request_data.location?.zip}</div>
                            <div>State: {marketplacePlans.request_data.location?.state}</div>
                            <div>County: {marketplacePlans.request_data.location?.county}</div>
                            <div>County FIPS: {marketplacePlans.request_data.location?.county_fips}</div>
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold mb-1">People ({marketplacePlans.request_data.people?.length || 0} members)</div>
                          <div className="font-mono text-xs p-2 bg-background rounded space-y-1">
                            {marketplacePlans.request_data.people?.map((person: any, idx: number) => (
                              <div key={idx} className="pb-1 border-b border-border last:border-0">
                                <div>Age: {person.age}, {person.gender}</div>
                                <div>Tobacco: {person.tobacco ? 'Yes' : 'No'}</div>
                                {person.pregnant && <div>Pregnant: Yes</div>}
                                <div className="text-green-600 dark:text-green-400">APTC Eligible: {person.aptc_eligible ? 'Yes' : 'No'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold mb-1">API Parameters</div>
                          <div className="font-mono text-xs p-2 bg-background rounded space-y-1">
                            <div>Year: {marketplacePlans.request_data.year}</div>
                            <div>Limit per page: {marketplacePlans.request_data.limit}</div>
                            <div className="text-green-600 dark:text-green-400">
                              APTC Calculation: {marketplacePlans.household_aptc > 0 ? 'Eligible' : 'Not Eligible'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Members List - Compact */}
            {(quoteData as any)?.quote?.members && (quoteData as any)?.quote?.members.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase">Household Members</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {/* Primary Applicant */}
                    <div className="p-2 bg-muted/30 rounded text-sm">
                      <div className="font-medium">{quote.clientFirstName} {quote.clientLastName} (Primary)</div>
                      <div className="text-xs text-muted-foreground">
                        Age {Math.floor((new Date().getTime() - new Date(quote.clientDateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}
                        {quote.clientTobaccoUser && ' • Tobacco'}
                        {quote.clientPregnant && ' • Pregnant'}
                      </div>
                    </div>
                    {/* Other Members */}
                    {(quoteData as any)?.quote?.members.map((member: any, index: number) => (
                      <div key={index} className="p-2 bg-muted/30 rounded text-sm">
                        <div className="font-medium">{member.firstName} {member.lastName} ({member.relationship})</div>
                        <div className="text-xs text-muted-foreground">
                          Age {Math.floor((new Date().getTime() - new Date(member.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}
                          {member.tobaccoUser && ' • Tobacco'}
                          {member.pregnant && ' • Pregnant'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

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
          {/* Top Pagination Controls */}
          {totalFilteredPlans > pageSize && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground font-medium">
                    Showing <span className="font-bold text-foreground">{Math.min(((currentPage - 1) * pageSize) + 1, totalFilteredPlans)}</span> - <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, totalFilteredPlans)}</span> of <span className="font-bold text-foreground">{totalFilteredPlans}</span> plans
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page-top"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-3 py-1 bg-background rounded-md border">
                      <span className="text-sm font-medium">
                        Page <span className="font-bold text-primary">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page-top"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                            After APTC Tax Credit
                          </p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(plan.premium_w_credit)}/mo
                          </p>
                          <div className="space-y-1 mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-600 dark:text-green-500">
                              Monthly Savings: <span className="font-semibold">{formatCurrency(plan.premium - plan.premium_w_credit)}</span>
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-500">
                              Annual Savings: <span className="font-semibold">{formatCurrency((plan.premium - plan.premium_w_credit) * 12)}</span>
                            </p>
                          </div>
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
          
          {/* Bottom Pagination Controls */}
          {totalFilteredPlans > pageSize && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground font-medium">
                    Showing <span className="font-bold text-foreground">{Math.min(((currentPage - 1) * pageSize) + 1, totalFilteredPlans)}</span> - <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, totalFilteredPlans)}</span> of <span className="font-bold text-foreground">{totalFilteredPlans}</span> plans
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page-bottom"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-3 py-1 bg-background rounded-md border">
                      <span className="text-sm font-medium">
                        Page <span className="font-bold text-primary">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page-bottom"
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