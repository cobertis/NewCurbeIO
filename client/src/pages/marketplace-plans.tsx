import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  User,
  Phone,
  MapPin,
  Hash,
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

interface Quote {
  id: string;
  clientFirstName: string;
  clientMiddleName?: string;
  clientLastName: string;
  clientSecondLastName?: string;
  clientDateOfBirth?: string;
  clientPhone?: string;
  physical_city?: string;
  physical_state?: string;
  physical_postal_code?: string;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
  totalAnnualIncome?: string;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  role: string;
  isApplicant: boolean;
  income?: {
    totalAnnualIncome?: string;
  };
}

// Helper function to format date for display
const formatDateForDisplay = (dateString: string | Date | null, formatStr = "MM/dd/yyyy") => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, formatStr);
  } catch {
    return dateString.toString();
  }
};

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
    <div className={`w-14 h-14 rounded-md ${getCompanyColor(name)} text-white flex items-center justify-center font-bold text-sm`}>
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
          className={`h-3.5 w-3.5 ${
            star <= stars
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200'
          }`}
        />
      ))}
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
  const [companies, setCompanies] = useState<string[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Fetch quote details
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery<{ quote: Quote }>({
    queryKey: [`/api/quotes/${quoteId}/detail`],
    enabled: !!quoteId,
  });

  const quote = quoteData?.quote;

  // Fetch members to get accurate household size and income
  const { data: membersData } = useQuery<{ members: Member[] }>({
    queryKey: [`/api/quotes/${quoteId}/members`],
    enabled: !!quoteId,
  });

  const members = membersData?.members || [];

  // Fetch marketplace plans
  const { data: plansData, isLoading: isLoadingPlans } = useQuery<{
    plans: PlanDetails[];
    totalCount: number;
    taxCredit: number;
    householdInfo?: {
      income: number;
      people: Array<{ age: number }>;
    };
  }>({
    queryKey: [`/api/quotes/${quoteId}/marketplace-plans`],
    enabled: !!quoteId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 3,
    retryDelay: 1000,
  });

  const allPlans = plansData?.plans || [];
  const totalCount = plansData?.totalCount || 0;
  const taxCredit = plansData?.taxCredit || 0;
  const householdInfo = plansData?.householdInfo;

  // Get unique companies from plans
  const availableCompanies = useMemo(() => {
    const uniqueCompanies = new Set(allPlans.map(plan => plan.issuer.name));
    return Array.from(uniqueCompanies).sort();
  }, [allPlans]);

  // Filter plans based on selected filters
  const filteredPlans = useMemo(() => {
    return allPlans.filter(plan => {
      if (metalLevels.length > 0 && !metalLevels.includes(plan.metal_level)) return false;
      if (planTypes.length > 0 && !planTypes.includes(plan.plan_type)) return false;
      if (companies.length > 0 && !companies.includes(plan.issuer.name)) return false;
      return true;
    });
  }, [allPlans, metalLevels, planTypes, companies]);

  // Calculate actual household size (primary + spouse + dependents who are applicants)
  const householdSize = useMemo(() => {
    // Start with 1 for the primary applicant
    let size = 1;
    
    // Add members who are applicants
    const applicantMembers = members.filter(m => m.isApplicant);
    size += applicantMembers.length;
    
    // Use householdInfo if available as it's the source of truth from CMS
    if (householdInfo?.people?.length) {
      return householdInfo.people.length;
    }
    
    return size;
  }, [members, householdInfo]);

  // Calculate total annual income from all members
  const totalIncome = useMemo(() => {
    // Use householdInfo income if available (from CMS API)
    if (householdInfo?.income) {
      return householdInfo.income;
    }
    
    // Otherwise calculate from members
    let total = 0;
    
    // Add primary's income if available
    if (quote?.totalAnnualIncome) {
      total += parseFloat(quote.totalAnnualIncome) || 0;
    }
    
    // Add each member's income
    members.forEach(member => {
      if (member.income?.totalAnnualIncome) {
        total += parseFloat(member.income.totalAnnualIncome) || 0;
      }
    });
    
    return total || 24000; // Default to $24,000 if no income data
  }, [quote, members, householdInfo]);

  const formattedIncome = `$${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Loading state
  if (isLoadingQuote || isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading marketplace plans...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Quote not found</p>
            <Button 
              className="w-full mt-4"
              onClick={() => setLocation("/quotes")}
            >
              Back to Quotes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Panel - Fixed width */}
      <div className="w-[300px] border-r bg-white flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/quotes/${quoteId}`)}
              className="mb-2"
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Quote
            </Button>

            {/* Title */}
            <div>
              <h2 className="text-lg font-bold">Resultados del plan {totalCount}</h2>
            </div>

            {/* Summary Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Summary</h3>
              
              <div className="space-y-2">
                <div className="pb-2 border-b">
                  <label className="text-xs text-muted-foreground">Agent</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        JF
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">Jason Fonseca</span>
                  </div>
                </div>

                <div className="pb-2 border-b">
                  <label className="text-xs text-muted-foreground">Carrier</label>
                  <p className="text-sm font-medium">Health Insurance (ACA)</p>
                </div>

                <div className="pb-2 border-b">
                  <label className="text-xs text-muted-foreground">Effective date</label>
                  <p className="text-sm">{formatDateForDisplay(quote.effectiveDate)}</p>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Last update</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(quote.updatedAt || quote.createdAt), "MMM dd, yyyy h:mm a")}
                  </p>
                </div>
              </div>
            </div>

            {/* Household Information */}
            <div className="space-y-3 pt-3 border-t">
              <h3 className="text-sm font-semibold">Household Information</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Holder</span>
                  <span className="text-xs font-medium">
                    {quote.clientFirstName} {quote.clientMiddleName} {quote.clientLastName} {quote.clientSecondLastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Date of birth</span>
                  <span className="text-xs">{quote.clientDateOfBirth ? formatDateForDisplay(quote.clientDateOfBirth) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <span className="text-xs">{quote.clientPhone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Location</span>
                  <span className="text-xs">{quote.physical_city}, {quote.physical_state} {quote.physical_postal_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Total annual income</span>
                  <span className="text-xs font-semibold">{formattedIncome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Member ID</span>
                  <span className="text-xs">-</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Filters Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Filters</h3>

              {/* Effective Date */}
              <div className="space-y-2">
                <Label className="text-xs">Fecha de efectividad</Label>
                <Select defaultValue={quote.effectiveDate}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={quote.effectiveDate}>
                      {formatDateForDisplay(quote.effectiveDate)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* State Subsidies */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="subsidies" />
                  <label htmlFor="subsidies" className="text-xs font-medium">
                    Subsidios del estado
                  </label>
                </div>
              </div>

              {/* Plan Types */}
              <div className="space-y-2">
                <Label className="text-xs">Tipo de plan</Label>
                <div className="space-y-1">
                  {['HMO', 'EPO', 'PPO', 'POS'].map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox 
                        id={type}
                        checked={planTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setPlanTypes([...planTypes, type]);
                          } else {
                            setPlanTypes(planTypes.filter(t => t !== type));
                          }
                        }}
                      />
                      <label htmlFor={type} className="text-xs">
                        {type}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metal Levels */}
              <div className="space-y-2">
                <Label className="text-xs">Niveles de metal</Label>
                <div className="space-y-1">
                  {[
                    { value: 'Bronze', color: 'text-orange-700' },
                    { value: 'Silver', color: 'text-gray-500' },
                    { value: 'Gold', color: 'text-yellow-600' },
                    { value: 'Platinum', color: 'text-slate-700' }
                  ].map(level => (
                    <div key={level.value} className="flex items-center space-x-2">
                      <Checkbox 
                        id={level.value}
                        checked={metalLevels.includes(level.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setMetalLevels([...metalLevels, level.value]);
                          } else {
                            setMetalLevels(metalLevels.filter(l => l !== level.value));
                          }
                        }}
                      />
                      <label htmlFor={level.value} className={`text-xs ${level.color} font-medium`}>
                        {level.value}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Companies */}
              {availableCompanies.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Compañías</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {availableCompanies.map(company => (
                      <div key={company} className="flex items-center space-x-2">
                        <Checkbox 
                          id={company}
                          checked={companies.includes(company)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setCompanies([...companies, company]);
                            } else {
                              setCompanies(companies.filter(c => c !== company));
                            }
                          }}
                        />
                        <label htmlFor={company} className="text-xs truncate">
                          {company}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* More Options */}
              <Collapsible open={showMoreFilters} onOpenChange={setShowMoreFilters}>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-medium hover:text-primary">
                  <span>Más opciones</span>
                  {showMoreFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Fecha de inscripción preferida</Label>
                    <Select>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Inmediata</SelectItem>
                        <SelectItem value="next-month">Próximo mes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Red médica</Label>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="network-local" />
                        <label htmlFor="network-local" className="text-xs">Local</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="network-national" />
                        <label htmlFor="network-national" className="text-xs">Nacional</label>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Header with household info */}
          <Card className="mb-4 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Household Size</p>
                      <p className="text-lg font-bold">{householdSize}</p>
                    </div>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Annual Income</p>
                      <p className="text-lg font-bold">{formattedIncome}</p>
                    </div>
                  </div>
                  {taxCredit > 0 && (
                    <>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          Tax Credit
                        </Badge>
                        <div>
                          <p className="text-xs text-muted-foreground">Monthly Credit</p>
                          <p className="text-lg font-bold text-green-600">
                            ${taxCredit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Showing</p>
                  <p className="text-lg font-bold">{filteredPlans.length} plans</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plans List */}
          <div className="space-y-3">
            {filteredPlans.map((plan) => {
              const deductible = plan.deductibles?.find(d => d.type === 'Individual')?.amount || 0;
              const maxOutOfPocket = plan.moops?.find(m => m.type === 'Individual')?.amount || 0;
              const primaryCare = plan.benefits?.find(b => b.name === 'Primary Care Visit')?.cost_sharings?.[0]?.display_string || 'N/A';
              
              const getMetalBadgeColor = (level: string) => {
                switch(level?.toLowerCase()) {
                  case 'bronze': return 'bg-orange-100 text-orange-800 border-orange-200';
                  case 'silver': return 'bg-gray-100 text-gray-800 border-gray-200';
                  case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                  case 'platinum': return 'bg-slate-100 text-slate-800 border-slate-200';
                  default: return 'bg-gray-100 text-gray-800 border-gray-200';
                }
              };

              return (
                <Card key={plan.id} className="bg-white hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      {/* Company Logo */}
                      <div className="flex-shrink-0">
                        <CompanyLogo name={plan.issuer.name} />
                      </div>

                      {/* Plan Details */}
                      <div className="flex-1 space-y-3">
                        {/* Plan Name and Rating */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold line-clamp-1">
                              {plan.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <StarRating rating={plan.quality_rating?.global_rating} />
                              <Badge variant="outline" className="text-xs">
                                {plan.plan_type}
                              </Badge>
                              <Badge 
                                variant="outline" 
                                className={`text-xs border ${getMetalBadgeColor(plan.metal_level)}`}
                              >
                                {plan.metal_level}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Plan Benefits */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Deductible</p>
                            <p className="font-semibold">
                              {deductible === 0 ? '$0' : `$${deductible.toLocaleString()}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Max Out of Pocket</p>
                            <p className="font-semibold">${maxOutOfPocket.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Primary Care Visit</p>
                            <p className="font-semibold text-sm">{primaryCare}</p>
                          </div>
                        </div>

                        {/* Links */}
                        <div className="flex gap-3 text-xs">
                          <button className="text-primary hover:underline">Plan Summary</button>
                          <span className="text-muted-foreground">|</span>
                          <button className="text-primary hover:underline">Details</button>
                          <span className="text-muted-foreground">|</span>
                          <button className="text-primary hover:underline">Provider Network</button>
                        </div>
                      </div>

                      {/* Pricing and Action */}
                      <div className="flex-shrink-0 text-right space-y-2">
                        {taxCredit > 0 && plan.premium_w_credit !== undefined ? (
                          <div>
                            <p className="text-xs text-muted-foreground line-through">
                              ${plan.premium.toFixed(2)}/mo
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              ${plan.premium_w_credit.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">per month</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-2xl font-bold">
                              ${plan.premium.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">per month</p>
                          </div>
                        )}
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          data-testid={`button-apply-${plan.id}`}
                        >
                          Apply to plan
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* No results message */}
          {filteredPlans.length === 0 && (
            <Card className="bg-white">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No plans found matching your filters.</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    setMetalLevels([]);
                    setPlanTypes([]);
                    setCompanies([]);
                  }}
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}