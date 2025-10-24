import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Users,
  DollarSign,
  FileText,
  Loader2,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

interface PlanDetails {
  id: string;
  name: string;
  issuer: {
    name: string;
    id: string;
  };
  premium: number;
  premium_w_credit?: number;
  metal_level: string;
  plan_type: string;
  deductibles: Array<{
    amount: number;
    type: string;
  }>;
  moops: Array<{
    amount: number;
    type: string;
  }>;
  benefits?: Array<{
    name: string;
    cost_sharings: Array<{
      display_string: string;
    }>;
  }>;
  quality_rating?: {
    global_rating?: number;
  };
}

// Company logo placeholder component
const CompanyLogo = ({ name }: { name: string }) => {
  const getInitials = (companyName: string) => {
    const words = companyName.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return companyName.substring(0, 2).toUpperCase();
  };

  const getCompanyColor = (companyName: string) => {
    const lowerName = companyName.toLowerCase();
    if (lowerName.includes('aetna')) return 'bg-purple-600';
    if (lowerName.includes('united')) return 'bg-blue-600';
    if (lowerName.includes('cigna')) return 'bg-orange-600';
    if (lowerName.includes('blue') || lowerName.includes('bcbs')) return 'bg-blue-700';
    if (lowerName.includes('oscar')) return 'bg-green-600';
    if (lowerName.includes('ambetter')) return 'bg-teal-600';
    if (lowerName.includes('humana')) return 'bg-green-700';
    if (lowerName.includes('kaiser')) return 'bg-indigo-600';
    return 'bg-gray-600';
  };

  return (
    <div className={`w-16 h-16 rounded-lg ${getCompanyColor(name)} text-white flex items-center justify-center font-bold text-lg`}>
      {getInitials(name)}
    </div>
  );
};

// Star rating component
const StarRating = ({ rating }: { rating?: number }) => {
  const stars = rating || 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= stars
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
      {rating && <span className="ml-1 text-sm text-muted-foreground">({rating.toFixed(1)})</span>}
    </div>
  );
};

