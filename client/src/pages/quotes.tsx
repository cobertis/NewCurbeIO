import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Users, MapPin, FileText, Check, Search, Info, Trash2, Heart, Building2, Shield, Eye, Smile, DollarSign, PiggyBank, Plane, Cross } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User as UserType, type Quote } from "@shared/schema";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isApplicant: z.boolean().default(false),
  tobaccoUser: z.boolean().default(false),
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
  spouses: z.array(familyMemberSchema).default([]),
  dependents: z.array(familyMemberSchema).default([]),
});

const completeQuoteSchema = step1Schema.merge(step2Schema).merge(step3Schema);

export default function QuotesPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  
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
      gender: "",
      phone: "",
      email: "",
      isApplicant: false,
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
      gender: "",
      phone: "",
      email: "",
      isApplicant: false,
      tobaccoUser: false,
    });
  };

  const agents = agentsData?.users || [];
  const quotes = quotesData?.quotes || [];

  // Step indicators
  const steps = [
    { number: 1, title: "Policy Information", icon: FileText },
    { number: 2, title: "Personal Information & Address", icon: User },
    { number: 3, title: "Family Group", icon: Users },
  ];

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
            ) : quotes.length === 0 ? (
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                      <TableCell className="font-medium">
                        {quote.clientFirstName} {quote.clientLastName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {PRODUCT_TYPES.find(p => p.id === quote.productType)?.name || quote.productType}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(quote.effectiveDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={quote.status === "draft" ? "secondary" : "default"}>
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                              isActive
                                ? "bg-blue-500 text-white"
                                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }`}
                            data-testid={`step-indicator-${step.number}`}
                          >
                            <span className="text-sm font-semibold">{step.number}</span>
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
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                            {PRODUCT_TYPES.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => handleProductSelect(product.id)}
                                className={`p-6 rounded-lg border text-left transition-all ${
                                  selectedProduct === product.id
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-border bg-card hover-elevate"
                                }`}
                                data-testid={`card-product-${product.id}`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className={`flex-shrink-0 w-12 h-12 rounded-md flex items-center justify-center ${
                                    selectedProduct === product.id ? "bg-primary" : "bg-primary/90"
                                  }`}>
                                    <product.icon className="h-6 w-6 text-primary-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-base mb-1.5 text-foreground">{product.name}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
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
                  <div className="space-y-10">
                    {/* Personal Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 pb-3 border-b">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Personal Information</h3>
                      </div>
                      
                      {/* Row 1: First Name, Middle Name, Last Name, Second Last Name */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-5 gap-y-6">
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
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-x-5 gap-y-6">
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
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 pb-3 border-t pt-8">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Address</h3>
                      </div>

                      {/* Street Address and Apartment in same row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-6">
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
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-5 gap-y-6">
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
                    <div className="space-y-5 pt-8 border-t">
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
                  <div className="space-y-8">
                    {/* Income and Family Size */}
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

                    {/* Add Spouse/Dependent Buttons */}
                    <div className="space-y-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleAddSpouse}
                        data-testid="button-add-spouse"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add spouse
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleAddDependent}
                        data-testid="button-add-dependent"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add dependent
                      </Button>
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
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                            {/* Row 1 */}
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.firstName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First name *</FormLabel>
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
                                  <FormLabel>Middle name (optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Middle name" data-testid={`input-spouse-middlename-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Row 2 */}
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.lastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last name *</FormLabel>
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
                                  <FormLabel>Second last name (optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Second last name" data-testid={`input-spouse-secondlastname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Row 3 */}
                            <FormField
                              control={form.control}
                              name={`spouses.${index}.dateOfBirth`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of birth</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} data-testid={`input-spouse-dob-${index}`} />
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
                                  <FormLabel>Gender</FormLabel>
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

                            {/* Row 4 */}
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
                        <CardContent className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                            {/* Row 1 */}
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.firstName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>First name *</FormLabel>
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
                                  <FormLabel>Middle name (optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Middle name" data-testid={`input-dependent-middlename-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Row 2 */}
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.lastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Last name *</FormLabel>
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
                                  <FormLabel>Second last name (optional)</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Second last name" data-testid={`input-dependent-secondlastname-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Row 3 */}
                            <FormField
                              control={form.control}
                              name={`dependents.${index}.dateOfBirth`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of birth</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} data-testid={`input-dependent-dob-${index}`} />
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
                                  <FormLabel>Gender</FormLabel>
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

                            {/* Row 4 */}
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
