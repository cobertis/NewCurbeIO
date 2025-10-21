import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Users, MapPin, FileText, Check, Search, Info, Trash2, Heart, Building2, Shield, Eye, Smile, DollarSign, PiggyBank, Plane, Cross, Filter, RefreshCw, ChevronDown, ArrowLeft, Mail, CreditCard, Phone, Hash, IdCard, Home } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User as UserType, type Quote } from "@shared/schema";
import { useState, useEffect } from "react";
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format, startOfMonth, addMonths } from "date-fns";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";

// Format SSN with automatic dashes (XXX-XX-XXXX)
const formatSSN = (value: string) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Apply formatting based on length
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  }
};

// Format Phone Number with automatic formatting (XXX) XXX-XXXX
const formatPhoneNumber = (value: string) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Apply formatting based on length
  if (digits.length === 0) {
    return '';
  } else if (digits.length <= 3) {
    return `(${digits}`;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
};

// US States for dropdown
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

// Product types with descriptions
const PRODUCT_TYPES = [
  {
    id: "medicare",
    name: "Medicare",
    description: "Government health insurance for individuals 65+ or with certain disabilities",
    icon: Shield,
  },
  {
    id: "medicaid",
    name: "Medicaid",
    description: "State and federal program offering health coverage for low-income individuals and families",
    icon: Heart,
  },
  {
    id: "aca",
    name: "Health Insurance (ACA)",
    description: "Health insurance under the Affordable Care Act offering essential health benefits and subsidies",
    icon: Cross,
  },
  {
    id: "life",
    name: "Life Insurance",
    description: "Financial protection for your loved ones in the event of your passing",
    icon: Heart,
  },
  {
    id: "private",
    name: "Private",
    description: "Health plans offered outside of government programs, with customizable coverage options",
    icon: Building2,
  },
  {
    id: "dental",
    name: "Dental",
    description: "Coverage for preventive, basic, and major dental care services",
    icon: Smile,
  },
  {
    id: "vision",
    name: "Vision",
    description: "Insurance for eye exams, glasses, contact lenses, and more",
    icon: Eye,
  },
  {
    id: "supplemental",
    name: "Supplemental",
    description: "Additional insurance that pays benefits for specific events like accidents, critical illness, or hospital stays",
    icon: Plus,
  },
  {
    id: "annuities",
    name: "Annuities",
    description: "Financial products that provide guaranteed income, typically for retirement",
    icon: PiggyBank,
  },
  {
    id: "final_expense",
    name: "Final Expense",
    description: "Affordable life insurance to cover funeral and end-of-life costs",
    icon: DollarSign,
  },
  {
    id: "travel",
    name: "Travel",
    description: "Coverage for medical emergencies, trip cancellations, and travel-related issues",
    icon: Plane,
  },
];

// Helper function to get first day of next month
function getFirstDayOfNextMonth(): Date {
  return startOfMonth(addMonths(new Date(), 1));
}

// Form schema for each step
const step1Schema = z.object({
  effectiveDate: z.string(),
  agentId: z.string().optional(),
  productType: z.string().min(1, "Please select a product"),
});

const familyMemberSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  secondLastName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  ssn: z.string().min(1, "SSN is required"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().optional(),
  email: z.string().optional(),
  isApplicant: z.boolean().default(false),
  tobaccoUser: z.boolean().default(false),
});

const spouseSchema = familyMemberSchema;

const dependentSchema = familyMemberSchema.extend({
  relation: z.string().min(1, "Relation is required"),
});