export default function MarketplacePlansPage() {
  const [, params] = useRoute("/quotes/:id/marketplace-plans");
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const quoteId = params?.id;

  // Filter states
  const [metalLevels, setMetalLevels] = useState<string[]>([]);
  const [planTypes, setPlanTypes] = useState<string[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [stateSubsidies, setStateSubsidies] = useState(false);
  const [enrollmentDate, setEnrollmentDate] = useState<string>("");
  const [networkTypes, setNetworkTypes] = useState<string[]>([]);

  // Marketplace plans state
  const [marketplacePlans, setMarketplacePlans] = useState<any>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Fetch quote details
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/quotes/${quoteId}/detail`],
    enabled: !!quoteId,
  });

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
      setMarketplacePlans(data);
      
      toast({
        title: "Planes cargados exitosamente",
        description: `${data.plans?.length || 0} planes de seguro de salud disponibles`,
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

  const formatDateForDisplay = (date: string, format: string = "MM/dd/yyyy") => {
    if (!date) return "-";
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(date));
    } catch {
      return date;
    }
  };

  const getMetalLevelBadgeClass = (metalLevel: string) => {
    const level = metalLevel?.toLowerCase();
    if (level?.includes('bronze')) return 'bg-amber-700 text-white';
    if (level?.includes('silver')) return 'bg-gray-400 text-white';
    if (level?.includes('gold')) return 'bg-yellow-500 text-black';
    if (level?.includes('platinum')) return 'bg-purple-500 text-white';
    if (level?.includes('catastrophic')) return 'bg-red-600 text-white';
    return 'bg-blue-500 text-white';
  };

  // Filter plans
  const filteredPlans = marketplacePlans?.plans?.filter((plan: any) => {
    if (metalLevels.length > 0) {
      const planMetalLevel = plan.metal_level?.toLowerCase();
      const hasMatchingLevel = metalLevels.some(level => 
        planMetalLevel?.includes(level.toLowerCase())
      );
      if (!hasMatchingLevel) return false;
    }
    
    if (planTypes.length > 0 && !planTypes.includes(plan.plan_type)) {
      return false;
    }
    
    if (selectedCompanies.length > 0 && !selectedCompanies.includes(plan.issuer?.name)) {
      return false;
    }
    
    return true;
  }) || [];

  // Get unique companies from plans
  const uniqueCompanies = Array.from(
    new Set(marketplacePlans?.plans?.map((plan: any) => plan.issuer?.name) || [])
  ).sort();

  // Loading state
  if (isLoadingQuote || isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">
            {isLoadingQuote ? "Cargando detalles..." : "Obteniendo planes del marketplace..."}
          </p>
        </div>
      </div>
    );
  }

  const quote = (quoteData as any)?.quote;
  const members = (quoteData as any)?.quote?.members || [];
  const totalApplicants = members.filter((m: any) => m.isApplicant).length + (quote?.clientIsApplicant ? 1 : 0);
  const householdSize = 1 + members.length;
  
  // Get agent data - adjust this based on your actual data structure
  const agent = (quoteData as any)?.agent;
  const product = { name: "Healthcare.gov" }; // Default product name
  
  const totalHouseholdIncome = quote?.householdIncome || 0;
  const formattedIncome = totalHouseholdIncome > 0 
    ? formatCurrency(totalHouseholdIncome)
    : '-';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-screen">
        {/* Left Sidebar - 300px width */}
        <div className="w-[300px] border-r bg-background flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Back button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/quotes/${quoteId}`)}
                data-testid="button-back-to-quote"
                className="mb-4"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Volver al Quote
              </Button>

              {/* Summary Card - From quotes.tsx structure */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Resumen</h2>
                
                <div className="space-y-3">
                  <div className="pb-3 border-b">
                    <label className="text-xs text-muted-foreground">Agente</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={agent?.avatar || undefined} />
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                          {agent?.firstName?.[0] || 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{agent?.firstName || 'Unknown'} {agent?.lastName || ''}</span>
                    </div>
                  </div>

                  <div className="pb-3 border-b">
                    <label className="text-xs text-muted-foreground">Transportista</label>
                    <p className="text-sm font-medium">{product?.name || quote?.productType}</p>
                  </div>

                  <div className="pb-3 border-b">
                    <label className="text-xs text-muted-foreground">Fecha efectiva</label>
                    <p className="text-sm">{formatDateForDisplay(quote?.effectiveDate)}</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Última actualización</label>
                    <p className="text-sm text-muted-foreground">
                      {quote?.updatedAt ? format(new Date(quote.updatedAt), "MMM dd, yyyy h:mm a") : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Household Information */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-semibold">Información del hogar</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Titular</span>
                    <span className="text-xs font-medium">
                      {quote?.clientFirstName} {quote?.clientLastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Fecha de nacimiento</span>
                    <span className="text-xs">{quote?.clientDateOfBirth ? formatDateForDisplay(quote.clientDateOfBirth) : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Teléfono</span>
                    <span className="text-xs">{quote?.clientPhone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Ubicación</span>
                    <span className="text-xs">{quote?.city}, {quote?.state} {quote?.zipCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Ingreso anual total</span>
                    <span className="text-xs font-semibold">{formattedIncome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">ID de miembro</span>
                    <span className="text-xs">-</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Filters Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-3">
                    Resultados del plan ({filteredPlans.length})
                  </h3>
                </div>

                {/* Effective Date */}
                <div>
                  <Label htmlFor="effective-date" className="text-xs">Fecha de efectividad</Label>
                  <Select value={effectiveDate} onValueChange={setEffectiveDate}>
                    <SelectTrigger id="effective-date" className="w-full h-8 text-xs">
                      <SelectValue placeholder={formatDateForDisplay(quote?.effectiveDate)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={quote?.effectiveDate}>{formatDateForDisplay(quote?.effectiveDate)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* State Subsidies */}
                <div className="space-y-2">
                  <Label className="text-xs">Subsidios del estado</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="state-subsidies"
                      checked={stateSubsidies}
                      onCheckedChange={(checked) => setStateSubsidies(checked as boolean)}
                    />
                    <label
                      htmlFor="state-subsidies"
                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Incluir subsidios estatales
                    </label>
                  </div>
                </div>

                {/* Plan Type */}
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de plan</Label>
                  <div className="space-y-2">
                    {['HMO', 'EPO', 'PPO', 'POS'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`plan-type-${type}`}
                          checked={planTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPlanTypes([...planTypes, type]);
                            } else {
                              setPlanTypes(planTypes.filter(t => t !== type));
                            }
                          }}
                        />
                        <label
                          htmlFor={`plan-type-${type}`}
                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {type}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metal Levels */}
                <div className="space-y-2">
                  <Label className="text-xs">Niveles de metal</Label>
                  <div className="space-y-2">
                    {['Bronze', 'Silver', 'Gold', 'Platinum'].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`metal-${level}`}
                          checked={metalLevels.includes(level)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setMetalLevels([...metalLevels, level]);
                            } else {
                              setMetalLevels(metalLevels.filter(l => l !== level));
                            }
                          }}
                        />
                        <label
                          htmlFor={`metal-${level}`}
                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {level}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Companies */}
                {uniqueCompanies.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Compañías</Label>
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {uniqueCompanies.map((company: unknown) => {
                          const companyName = String(company);
                          return (
                            <div key={companyName} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`company-${companyName}`}
                                checked={selectedCompanies.includes(companyName)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCompanies([...selectedCompanies, companyName]);
                                  } else {
                                    setSelectedCompanies(selectedCompanies.filter(c => c !== companyName));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`company-${companyName}`}
                                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                                title={companyName}
                              >
                                {companyName}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* More Options */}
                <Collapsible open={showMoreFilters} onOpenChange={setShowMoreFilters}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium hover:text-primary transition-colors">
                    {showMoreFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Más opciones
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-3">
                    <div>
                      <Label htmlFor="enrollment-date" className="text-xs">Fecha de inscripción preferida</Label>
                      <input
                        type="date"
                        id="enrollment-date"
                        value={enrollmentDate}
                        onChange={(e) => setEnrollmentDate(e.target.value)}
                        className="w-full h-8 px-2 text-xs border rounded"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Red médica</Label>
                      <div className="space-y-2">
                        {['Nacional', 'Regional', 'Local'].map((network) => (
                          <div key={network} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`network-${network}`}
                              checked={networkTypes.includes(network)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNetworkTypes([...networkTypes, network]);
                                } else {
                                  setNetworkTypes(networkTypes.filter(n => n !== network));
                                }
                              }}
                            />
                            <label
                              htmlFor={`network-${network}`}
                              className="text-xs font-medium leading-none"
                            >
                              {network}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Clear Filters Button */}
                {(metalLevels.length > 0 || planTypes.length > 0 || selectedCompanies.length > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMetalLevels([]);
                      setPlanTypes([]);
                      setSelectedCompanies([]);
                      setNetworkTypes([]);
                      setStateSubsidies(false);
                      setEnrollmentDate("");
                    }}
                    className="w-full"
                    data-testid="button-clear-filters"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Header with Household Info */}
            <Card className="mb-6 bg-white dark:bg-gray-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    {/* Household Size */}
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Tamaño del hogar</div>
                        <div className="text-2xl font-bold">{householdSize}</div>
                      </div>
                    </div>

                    {/* Annual Income */}
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Ingreso anual</div>
                        <div className="text-2xl font-bold">{formattedIncome}</div>
                      </div>
                    </div>

                    {/* Tax Credit */}
                    {marketplacePlans?.household_aptc && (
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                          <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Crédito fiscal mensual</div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(marketplacePlans.household_aptc)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">
                      {filteredPlans.length} planes disponibles
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      Año {marketplacePlans?.year || new Date().getFullYear()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plans Grid */}
            <div className="space-y-4">
              {filteredPlans.length === 0 ? (
                <Card className="bg-white dark:bg-gray-800">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No se encontraron planes</p>
                    <p className="text-sm text-muted-foreground">
                      Intenta ajustar los filtros para ver más resultados
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredPlans.map((plan: PlanDetails) => {
                  const deductible = plan.deductibles?.[0]?.amount || 0;
                  const maxOutOfPocket = plan.moops?.[0]?.amount || 0;
                  const primaryCareVisit = plan.benefits?.find(b => 
                    b.name?.toLowerCase().includes('primary') || 
                    b.name?.toLowerCase().includes('doctor')
                  )?.cost_sharings?.[0]?.display_string || 'Ver detalles';
                  
                  const premiumWithoutCredit = plan.premium || 0;
                  const taxCredit = marketplacePlans?.household_aptc || 0;
                  const premiumWithCredit = Math.max(0, premiumWithoutCredit - taxCredit);

                  return (
                    <Card key={plan.id} className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-6">
                          {/* Company Logo */}
                          <CompanyLogo name={plan.issuer?.name || 'Unknown'} />

                          {/* Plan Details */}
                          <div className="flex-1">
                            {/* Plan Name and Rating */}
                            <div className="mb-3">
                              <div className="flex items-center gap-4 mb-2">
                                <h3 className="text-lg font-semibold">{plan.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {plan.plan_type}
                                </Badge>
                                <Badge className={getMetalLevelBadgeClass(plan.metal_level)}>
                                  {plan.metal_level}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4">
                                <StarRating rating={plan.quality_rating?.global_rating} />
                                <span className="text-sm text-muted-foreground">{plan.issuer?.name}</span>
                              </div>
                            </div>

                            {/* Plan Benefits Grid */}
                            <div className="grid grid-cols-3 gap-6 py-4 border-t border-b">
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Deducible</div>
                                <div className="text-lg font-semibold">{formatCurrency(deductible)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Máximo de bolsillo</div>
                                <div className="text-lg font-semibold">{formatCurrency(maxOutOfPocket)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground mb-1">Visita de atención primaria</div>
                                <div className="text-sm font-medium">{primaryCareVisit}</div>
                              </div>
                            </div>

                            {/* Plan Links */}
                            <div className="flex items-center gap-4 mt-3 text-sm">
                              <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
                                Resumen del plan
                              </button>
                              <span className="text-gray-300">|</span>
                              <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
                                Detalles
                              </button>
                              <span className="text-gray-300">|</span>
                              <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
                                Red de proveedores
                              </button>
                            </div>
                          </div>

                          {/* Pricing Section */}
                          <div className="text-right min-w-[200px]">
                            {taxCredit > 0 && (
                              <div className="mb-2">
                                <div className="text-xs text-muted-foreground line-through">
                                  {formatCurrency(premiumWithoutCredit)}/mes
                                </div>
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  Sin crédito fiscal
                                </div>
                              </div>
                            )}
                            <div className="mb-4">
                              <div className="text-3xl font-bold text-primary">
                                {formatCurrency(premiumWithCredit)}
                              </div>
                              <div className="text-sm text-muted-foreground">/mes</div>
                              {taxCredit > 0 && (
                                <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                  Con crédito fiscal
                                </div>
                              )}
                            </div>
                            <Button 
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                              data-testid={`button-apply-plan-${plan.id}`}
                            >
                              Aplicar al plan
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}