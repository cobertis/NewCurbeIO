import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [, params] = useRoute("/quotes/:id/marketplace-plans");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;

  // Filter states
  const [metalLevelFilter, setMetalLevelFilter] = useState<string>("all");
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all");
  const [maxPremium, setMaxPremium] = useState<string>("");
  const [maxDeductible, setMaxDeductible] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("premium_asc");
  
  // New comprehensive filters
  const [selectedCarriers, setSelectedCarriers] = useState<Set<string>>(new Set());
  const [selectedMetals, setSelectedMetals] = useState<Set<string>>(new Set());
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
  const [selectedPlanFeatures, setSelectedPlanFeatures] = useState<Set<string>>(new Set());
  const [selectedDiseasePrograms, setSelectedDiseasePrograms] = useState<Set<string>>(new Set());

  // Fetch quote details
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/quotes/${quoteId}/detail`],
    enabled: !!quoteId,
  });

  // CRITICAL FIX: Load REAL family members from quote_members table (same as quotes.tsx)
  const { data: membersDetailsData } = useQuery<{ members: any[] }>({
    queryKey: ['/api/quotes', quoteId, 'members'],
    enabled: !!quoteId,
  });

  // State for marketplace plans and pagination
  const [marketplacePlans, setMarketplacePlans] = useState<any>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(200); // Mostrar TODOS los planes en una página

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
      console.log(`🚀 Cargando TODOS los planes para Quote: ${quoteId}`);

      // Fetch ALL plans in one optimized call - backend handles parallel fetching
      const response = await fetch(
        `/api/quotes/${quoteId}/marketplace-plans?page=1&pageSize=1000`,
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
      
      // Backend now returns ALL plans at once
      const totalPlansCount = data.total || data.plans?.length || 0;
      console.log(`📊 Total de planes disponibles: ${totalPlansCount}`);
      
      // Prepare metadata with all information
      const apiRequestData = data.request_data || {
        household_income: (quoteData as any)?.quote?.householdIncome,
        people_count: totalApplicants,
        location: {
          zip: quote?.zipCode,
          state: quote?.state,
          county: quote?.county
        }
      };
      
      const marketplaceMetadata = {
        year: data.year,
        household_aptc: data.household_aptc,
        household_csr: data.household_csr,
        household_slcsp_premium: data.household_slcsp_premium,
        household_lcbp_premium: data.household_lcbp_premium,
        request_data: apiRequestData,
      };

      // Set all plans at once
      const combinedData = {
        ...marketplaceMetadata,
        plans: data.plans || [],
      };

      setMarketplacePlans(combinedData);
      setCurrentPage(1);
      
      const totalPlans = data.plans?.length || 0;
      
      console.log(`✅ ${totalPlans} planes cargados exitosamente en una sola llamada rápida!`);
      
      toast({
        title: "Planes cargados exitosamente",
        description: `${totalPlans} planes de seguro de salud disponibles`,
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

  // Extract unique carriers with counts
  const carrierCounts = marketplacePlans?.plans?.reduce((acc: Record<string, number>, plan: any) => {
    const carrierName = plan.issuer?.name || 'Unknown';
    acc[carrierName] = (acc[carrierName] || 0) + 1;
    return acc;
  }, {}) || {};
  
  const carriers: Array<{ name: string; count: number }> = Object.entries(carrierCounts)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Filter and sort all plans
  const allFilteredPlans = marketplacePlans?.plans?.filter((plan: any) => {
    // Legacy filters (for backwards compatibility)
    if (metalLevelFilter !== "all" && !plan.metal_level?.toLowerCase().includes(metalLevelFilter)) {
      return false;
    }
    if (planTypeFilter !== "all" && plan.type !== planTypeFilter) {
      return false;
    }
    
    // Premium filter
    if (maxPremium && plan.premium > parseFloat(maxPremium)) {
      return false;
    }
    
    // Deductible filter
    if (maxDeductible) {
      const mainDeductible = plan.deductibles?.find((d: any) => 
        d.type?.toLowerCase().includes('individual') || 
        d.type?.toLowerCase().includes('medical')
      );
      if (mainDeductible && mainDeductible.amount > parseFloat(maxDeductible)) {
        return false;
      }
    }
    
    // Carrier filter
    if (selectedCarriers.size > 0) {
      const carrierName = plan.issuer?.name || 'Unknown';
      if (!selectedCarriers.has(carrierName)) {
        return false;
      }
    }
    
    // Metal level filter (checkbox)
    if (selectedMetals.size > 0) {
      const metalLevel = plan.metal_level?.toLowerCase();
      const hasMatch = Array.from(selectedMetals).some(m => metalLevel?.includes(m.toLowerCase()));
      if (!hasMatch) {
        return false;
      }
    }
    
    // Network filter (checkbox)
    if (selectedNetworks.size > 0) {
      if (!selectedNetworks.has(plan.type)) {
        return false;
      }
    }
    
    // Plan features filter - show ONLY plans that have ALL selected features
    if (selectedPlanFeatures.size > 0) {
      // Check dental child coverage
      if (selectedPlanFeatures.has('dental_child')) {
        if (!plan.has_dental_child_coverage) {
          return false;
        }
      }
      // Check dental adult coverage
      if (selectedPlanFeatures.has('dental_adult')) {
        if (!plan.has_dental_adult_coverage) {
          return false;
        }
      }
      // Check simple choice
      if (selectedPlanFeatures.has('simple_choice')) {
        if (!plan.simple_choice) {
          return false;
        }
      }
    }
    
    // Disease programs filter
    if (selectedDiseasePrograms.size > 0) {
      const planPrograms = plan.disease_mgmt_programs || [];
      const hasMatch = Array.from(selectedDiseasePrograms).some(program => 
        planPrograms.some((p: string) => p.toLowerCase().includes(program.toLowerCase()))
      );
      if (!hasMatch) {
        return false;
      }
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
      case "deductible_desc":
        return (b.deductibles?.[0]?.amount || 0) - (a.deductibles?.[0]?.amount || 0);
      case "out_of_pocket_asc":
        return (a.out_of_pocket_limit || 0) - (b.out_of_pocket_limit || 0);
      case "out_of_pocket_desc":
        return (b.out_of_pocket_limit || 0) - (a.out_of_pocket_limit || 0);
      case "total_cost_asc":
        const totalA = a.premium * 12 + (a.deductibles?.[0]?.amount || 0);
        const totalB = b.premium * 12 + (b.deductibles?.[0]?.amount || 0);
        return totalA - totalB;
      case "total_cost_desc":
        const totalDescA = a.premium * 12 + (a.deductibles?.[0]?.amount || 0);
        const totalDescB = b.premium * 12 + (b.deductibles?.[0]?.amount || 0);
        return totalDescB - totalDescA;
      case "rating_asc":
        return (a.quality_rating?.global_rating || 0) - (b.quality_rating?.global_rating || 0);
      case "rating_desc":
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
  
  // PERMANENT FIX: Show ALL family members from quote_members table (exclude only 'client')
  // This matches the EXACT same logic as quotes.tsx - loads REAL data from BD
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
    <div className="p-4 sm:p-6">
      {/* Back button */}
      {quote && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/quotes/${quoteId}`)}
          data-testid="button-back-to-quote"
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Quote
        </Button>
      )}

      {/* 3-column layout: Household Info | Plans | Filters */}
      {quote && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-4 sm:gap-6">
          {/* Left Sidebar: Household Information */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <h3 className="font-semibold text-sm">Household information</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Annual income and Address row */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Annual income</p>
                    <button
                      className="font-medium flex items-center gap-1 hover:underline"
                      onClick={() => setLocation(`/quotes/${quoteId}`)}
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
                    <p className="text-sm">‣ {quote.physical_county || 'N/A'}</p>
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
          </div>

          {/* Center: Plans List */}
          <div className="space-y-4">
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
              {/* Compact pagination header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
                <div className="flex items-center gap-3">
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
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    Total plan ({totalFilteredPlans})
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
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
              </div>

              {filteredPlans.map((plan: any, index: number) => {
                // Extract all deductible info
                const individualDeductible = plan.deductibles?.find((d: any) => !d.family);
                const familyDeductible = plan.deductibles?.find((d: any) => d.family);
                const mainDeductible = individualDeductible || familyDeductible || plan.deductibles?.[0];
                
                // Extract MOOP (out-of-pocket max)
                const individualMoop = plan.moops?.find((m: any) => !m.family);
                const outOfPocketMax = individualMoop?.amount || plan.out_of_pocket_limit;
                
                // Extract benefits with cost sharing info
                const getBenefitCost = (benefitName: string) => {
                  const benefit = plan.benefits?.find((b: any) => 
                    b.name?.toLowerCase().includes(benefitName.toLowerCase())
                  );
                  if (!benefit) return null;
                  const costSharing = benefit.cost_sharings?.[0];
                  return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
                };

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
                          <span className="text-xs">
                            Dental Adult: <Badge variant="outline" className="text-xs inline-block ml-1">
                              {plan.has_dental_adult_coverage ? 'Yes' : 'No'}
                            </Badge>
                          </span>
                          <span className="text-xs">
                            Dental Child: <Badge variant="outline" className="text-xs inline-block ml-1">
                              {plan.has_dental_child_coverage ? 'Yes' : 'No'}
                            </Badge>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Grid */}
                  <div className="p-6">
                    {/* Plan Name */}
                    <h4 className="text-base font-medium mb-4 text-primary">{plan.name}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_1fr] gap-6 mb-6">
                      {/* Left: Prima mensual */}
                      <div>
                        <p className="text-sm font-semibold mb-2">Premium</p>
                        <p className="text-4xl font-bold mb-1">
                          {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null 
                            ? formatCurrency(plan.premium_w_credit)
                            : formatCurrency(plan.premium)}
                        </p>
                        {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null && plan.premium > plan.premium_w_credit && (
                          <>
                            <p className="text-xs text-green-600 dark:text-green-500">
                              Savings total {formatCurrency(plan.premium - plan.premium_w_credit)}
                            </p>
                            <p className="text-xs text-muted-foreground line-through">
                              Plan was {formatCurrency(plan.premium)}
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
                      <input type="checkbox" id={`compare-${plan.id}`} className="h-4 w-4" />
                      <label htmlFor={`compare-${plan.id}`} className="text-sm cursor-pointer">
                        Comparar
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="text-sm text-primary hover:underline">
                        Medicamentos
                      </button>
                      <button className="text-sm text-primary hover:underline">
                        Doctores
                      </button>
                      <button className="text-sm text-primary hover:underline">
                        Beneficios
                      </button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        data-testid={`button-view-details-${index}`}
                      >
                        Detalles del plan
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm"
                        data-testid={`button-select-plan-${index}`}
                      >
                        Agregar al carrito
                      </Button>
                    </div>
                  </div>
                </Card>
              );
              })}

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
            </div>
          )}
          </div>

          {/* Right Sidebar: APTC + Filters */}
          <div className="space-y-4">
            {/* APTC Tax Credit Section - Llamativo */}
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

            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <Button variant="default" className="w-full" data-testid="button-filter-plans">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter plans
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Monthly premium max */}
                <div>
                  <Label htmlFor="monthly-premium-max" className="text-sm font-medium">Monthly premium max</Label>
                  <Input
                    id="monthly-premium-max"
                    type="number"
                    placeholder="2000"
                    value={maxPremium}
                    onChange={(e) => {
                      setMaxPremium(e.target.value);
                      setCurrentPage(1);
                    }}
                    data-testid="filter-monthly-premium-max"
                    className="mt-2"
                  />
                </div>

                {/* Deductible max */}
                <div>
                  <Label htmlFor="deductible-max" className="text-sm font-medium">Deductible max</Label>
                  <Input
                    id="deductible-max"
                    type="number"
                    placeholder="9200"
                    value={maxDeductible}
                    onChange={(e) => {
                      setMaxDeductible(e.target.value);
                      setCurrentPage(1);
                    }}
                    data-testid="filter-deductible-max"
                    className="mt-2"
                  />
                </div>

                {/* Carriers */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <Label className="text-sm font-medium cursor-pointer">Carriers</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
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
                          className="h-4 w-4"
                        />
                        <label
                          htmlFor={`carrier-${carrier.name}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {carrier.name} ({carrier.count})
                        </label>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                {/* Metal */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <Label className="text-sm font-medium cursor-pointer">Metal</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
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
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={`metal-${metal}`}
                            className="text-sm cursor-pointer flex-1"
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <Label className="text-sm font-medium cursor-pointer">Networks</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
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
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={`network-${network}`}
                            className="text-sm cursor-pointer flex-1"
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <Label className="text-sm font-medium cursor-pointer">Plan features</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
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
                        className="h-4 w-4"
                      />
                      <label htmlFor="feature-dental-child" className="text-sm cursor-pointer flex-1">
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
                        className="h-4 w-4"
                      />
                      <label htmlFor="feature-dental-adult" className="text-sm cursor-pointer flex-1">
                        Dental coverage Adult ({marketplacePlans?.plans?.filter((p: any) => p.has_dental_adult_coverage).length || 0})
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
                        className="h-4 w-4"
                      />
                      <label htmlFor="feature-simple-choice" className="text-sm cursor-pointer flex-1">
                        Simple choice ({marketplacePlans?.plans?.filter((p: any) => p.simple_choice).length || 0})
                      </label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Disease programs */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <Label className="text-sm font-medium cursor-pointer">Disease programs</Label>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
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
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={`disease-${program}`}
                            className="text-sm cursor-pointer flex-1"
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
                  selectedPlanFeatures.size > 0 || selectedDiseasePrograms.size > 0 || maxPremium || maxDeductible) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => {
                      setSelectedCarriers(new Set());
                      setSelectedMetals(new Set());
                      setSelectedNetworks(new Set());
                      setSelectedPlanFeatures(new Set());
                      setSelectedDiseasePrograms(new Set());
                      setMetalLevelFilter("all");
                      setPlanTypeFilter("all");
                      setMaxPremium("");
                      setMaxDeductible("");
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
    </div>
  );
}