const step2Schema = z.object({
  clientFirstName: z.string().min(1, "First name is required"),
  clientMiddleName: z.string().optional(),
  clientLastName: z.string().min(1, "Last name is required"),
  clientSecondLastName: z.string().optional(),
  clientEmail: z.string().email("Valid email is required"),
  clientPhone: z.string().min(1, "Phone number is required"),
  clientDateOfBirth: z.string().optional(),
  clientGender: z.string().optional(),
  clientIsApplicant: z.boolean().default(false),
  clientTobaccoUser: z.boolean().default(false),
  clientSsn: z.string().optional(),
  street: z.string().min(1, "Street address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  county: z.string().optional(),
  country: z.string().default("United States"),
});

const step3Schema = z.object({
  annualHouseholdIncome: z.string().optional(),
  familyGroupSize: z.string().optional(),
  spouses: z.array(spouseSchema).default([]),
  dependents: z.array(dependentSchema).default([]),
});

const completeQuoteSchema = step1Schema.merge(step2Schema).merge(step3Schema);

export default function QuotesPage() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/quotes/:id");
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Advanced filters state
  const [filters, setFilters] = useState({
    user: "",
    assignedTo: "",
    status: "all",
    state: "",
    zipCode: "",
    productType: "all",
    effectiveDateFrom: "",
    effectiveDateTo: "",
    submissionDateFrom: "",
    submissionDateTo: "",
    applicantsFrom: "",
    applicantsTo: "",
  });
  
  // Determine if we're in the wizard view based on URL
  const showWizard = location === "/quotes/new";

  // Fetch current user
  const { data: userData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });

  // Fetch agents for selection
  const { data: agentsData } = useQuery<{ users: UserType[] }>({
    queryKey: ["/api/users"],
  });

  // Fetch quotes
  const { data: quotesData, isLoading } = useQuery<{ quotes: Quote[] }>({
    queryKey: ["/api/quotes"],
  });

  const form = useForm({
    resolver: zodResolver(completeQuoteSchema),
    defaultValues: {
      effectiveDate: format(getFirstDayOfNextMonth(), "yyyy-MM-dd"),
      agentId: userData?.user?.id || "",
      productType: "",
      clientFirstName: "",
      clientMiddleName: "",
      clientLastName: "",
      clientSecondLastName: "",
      clientEmail: "",
      clientPhone: "",
      clientDateOfBirth: "",
      clientGender: "",
      clientIsApplicant: true,
      clientTobaccoUser: false,
      clientSsn: "",
      annualHouseholdIncome: "",
      familyGroupSize: "",
      spouses: [],
      dependents: [],
      street: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      county: "",
      country: "United States",
    },
  });

  // Set agentId when user data loads
  useEffect(() => {
    if (userData?.user?.id) {
      form.setValue("agentId", userData.user.id);
    }
  }, [userData?.user?.id, form]);

  const { fields: spouseFields, append: appendSpouse, remove: removeSpouse } = useFieldArray({
    control: form.control,
    name: "spouses",
  });

  const { fields: dependentFields, append: appendDependent, remove: removeDependent } = useFieldArray({
    control: form.control,
    name: "dependents",
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/quotes", {
        ...data,
        effectiveDate: new Date(data.effectiveDate),
        clientDateOfBirth: data.clientDateOfBirth ? new Date(data.clientDateOfBirth) : undefined,
        familyGroupSize: data.familyGroupSize ? parseInt(data.familyGroupSize, 10) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Quote created",
        description: "Your quote has been created successfully.",
      });
      setLocation("/quotes");
      form.reset({
        effectiveDate: format(getFirstDayOfNextMonth(), "yyyy-MM-dd"),
        agentId: userData?.user?.id || "",
        productType: "",
        clientFirstName: "",
        clientMiddleName: "",
        clientLastName: "",
        clientSecondLastName: "",
        clientEmail: "",
        clientPhone: "",
        clientDateOfBirth: "",
        clientGender: "",
        clientIsApplicant: true,
        clientTobaccoUser: false,
        clientSsn: "",
        annualHouseholdIncome: "",
        familyGroupSize: "",
        spouses: [],
        dependents: [],
        street: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        county: "",
        country: "United States",
      });
      setCurrentStep(1);
      setSelectedProduct("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create quote",
      });
    },
  });

  const handleNext = async () => {
    let isValid = false;
    
    if (currentStep === 1) {
      isValid = await form.trigger(["effectiveDate", "agentId", "productType"]);
    } else if (currentStep === 2) {
      isValid = await form.trigger([
        "clientFirstName", 
        "clientLastName", 
        "clientEmail", 
        "clientPhone",
        "clientMiddleName",
        "clientSecondLastName",
        "clientDateOfBirth",
        "clientGender",
        "clientIsApplicant",
        "clientTobaccoUser",
        "clientSsn",
        "street",
        "city",
        "state",
        "postalCode"
      ]);
    } else if (currentStep === 3) {
      isValid = true; // Family members are optional
    }

    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else if (isValid && currentStep === 3) {
      form.handleSubmit((data) => createQuoteMutation.mutate(data))();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleProductSelect = (productId: string) => {
    setSelectedProduct(productId);
    form.setValue("productType", productId);
  };

  const handleAddSpouse = () => {
    appendSpouse({
      firstName: "",
      middleName: "",
      lastName: "",
      secondLastName: "",
      dateOfBirth: "",
      ssn: "",
      gender: "",
      phone: "",
      email: "",
      isApplicant: true,
      tobaccoUser: false,
    });
  };

  const handleAddDependent = () => {
    appendDependent({
      firstName: "",
      middleName: "",
      lastName: "",
      secondLastName: "",
      dateOfBirth: "",
      ssn: "",
      gender: "",
      phone: "",
      email: "",
      isApplicant: true,
      tobaccoUser: false,
      relation: "",
    });
  };

  const agents = agentsData?.users || [];
  const allQuotes = quotesData?.quotes || [];
  
  // Detect if we're viewing a specific quote
  const quoteId = params?.id;
  const isViewingQuote = !!quoteId && quoteId !== "new";
  const viewingQuote = isViewingQuote ? allQuotes.find(q => q.id === quoteId) : null;
  
  // Filter quotes based on search and filters
  const filteredQuotes = allQuotes.filter((quote) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      searchQuery === "" ||
      `${quote.clientFirstName} ${quote.clientMiddleName || ''} ${quote.clientLastName} ${quote.clientSecondLastName || ''}`.toLowerCase().includes(searchLower) ||
      quote.clientEmail.toLowerCase().includes(searchLower) ||
      quote.clientPhone.includes(searchQuery);
    
    // Status filter
    const matchesStatus = filters.status === "all" || quote.status === filters.status;
    
    // Product filter
    const matchesProduct = filters.productType === "all" || quote.productType === filters.productType;
    
    // State filter
    const matchesState = !filters.state || quote.state === filters.state;
    
    // Zip code filter
    const matchesZipCode = !filters.zipCode || quote.postalCode.includes(filters.zipCode);
    
    // Assigned to filter (agentId)
    const matchesAssignedTo = !filters.assignedTo || quote.agentId === filters.assignedTo;
    
    // Effective date range filter
    const quoteEffectiveDate = new Date(quote.effectiveDate);
    const matchesEffectiveDateFrom = !filters.effectiveDateFrom || quoteEffectiveDate >= new Date(filters.effectiveDateFrom);
    const matchesEffectiveDateTo = !filters.effectiveDateTo || quoteEffectiveDate <= new Date(filters.effectiveDateTo);
    
    // Family group size (applicants) filter
    const matchesApplicantsFrom = !filters.applicantsFrom || (quote.familyGroupSize && quote.familyGroupSize >= parseInt(filters.applicantsFrom));
    const matchesApplicantsTo = !filters.applicantsTo || (quote.familyGroupSize && quote.familyGroupSize <= parseInt(filters.applicantsTo));
    
    return matchesSearch && matchesStatus && matchesProduct && matchesState && 
           matchesZipCode && matchesAssignedTo && matchesEffectiveDateFrom && 
           matchesEffectiveDateTo && matchesApplicantsFrom && matchesApplicantsTo;
  });
  
  // Check if any filters are active
  const hasActiveFilters = filters.status !== "all" || filters.productType !== "all" || 
    filters.state || filters.zipCode || filters.assignedTo || filters.effectiveDateFrom || 
    filters.effectiveDateTo || filters.applicantsFrom || filters.applicantsTo;
  
  // Pagination logic
  const totalItems = filteredQuotes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedQuotes = filteredQuotes.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters]);
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({
      user: "",
      assignedTo: "",
      status: "all",
      state: "",
      zipCode: "",
      productType: "all",
      effectiveDateFrom: "",
      effectiveDateTo: "",
      submissionDateFrom: "",
      submissionDateTo: "",
      applicantsFrom: "",
      applicantsTo: "",
    });
  };

  // Step indicators
  const steps = [
    { number: 1, title: "Policy Information", icon: FileText },
    { number: 2, title: "Personal Information & Address", icon: User },
    { number: 3, title: "Family Group", icon: Users },
  ];

  // If viewing a specific quote, show modern dashboard
  if (isViewingQuote) {
    // Show loading state while fetching quotes
    if (isLoading) {
      return (
        <div className="h-full p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading quote details...</p>
          </div>
        </div>
      );
    }
    
    if (!viewingQuote) {
      return (
        <div className="h-full p-6 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Quote not found</h2>
            <p className="text-muted-foreground mb-4">The quote you're looking for doesn't exist or has been deleted.</p>
            <Button onClick={() => setLocation("/quotes")}>
              Back to Quotes
            </Button>
          </div>
        </div>
      );
    }

    const product = PRODUCT_TYPES.find(p => p.id === viewingQuote.productType);
    const agent = agents.find(a => a.id === viewingQuote.agentId);
    const totalApplicants = 1 + 
      (viewingQuote.spouses?.filter((s: any) => s.isApplicant).length || 0) + 
      (viewingQuote.dependents?.filter((d: any) => d.isApplicant).length || 0);
    const totalFamilyMembers = 1 + 
      (viewingQuote.spouses?.length || 0) + 
      (viewingQuote.dependents?.length || 0);
    const totalDependents = viewingQuote.dependents?.length || 0;

    return (
      <div className="flex flex-col lg:flex-row h-full">
        {/* Sidebar Summary */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-background p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Summary</h2>
              
              <div className="space-y-3">
                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Quote ID</label>
                  <p className="text-sm font-mono">{viewingQuote.id.slice(0, 8).toUpperCase()}</p>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Agent</label>
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
                  <label className="text-xs text-muted-foreground">Assigned to</label>
                  <p className="text-sm">-</p>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Carrier</label>
                  <p className="text-sm font-medium">{product?.name || viewingQuote.productType}</p>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Effective date</label>
                  <p className="text-sm">{format(new Date(viewingQuote.effectiveDate), "MM/dd/yyyy")}</p>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">No. of applicants</label>
                  <p className="text-sm font-medium">{totalApplicants}</p>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge variant={viewingQuote.status === 'active' ? 'default' : 'secondary'}>
                      {viewingQuote.status === 'active' ? 'Quote' : viewingQuote.status || 'Draft'}
                    </Badge>
                  </div>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">New sale</Badge>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Last update</label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(viewingQuote.updatedAt || viewingQuote.createdAt), "MMM dd, yyyy h:mm a")}
                  </p>
                </div>
              </div>
            </div>

            {/* Household Information */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold">Household Information</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Holder</span>
                  <span className="text-xs font-medium">
                    {viewingQuote.clientFirstName} {viewingQuote.clientMiddleName} {viewingQuote.clientLastName} {viewingQuote.clientSecondLastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Date of birth</span>
                  <span className="text-xs">{viewingQuote.clientDateOfBirth ? format(new Date(viewingQuote.clientDateOfBirth), "MM/dd/yyyy") : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <span className="text-xs">{viewingQuote.clientPhone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Location</span>
                  <span className="text-xs">{viewingQuote.state} {viewingQuote.postalCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Annual income</span>
                  <span className="text-xs">$0.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Member ID</span>
                  <span className="text-xs">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Enhanced Header with Card Background */}
            <Card className="mb-6 bg-muted/20">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {product?.icon && (
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <product.icon className="h-8 w-8 text-primary" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h1 className="text-2xl font-bold">
                            {viewingQuote.clientFirstName} {viewingQuote.clientMiddleName} {viewingQuote.clientLastName} {viewingQuote.clientSecondLastName}
                          </h1>
                          <Badge variant={viewingQuote.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {viewingQuote.status === 'active' ? 'Active Quote' : viewingQuote.status || 'Draft'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {viewingQuote.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-medium text-foreground">{product?.name || viewingQuote.productType}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Effective {format(new Date(viewingQuote.effectiveDate), "MMM dd, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-edit-quote">
                    Edit Quote
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Policy Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Policy Information</h3>
              
              {/* Compact Profile Card with 2-Column Grid */}
              <Card className="bg-muted/10">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Contact Information Group */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Primary Holder</label>
                          <p className="text-sm font-semibold mt-0.5">
                            {viewingQuote.clientFirstName} {viewingQuote.clientMiddleName} {viewingQuote.clientLastName} {viewingQuote.clientSecondLastName}
                          </p>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {viewingQuote.clientIsApplicant ? 'Self' : 'Not Applicant'}
                            </Badge>
                            {viewingQuote.clientTobaccoUser && (
                              <Badge variant="outline" className="text-xs">Tobacco User</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <Mail className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Email</label>
                          <p className="text-sm mt-0.5">{viewingQuote.clientEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Phone</label>
                          <p className="text-sm mt-0.5">{viewingQuote.clientPhone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Date of Birth</label>
                          <p className="text-sm mt-0.5">
                            {viewingQuote.clientDateOfBirth ? format(new Date(viewingQuote.clientDateOfBirth), "MMM dd, yyyy") : 'N/A'}
                            {viewingQuote.clientDateOfBirth && (
                              <span className="text-muted-foreground ml-2">
                                ({Math.floor((new Date().getTime() - new Date(viewingQuote.clientDateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365))} years)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Identification & Address Group */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <IdCard className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">SSN</label>
                          <p className="text-sm mt-0.5 font-mono">
                            {viewingQuote.clientSsn ? '***-**-' + viewingQuote.clientSsn.slice(-4) : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Gender</label>
                          <p className="text-sm mt-0.5">
                            {viewingQuote.clientGender ? viewingQuote.clientGender.charAt(0).toUpperCase() + viewingQuote.clientGender.slice(1) : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <Home className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Street Address</label>
                          <p className="text-sm mt-0.5">
                            {viewingQuote.street}
                            {viewingQuote.addressLine2 && <span>, {viewingQuote.addressLine2}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-muted-foreground">Location</label>
                          <p className="text-sm mt-0.5">
                            {viewingQuote.city}, {viewingQuote.state} {viewingQuote.postalCode}
                            {viewingQuote.county && (
                              <span className="block text-xs text-muted-foreground mt-0.5">{viewingQuote.county} County</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Cards - Subtle Skeleton Style */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="bg-muted/10 border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-xs font-medium text-muted-foreground">Monthly Premium</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-muted-foreground">Pending</p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/10 border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded">
                        <PiggyBank className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-xs font-medium text-muted-foreground">Savings Total</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-muted-foreground">Pending</p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/10 border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-xs font-medium text-muted-foreground">Original Cost</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-muted-foreground">Pending</p>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Policy Details - More Compact */}
              <Card className="bg-accent/5">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Member ID
                      </p>
                      <p className="text-sm font-medium mt-1">-</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Marketplace ID
                      </p>
                      <p className="text-sm font-medium mt-1">-</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Effective Date
                      </p>
                      <p className="text-sm font-medium mt-1">{format(new Date(viewingQuote.effectiveDate), "MMM dd, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Cancellation
                      </p>
                      <p className="text-sm font-medium mt-1">-</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </div>

              {/* Family Members Section - 2 Column Grid */}
              <Card className="bg-accent/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Family Members
                    </CardTitle>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Applicants:</span>
                        <Badge variant="secondary" className="text-xs">{totalApplicants}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Members:</span>
                        <Badge variant="secondary" className="text-xs">{totalFamilyMembers}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Dependents:</span>
                        <Badge variant="secondary" className="text-xs">{totalDependents}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" data-testid="button-add-member">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Member
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary Applicant */}
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <Avatar className="h-14 w-14 border-2 border-primary/20">
                            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                              {viewingQuote.clientFirstName?.[0]}{viewingQuote.clientLastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm truncate">
                                  {viewingQuote.clientFirstName} {viewingQuote.clientMiddleName} {viewingQuote.clientLastName} {viewingQuote.clientSecondLastName}
                                </h4>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  <Badge variant="default" className="text-xs">Self</Badge>
                                  {viewingQuote.clientIsApplicant && (
                                    <Badge variant="secondary" className="text-xs">Applicant</Badge>
                                  )}
                                  {viewingQuote.clientTobaccoUser && (
                                    <Badge variant="outline" className="text-xs">Tobacco</Badge>
                                  )}
                                </div>
                              </div>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid="button-view-primary">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground mt-2">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{viewingQuote.clientGender ? viewingQuote.clientGender.charAt(0).toUpperCase() + viewingQuote.clientGender.slice(1) : 'N/A'}</span>
                                <span>•</span>
                                <span>{viewingQuote.clientDateOfBirth ? Math.floor((new Date().getTime() - new Date(viewingQuote.clientDateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} yrs</span>
                              </div>
                              {viewingQuote.clientPhone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <span className="truncate">{viewingQuote.clientPhone}</span>
                                </div>
                              )}
                              {viewingQuote.clientEmail && (
                                <div className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{viewingQuote.clientEmail}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Spouses */}
                    {viewingQuote.spouses?.map((spouse: any, index: number) => (
                      <Card key={`spouse-${index}`} className="bg-background">
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <Avatar className="h-14 w-14 border-2 border-muted">
                              <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
                                {spouse.firstName?.[0]}{spouse.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm truncate">
                                    {spouse.firstName} {spouse.middleName} {spouse.lastName} {spouse.secondLastName}
                                  </h4>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    <Badge variant="outline" className="text-xs">Spouse</Badge>
                                    {spouse.isApplicant && (
                                      <Badge variant="secondary" className="text-xs">Applicant</Badge>
                                    )}
                                    {spouse.tobaccoUser && (
                                      <Badge variant="outline" className="text-xs">Tobacco</Badge>
                                    )}
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-spouse-${index}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground mt-2">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>{spouse.gender ? spouse.gender.charAt(0).toUpperCase() + spouse.gender.slice(1) : 'N/A'}</span>
                                  <span>•</span>
                                  <span>{spouse.dateOfBirth ? Math.floor((new Date().getTime() - new Date(spouse.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} yrs</span>
                                </div>
                                {spouse.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span className="truncate">{spouse.phone}</span>
                                  </div>
                                )}
                                {spouse.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">{spouse.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Dependents */}
                    {viewingQuote.dependents?.map((dependent: any, index: number) => (
                      <Card key={`dependent-${index}`} className="bg-background">
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            <Avatar className="h-14 w-14 border-2 border-muted">
                              <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
                                {dependent.firstName?.[0]}{dependent.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm truncate">
                                    {dependent.firstName} {dependent.middleName} {dependent.lastName} {dependent.secondLastName}
                                  </h4>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    <Badge variant="outline" className="text-xs">{dependent.relation || 'Dependent'}</Badge>
                                    {dependent.isApplicant && (
                                      <Badge variant="secondary" className="text-xs">Applicant</Badge>
                                    )}
                                    {dependent.tobaccoUser && (
                                      <Badge variant="outline" className="text-xs">Tobacco</Badge>
                                    )}
                                  </div>
                                </div>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-dependent-${index}`}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="space-y-1 text-xs text-muted-foreground mt-2">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <span>{dependent.gender ? dependent.gender.charAt(0).toUpperCase() + dependent.gender.slice(1) : 'N/A'}</span>
                                  <span>•</span>
                                  <span>{dependent.dateOfBirth ? Math.floor((new Date().getTime() - new Date(dependent.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} yrs</span>
                                </div>
                                {dependent.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span className="truncate">{dependent.phone}</span>
                                  </div>
                                )}
                                {dependent.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">{dependent.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Addresses Section - Consolidated */}
              <Card className="bg-muted/10">
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Addresses
                  </CardTitle>
                  <Button size="sm" variant="outline">
                    Edit Addresses
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Physical Address */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          <Home className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h4 className="text-sm font-semibold">Physical Address</h4>
                      </div>
                      <div className="pl-7 space-y-0.5">
                        <p className="text-sm">{viewingQuote.street}</p>
                        {viewingQuote.addressLine2 && <p className="text-sm">{viewingQuote.addressLine2}</p>}
                        <p className="text-sm">
                          {viewingQuote.city}, {viewingQuote.state} {viewingQuote.postalCode}
                        </p>
                        {viewingQuote.county && (
                          <p className="text-xs text-muted-foreground">{viewingQuote.county} County</p>
                        )}
                      </div>
                    </div>

                    {/* Mailing Address */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h4 className="text-sm font-semibold">Mailing Address</h4>
                      </div>
                      <div className="pl-7 space-y-0.5">
                        <p className="text-sm text-muted-foreground italic">Same as physical</p>
                      </div>
                    </div>

                    {/* Billing Address */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          <CreditCard className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h4 className="text-sm font-semibold">Billing Address</h4>
                      </div>
                      <div className="pl-7 space-y-0.5">
                        <p className="text-sm text-muted-foreground italic">Same as physical</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Information */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Payment information</CardTitle>
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Recurrent payment</p>
                      <p className="text-sm font-medium">Yes</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">First payment date</p>
                      <p className="text-sm">{format(new Date(viewingQuote.effectiveDate), "MMM dd, yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Preferred payment day</p>
                      <p className="text-sm">1</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Payment cards</CardTitle>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No payment cards on file
                  </p>
                </CardContent>
              </Card>

              {/* Bank Accounts */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Bank accounts</CardTitle>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium">Bank account not found</p>
                    <p className="text-xs text-muted-foreground">You do not have any bank account associated to your profile just yet.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Notes or Comments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Notes or comments</CardTitle>
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add any notes or comments about this quote..."
                    className="min-h-[100px]"
                    data-testid="textarea-notes"
                  />
                </CardContent>
              </Card>

              {/* Primary Doctor Information */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Primary Doctor information</CardTitle>
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Add primary doctor information..."
                    className="min-h-[100px]"
                    data-testid="textarea-doctor"
                  />
                </CardContent>
              </Card>

              {/* Medicines Needed */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Medicines needed</CardTitle>
                  <Button size="sm" variant="ghost">
                    Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="List any medicines needed..."
                    className="min-h-[100px]"
                    data-testid="textarea-medicines"
                  />
                </CardContent>
              </Card>

              {/* Other Policies */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Other policies of the applicant</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Effective year:</span>
                    <Select defaultValue="2025">
                      <SelectTrigger className="w-24 h-8" data-testid="select-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No other policies found for this applicant</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6 flex flex-col overflow-hidden">
      {!showWizard ? (
        <Card className="overflow-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Quotes</CardTitle>
                <CardDescription>View and manage your insurance quotes</CardDescription>
              </div>
              <Button onClick={() => setLocation("/quotes/new")} data-testid="button-create-quote">
                <Plus className="h-4 w-4 mr-2" />
                Create Quote
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading quotes...</div>
            ) : allQuotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No quotes yet</h3>
                <p className="text-muted-foreground mb-4">Create your first quote to get started</p>
                <Button onClick={() => setLocation("/quotes/new")} data-testid="button-create-first-quote">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quote
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search and Filters Button */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by client name, email, or phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                      data-testid="input-search-quotes"
                    />
                  </div>
                  <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" data-testid="button-filters">
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                        {hasActiveFilters && (
                          <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                            !
                          </Badge>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Filter your quotes by</SheetTitle>
                      </SheetHeader>
                      <div className="space-y-6 py-6">
                        {/* Search and Reset */}
                        <div className="flex gap-2">
                          <Button 
                            variant="default" 
                            className="flex-1"
                            onClick={() => setFiltersOpen(false)}
                            data-testid="button-apply-filters"
                          >
                            <Search className="h-4 w-4 mr-2" />
                            Search
                          </Button>
                          {hasActiveFilters && (
                            <Button 
                              variant="outline"
                              onClick={resetFilters}
                              data-testid="button-reset-filters"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reset filters
                            </Button>
                          )}
                        </div>

                        {/* Assigned to */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Assigned to</label>
                          <Select 
                            value={filters.assignedTo || "all"} 
                            onValueChange={(value) => setFilters(prev => ({ ...prev, assignedTo: value === "all" ? "" : value }))}
                          >
                            <SelectTrigger data-testid="select-assigned-to">
                              <SelectValue placeholder="Filter by assigned user" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Users</SelectItem>
                              {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.firstName} {agent.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Status</label>
                          <Select 
                            value={filters.status} 
                            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                          >
                            <SelectTrigger data-testid="select-filter-status">
                              <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="pending_review">Pending Review</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* State */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">State</label>
                          <Select 
                            value={filters.state || "all"} 
                            onValueChange={(value) => setFilters(prev => ({ ...prev, state: value === "all" ? "" : value }))}
                          >
                            <SelectTrigger data-testid="select-filter-state">
                              <SelectValue placeholder="Filter by state" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All States</SelectItem>
                              {US_STATES.map((state) => (
                                <SelectItem key={state.value} value={state.value}>
                                  {state.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Zip Code */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Zip code</label>
                          <Input
                            placeholder="Filter by Zip code"
                            value={filters.zipCode}
                            onChange={(e) => setFilters(prev => ({ ...prev, zipCode: e.target.value }))}
                            data-testid="input-filter-zip"
                          />
                        </div>

                        {/* Product Type */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Product type</label>
                          <Select 
                            value={filters.productType} 
                            onValueChange={(value) => setFilters(prev => ({ ...prev, productType: value }))}
                          >
                            <SelectTrigger data-testid="select-filter-product">
                              <SelectValue placeholder="Product type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Products</SelectItem>
                              {PRODUCT_TYPES.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Effective Date Range */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Effective date</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="date"
                              placeholder="From..."
                              value={filters.effectiveDateFrom}
                              onChange={(e) => setFilters(prev => ({ ...prev, effectiveDateFrom: e.target.value }))}
                              data-testid="input-effective-from"
                            />
                            <Input
                              type="date"
                              placeholder="To..."
                              value={filters.effectiveDateTo}
                              onChange={(e) => setFilters(prev => ({ ...prev, effectiveDateTo: e.target.value }))}
                              data-testid="input-effective-to"
                            />
                          </div>
                        </div>

                        {/* Quantity of Applicants */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Quantity of applicants</label>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              placeholder="From"
                              value={filters.applicantsFrom}
                              onChange={(e) => setFilters(prev => ({ ...prev, applicantsFrom: e.target.value }))}
                              data-testid="input-applicants-from"
                            />
                            <Input
                              type="number"
                              placeholder="To"
                              value={filters.applicantsTo}
                              onChange={(e) => setFilters(prev => ({ ...prev, applicantsTo: e.target.value }))}
                              data-testid="input-applicants-to"
                            />
                          </div>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {/* Show selector and pagination info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Show</span>
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                      setItemsPerPage(parseInt(value));
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-20" data-testid="select-items-per-page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Showing {totalItems > 0 ? startIndex + 1 : 0} to {endIndex} of {totalItems} Entries
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="icon"
                        onClick={() => setCurrentPage(page)}
                        data-testid={`button-page-${page}`}
                        className={currentPage === page ? "" : ""}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Table */}
                {filteredQuotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No quotes match your search criteria
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox data-testid="checkbox-select-all" />
                        </TableHead>
                        <TableHead className="w-16">Agent</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Policy</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedQuotes.map((quote) => {
                        const product = PRODUCT_TYPES.find(p => p.id === quote.productType);
                        const agent = agents.find(a => a.id === quote.agentId);
                        const assignedAgent = agents.find(a => a.id === quote.agentId);
                        
                        return (
                          <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                            <TableCell>
                              <Checkbox data-testid={`checkbox-quote-${quote.id}`} />
                            </TableCell>
                            <TableCell className="text-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-pointer inline-block">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={agent?.avatar || undefined} />
                                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {agent?.firstName?.[0] || 'A'}
                                      </AvatarFallback>
                                    </Avatar>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={5} align="center" className="p-2">
                                  <div>
                                    <div className="font-semibold text-xs mb-0.5">Agent information</div>
                                    <div className="text-xs leading-tight">
                                      <div>Name: {agent?.firstName || 'Unknown'} {agent?.lastName || 'Agent'}</div>
                                      <div>NPN: {agent?.nationalProducerNumber || 'N/A'}</div>
                                      <div>Email: {agent?.email || 'No email'}</div>
                                      <div>Role: {agent?.role || 'N/A'}</div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div 
                                  className="font-medium text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
                                  onClick={() => setLocation(`/quotes/${quote.id}`)}
                                >
                                  {quote.clientFirstName} {quote.clientMiddleName} {quote.clientLastName} {quote.clientSecondLastName}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {quote.clientIsApplicant ? 'Self' : 'Not Applicant'} - {quote.clientGender ? quote.clientGender.charAt(0).toUpperCase() + quote.clientGender.slice(1) : 'N/A'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {quote.state} {quote.postalCode}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm text-blue-600 dark:text-blue-400">
                                  {product?.name || quote.productType}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Effective {format(new Date(quote.effectiveDate), "MMM dd, yyyy")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {quote.id.slice(0, 8)}...
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(quote.createdAt), "MMM dd, yyyy h:mm a")}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              -
                            </TableCell>
                            <TableCell>
                              {assignedAgent ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{assignedAgent.firstName} {assignedAgent.lastName}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0"
                                    data-testid={`button-remove-assigned-${quote.id}`}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" data-testid={`button-preview-${quote.id}`}>
                                    Preview
                                    <ChevronDown className="h-4 w-4 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setLocation(`/quotes/${quote.id}`)}>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>Edit Quote</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="flex flex-col flex-1 min-h-0">
          <CardHeader>
            <div className="flex items-center justify-between gap-6 mb-8">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-800" style={{ zIndex: 0 }}>
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300" 
                      style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                    />
                  </div>
                  
                  {/* Steps */}
                  <div className="relative flex justify-between" style={{ zIndex: 1 }}>
                    {steps.map((step) => {
                      const isCompleted = currentStep > step.number;
                      const isCurrent = currentStep === step.number;
                      const isActive = isCompleted || isCurrent;
                      
                      return (
                        <div key={step.number} className="flex flex-col items-center">
                          <div
                            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 ${
                              isCompleted
                                ? "bg-green-500 text-white"
                                : isActive
                                ? "bg-blue-500 text-white"
                                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }`}
                            data-testid={`step-indicator-${step.number}`}
                          >
                            {isCompleted ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <span className="text-sm font-semibold">{step.number}</span>
                            )}
                          </div>
                          <div className="mt-2 text-xs font-medium text-center whitespace-nowrap">
                            <div className={isActive ? "text-foreground" : "text-muted-foreground"}>
                              {step.title}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setLocation("/quotes");
                  setCurrentStep(1);
                  form.reset();
                  setSelectedProduct("");
                }}
                data-testid="button-cancel-wizard"
                className="shrink-0"
              >
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col p-6">
            <Form {...form}>
              <form className="flex-1 min-h-0 flex flex-col gap-4">
                {/* Scrollable Form Content */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2">
                  {/* Step 1: Policy Information */}
                  {currentStep === 1 && (
                    <div className="space-y-6 px-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="effectiveDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Effective date <span className="text-destructive">(required)</span></FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-effective-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="agentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Who is the agent on record for this client? <span className="text-destructive">(required)</span></FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-agent">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {agents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id}>
                                    {agent.firstName} {agent.lastName} ({agent.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="productType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base">Select a product a quote <span className="text-destructive">(required)</span></FormLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            {PRODUCT_TYPES.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => handleProductSelect(product.id)}
                                className={`p-4 rounded-lg border text-left transition-all ${
                                  selectedProduct === product.id
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-border bg-card hover-elevate"
                                }`}
                                data-testid={`card-product-${product.id}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`flex-shrink-0 w-10 h-10 rounded-md flex items-center justify-center ${
                                    selectedProduct === product.id ? "bg-primary" : "bg-primary/90"
                                  }`}>
                                    <product.icon className="h-5 w-5 text-primary-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm mb-1 text-foreground">{product.name}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Personal Information & Address */}
                {currentStep === 2 && (
                  <div className="space-y-6 px-8">
                    {/* Personal Information Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Personal Information</h3>
                      </div>
                      
                      {/* Row 1: First Name, Middle Name, Last Name, Second Last Name */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-4">
                        <FormField
                          control={form.control}
                          name="clientFirstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-client-firstname" placeholder="First name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientMiddleName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Middle Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-client-middlename" placeholder="Middle name (optional)" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientLastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-client-lastname" placeholder="Last name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientSecondLastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Second Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-client-secondlastname" placeholder="Second last name (optional)" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Row 2: DOB, SSN, Gender, Phone Number, Email Address */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-x-4 gap-y-4">
                        <FormField
                          control={form.control}
                          name="clientDateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date of Birth</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-client-dob" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientSsn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SSN</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field}
                                  type="text" 
                                  data-testid="input-client-ssn" 
                                  placeholder="XXX-XX-XXXX"
                                  maxLength={11}
                                  onChange={(e) => {
                                    const formatted = formatSSN(e.target.value);
                                    field.onChange(formatted);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientGender"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gender</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-client-gender">
                                    <SelectValue placeholder="Select gender" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field}
                                  type="tel" 
                                  data-testid="input-client-phone" 
                                  placeholder="(555) 123-4567"
                                  maxLength={14}
                                  onChange={(e) => {
                                    const formatted = formatPhoneNumber(e.target.value);
                                    field.onChange(formatted);
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="clientEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email *</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-client-email" placeholder="client@example.com" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Address Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-t pt-4">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Address</h3>
                      </div>

                      {/* Street Address and Apartment in same row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-4">
                        <div className="md:col-span-2">
                          <GooglePlacesAddressAutocomplete
                            value={form.watch("street")}
                            onChange={(value) => form.setValue("street", value)}
                            onAddressSelect={(address) => {
                              form.setValue("street", address.street);
                              form.setValue("city", address.city);
                              form.setValue("state", address.state);
                              form.setValue("postalCode", address.postalCode);
                              form.setValue("county", address.county || "");
                              form.setValue("country", address.country);
                            }}
                            label="Street Address *"
                            placeholder="Start typing your address..."
                            testId="input-street-address"
                          />
                          {form.formState.errors.street && (
                            <p className="text-sm text-destructive mt-2">{form.formState.errors.street.message}</p>
                          )}
                        </div>

                        <FormField
                          control={form.control}
                          name="addressLine2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Apt/Suite/Unit</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-address-line2" placeholder="# (optional)" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* City, State, Postal Code, County */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-city" placeholder="City" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-state">
                                    <SelectValue placeholder="Select state" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {US_STATES.map((state) => (
                                    <SelectItem key={state.value} value={state.value}>
                                      {state.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="postalCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Postal Code *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-postalcode" placeholder="ZIP Code" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="county"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>County</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-county" placeholder="Auto-detected" disabled />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">Auto-detected from address</p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Additional Options */}
                    <div className="space-y-3 pt-4 border-t">
                      <h3 className="text-base font-semibold">Additional Information</h3>
                      
                      <FormField
                        control={form.control}
                        name="clientIsApplicant"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-client-applicant"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-2 cursor-pointer">
                                Is this member an applicant?
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Select this option to add the family member to the coverage. Unselect if the member is eligible through a job, Medicaid, CHIP, or Medicare.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="clientTobaccoUser"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-client-tobacco"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-2 cursor-pointer">
                                Tobacco user
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="max-w-xs space-y-2">
                                      <p>Select this if you've used tobacco <strong>4 or more times per week for the past 6 months</strong>.</p>
                                      <p className="text-xs">You may pay more for insurance, but if you don't report that you are a tobacco user, and then later develop a tobacco-related illness, you can be <strong>denied</strong> coverage.</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Step 3: Family Group */}
                {currentStep === 3 && (
                  <div className="space-y-6 px-8">
                    {/* Household Information Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Household Information</h3>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="annualHouseholdIncome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Annual household income</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input 
                                  {...field} 
                                  className="pl-7" 
                                  placeholder="Annual household income" 
                                  data-testid="input-household-income"
                                />
                              </div>
                            </FormControl>
                            <p className="text-sm text-muted-foreground">
                              Health Insurance services require you to provide your annual household income so we can provide more accurate quotes.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="familyGroupSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base">Family group size</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Family group size" 
                                data-testid="input-family-size"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Family Members Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-t pt-4">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Family Members</h3>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        Add your spouse and/or dependents to the quote.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleAddSpouse}
                          data-testid="button-add-spouse"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Spouse
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleAddDependent}
                          data-testid="button-add-dependent"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Dependent
                        </Button>
                      </div>
                    </div>

                    {/* Spouse Cards */}
                    {spouseFields.map((spouse, index) => (
                      <Card key={spouse.id} className="border-l-4 border-l-primary" data-testid={`card-spouse-${index}`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                          <CardTitle className="text-lg">Spouse {index + 1}</CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSpouse(index)}
                            data-testid={`button-delete-spouse-${index}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Row 1: First Name, Middle Name, Last Name, Second Last Name */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-4">
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.firstName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name *</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="First name" data-testid={`input-spouse-firstname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.middleName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Middle Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Middle name (optional)" data-testid={`input-spouse-middlename-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.lastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name *</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Last name" data-testid={`input-spouse-lastname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.secondLastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Second Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Second last name (optional)" data-testid={`input-spouse-secondlastname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Row 2: Date of Birth, SSN, Gender, Phone */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-4">
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.dateOfBirth`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of Birth *</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} data-testid={`input-spouse-dob-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.ssn`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SSN *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="text" 
                                      data-testid={`input-spouse-ssn-${index}`} 
                                      placeholder="XXX-XX-XXXX"
                                      maxLength={11}
                                      onChange={(e) => {
                                        const formatted = formatSSN(e.target.value);
                                        field.onChange(formatted);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.gender`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Gender *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-spouse-gender-${index}`}>
                                        <SelectValue placeholder="Select gender" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div></div>
                          </div>

                          {/* Row 3: Phone, Email */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.phone`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="tel"
                                      placeholder="(555) 123-4567" 
                                      data-testid={`input-spouse-phone-${index}`}
                                      maxLength={14}
                                      onChange={(e) => {
                                        const formatted = formatPhoneNumber(e.target.value);
                                        field.onChange(formatted);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.email`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} placeholder="Email" data-testid={`input-spouse-email-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Checkboxes */}
                          <div className="space-y-4 pt-6 mt-6 border-t">
                            <h3 className="text-sm font-semibold">Select all that apply</h3>
                            
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.isApplicant`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-spouse-applicant-${index}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Is this member an applicant?
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">Select this option to add the family member to the coverage. Unselect if the member is eligible through a job, Medicaid, CHIP, or Medicare.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.tobaccoUser`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-spouse-tobacco-${index}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Tobacco user
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="max-w-xs space-y-2">
                                            <p>Select this if you've used tobacco <strong>4 or more times per week for the past 6 months</strong>.</p>
                                            <p className="text-xs">You may pay more for insurance, but if you don't report that you are a tobacco user, and then later develop a tobacco-related illness, you can be <strong>denied</strong> coverage.</p>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Dependent Cards */}
                    {dependentFields.map((dependent, index) => (
                      <Card key={dependent.id} className="border-l-4 border-l-primary" data-testid={`card-dependent-${index}`}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                          <CardTitle className="text-lg">Dependent {index + 1}</CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDependent(index)}
                            data-testid={`button-delete-dependent-${index}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Row 1: First Name, Middle Name, Last Name, Second Last Name */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-4">
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.firstName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First Name *</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="First name" data-testid={`input-dependent-firstname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.middleName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Middle Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Middle name (optional)" data-testid={`input-dependent-middlename-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.lastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last Name *</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Last name" data-testid={`input-dependent-lastname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.secondLastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Second Last Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Second last name (optional)" data-testid={`input-dependent-secondlastname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Row 2: Date of Birth, SSN, Gender, Relation */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-4">
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.dateOfBirth`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of Birth *</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} data-testid={`input-dependent-dob-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.ssn`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SSN *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="text" 
                                      data-testid={`input-dependent-ssn-${index}`} 
                                      placeholder="XXX-XX-XXXX"
                                      maxLength={11}
                                      onChange={(e) => {
                                        const formatted = formatSSN(e.target.value);
                                        field.onChange(formatted);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.gender`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Gender *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-dependent-gender-${index}`}>
                                        <SelectValue placeholder="Select gender" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.relation`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Relation *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-dependent-relation-${index}`}>
                                        <SelectValue placeholder="Select relation" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="child">Child</SelectItem>
                                      <SelectItem value="parent">Parent</SelectItem>
                                      <SelectItem value="sibling">Sibling</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Row 3: Phone, Email */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.phone`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="tel"
                                      placeholder="(555) 123-4567" 
                                      data-testid={`input-dependent-phone-${index}`}
                                      maxLength={14}
                                      onChange={(e) => {
                                        const formatted = formatPhoneNumber(e.target.value);
                                        field.onChange(formatted);
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.email`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} placeholder="Email" data-testid={`input-dependent-email-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Checkboxes */}
                          <div className="space-y-4 pt-6 mt-6 border-t">
                            <h3 className="text-sm font-semibold">Select all that apply</h3>
                            
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.isApplicant`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-dependent-applicant-${index}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Is this member an applicant?
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">Select this option to add the family member to the coverage. Unselect if the member is eligible through a job, Medicaid, CHIP, or Medicare.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.tobaccoUser`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-dependent-tobacco-${index}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Tobacco user
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="max-w-xs space-y-2">
                                            <p>Select this if you've used tobacco <strong>4 or more times per week for the past 6 months</strong>.</p>
                                            <p className="text-xs">You may pay more for insurance, but if you don't report that you are a tobacco user, and then later develop a tobacco-related illness, you can be <strong>denied</strong> coverage.</p>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </FormLabel>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    </div>
                  )}
                </div>

                {/* Navigation Buttons - Fixed at bottom */}
                <div className="flex items-center justify-between pt-4 border-t shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    data-testid="button-back"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>

                  <div className="text-sm text-muted-foreground">
                    Step {currentStep} of 3
                  </div>

                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={createQuoteMutation.isPending}
                    data-testid="button-next"
                  >
                    {currentStep === 3 ? (
                      createQuoteMutation.isPending ? "Creating..." : "CREATE QUOTE"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
