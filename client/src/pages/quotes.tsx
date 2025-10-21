import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Users, MapPin, FileText, Check, Search, Info, Trash2, Heart, Building2, Shield, Eye, EyeOff, Smile, DollarSign, PiggyBank, Plane, Cross, Filter, RefreshCw, ChevronDown, ArrowLeft, ArrowRight, Mail, CreditCard, Phone, Hash, IdCard, Home, Bell, Copy, X, Archive, ChevronsUpDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User as UserType, type Quote } from "@shared/schema";
import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format, startOfMonth, addMonths } from "date-fns";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";

// Type definitions for spouse and dependent objects (matching zod schemas in shared/schema.ts)
type Spouse = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  dateOfBirth: Date | string;
  ssn: string;
  gender: "male" | "female" | "other";
  phone?: string;
  email?: string;
  isApplicant: boolean;
  tobaccoUser: boolean;
  preferredLanguage?: string;
  countryOfBirth?: string;
  maritalStatus?: string;
  weight?: string;
  height?: string;
};

type Dependent = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  dateOfBirth: Date | string;
  ssn: string;
  gender: "male" | "female" | "other";
  relation: "child" | "parent" | "sibling" | "other";
  phone?: string;
  email?: string;
  isApplicant: boolean;
  tobaccoUser: boolean;
  preferredLanguage?: string;
  countryOfBirth?: string;
  maritalStatus?: string;
  weight?: string;
  height?: string;
};

// Extended Quote type with properly typed arrays
type QuoteWithArrays = Quote & {
  spouses?: Spouse[];
  dependents?: Dependent[];
};

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

// Normalize SSN to digits only (remove all non-digits)
const normalizeSSN = (ssn: string | null | undefined): string => {
  if (!ssn) return '';
  return ssn.replace(/\D/g, '').slice(0, 9);
};

// Display SSN: hidden shows XXX-XX-6789, visible shows 123-45-6789
// Only allows viewing complete SSN (9 digits), incomplete SSN always shows masked
const displaySSN = (ssn: string | null | undefined, isVisible: boolean): string => {
  if (!ssn) return '';
  const digits = normalizeSSN(ssn);
  
  // Only show full SSN if it's complete (9 digits) AND visibility is enabled
  if (isVisible && digits.length === 9) {
    return formatSSN(digits);
  } else {
    // Always show masked format for incomplete or hidden SSN
    if (digits.length >= 4) {
      return `XXX-XX-${digits.slice(-4)}`;
    }
    return 'XXX-XX-XXXX';
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

// Countries of the world
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
  "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
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
  agentId: z.string().min(1, "Please select an agent"),
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
  preferredLanguage: z.string().optional(),
  countryOfBirth: z.string().optional(),
  maritalStatus: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  // Income fields
  employerName: z.string().optional(),
  employerPhone: z.string().optional(),
  position: z.string().optional(),
  annualIncome: z.string().optional(),
  incomeFrequency: z.string().default('annually'), // weekly, biweekly, monthly, annually
  selfEmployed: z.boolean().default(false),
  // Immigration fields
  immigrationStatus: z.string().optional(),
  naturalizationNumber: z.string().optional(), // Only for citizens
  uscisNumber: z.string().optional(),
  immigrationStatusCategory: z.string().optional(),
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
  clientEmail: z.union([z.string().email("Valid email is required"), z.literal("")]).optional(),
  clientPhone: z.string().min(1, "Phone number is required"),
  clientDateOfBirth: z.string().min(1, "Date of birth is required"),
  clientGender: z.string().optional(),
  clientIsApplicant: z.boolean().default(false),
  clientTobaccoUser: z.boolean().default(false),
  clientSsn: z.string().min(9, "SSN is required (9 digits)"),
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

// Edit Member Sheet Component - Extracted outside to prevent recreation on each render
interface EditMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteWithArrays;
  memberType?: 'primary' | 'spouse' | 'dependent';
  memberIndex?: number;
  onSave: (data: Partial<Quote>) => void;
  isPending: boolean;
  onMemberChange: (type: 'primary' | 'spouse' | 'dependent', index?: number) => void;
}

function EditMemberSheet({ open, onOpenChange, quote, memberType, memberIndex, onSave, isPending, onMemberChange }: EditMemberSheetProps) {
  const editMemberSchema = memberType === 'dependent'
    ? dependentSchema
    : familyMemberSchema;

  // Use useMemo to prevent unnecessary recalculation and form resets
  const memberData = useMemo(() => {
    if (!quote || !memberType) return null;
    
    if (memberType === 'primary') {
      return {
        firstName: quote.clientFirstName || '',
        middleName: quote.clientMiddleName || '',
        lastName: quote.clientLastName || '',
        secondLastName: quote.clientSecondLastName || '',
        email: quote.clientEmail || '',
        phone: quote.clientPhone || '',
        dateOfBirth: quote.clientDateOfBirth ? format(new Date(quote.clientDateOfBirth), 'yyyy-MM-dd') : '',
        ssn: normalizeSSN(quote.clientSsn),
        gender: quote.clientGender || '',
        isApplicant: quote.clientIsApplicant ?? true,
        tobaccoUser: quote.clientTobaccoUser ?? false,
        preferredLanguage: quote.clientPreferredLanguage || '',
        countryOfBirth: quote.clientCountryOfBirth || '',
        maritalStatus: quote.clientMaritalStatus || '',
        weight: quote.clientWeight || '',
        height: quote.clientHeight || '',
        // Income fields (placeholders for now - will be fetched from quote_member_income table)
        employerName: '',
        employerPhone: '',
        position: '',
        annualIncome: '',
        incomeFrequency: 'annually',
        selfEmployed: false,
        // Immigration fields (placeholders for now - will be fetched from quote_member_immigration table)
        immigrationStatus: '',
        naturalizationNumber: '',
        uscisNumber: '',
        immigrationStatusCategory: '',
      };
    } else if (memberType === 'spouse' && memberIndex !== undefined) {
      const spouse = quote.spouses?.[memberIndex];
      return spouse ? {
        ...spouse,
        ssn: normalizeSSN(spouse.ssn),
        dateOfBirth: spouse.dateOfBirth ? format(new Date(spouse.dateOfBirth), 'yyyy-MM-dd') : '',
        // Income fields defaults
        employerName: '',
        employerPhone: '',
        position: '',
        annualIncome: '',
        incomeFrequency: 'annually',
        selfEmployed: false,
        // Immigration fields defaults
        immigrationStatus: '',
        naturalizationNumber: '',
        uscisNumber: '',
        immigrationStatusCategory: '',
      } : null;
    } else if (memberType === 'dependent' && memberIndex !== undefined) {
      const dependent = quote.dependents?.[memberIndex];
      return dependent ? {
        ...dependent,
        ssn: normalizeSSN(dependent.ssn),
        dateOfBirth: dependent.dateOfBirth ? format(new Date(dependent.dateOfBirth), 'yyyy-MM-dd') : '',
        // Income fields defaults
        employerName: '',
        employerPhone: '',
        position: '',
        annualIncome: '',
        incomeFrequency: 'annually',
        selfEmployed: false,
        // Immigration fields defaults
        immigrationStatus: '',
        naturalizationNumber: '',
        uscisNumber: '',
        immigrationStatusCategory: '',
      } : null;
    }
    return null;
  }, [quote?.id, memberType, memberIndex]); // Only depend on IDs, not complete objects
  
  const editForm = useForm({
    resolver: zodResolver(editMemberSchema),
    defaultValues: memberData || {},
  });

  const prevOpenRef = useRef(false);
  const prevMemberRef = useRef<string>('');
  
  // Simplified reset logic - only reset on opening transition (false -> true)
  useEffect(() => {
    const isOpening = open && !prevOpenRef.current;
    if (isOpening && memberData) {
      editForm.reset(memberData);
    }
    prevOpenRef.current = open;
  }, [open]); // ONLY depend on open, NOT on memberData

  // Reset form when navigating between members
  useEffect(() => {
    if (open && memberData) {
      const memberKey = `${memberType}-${memberIndex ?? 'primary'}`;
      if (memberKey !== prevMemberRef.current) {
        editForm.reset(memberData);
        setShowEditSsn(false); // Reset SSN visibility when changing members
        prevMemberRef.current = memberKey;
      }
    }
  }, [open, memberType, memberIndex, memberData, editForm])

  const handleSave = async (data: z.infer<typeof editMemberSchema>) => {
    console.log('[EditMemberSheet] handleSave called with data:', data);
    console.log('[EditMemberSheet] Form errors:', editForm.formState.errors);
    
    // Close any open popovers
    setCountryPopoverOpen(false);
    
    // Step 1: Save basic data to JSON columns (legacy model)
    if (memberType === 'primary') {
      onSave({
        clientFirstName: data.firstName,
        clientMiddleName: data.middleName,
        clientLastName: data.lastName,
        clientSecondLastName: data.secondLastName,
        clientEmail: data.email,
        clientPhone: data.phone,
        clientDateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        clientSsn: normalizeSSN(data.ssn),
        clientGender: data.gender,
        clientIsApplicant: data.isApplicant,
        clientTobaccoUser: data.tobaccoUser,
        clientPreferredLanguage: data.preferredLanguage,
        clientCountryOfBirth: data.countryOfBirth,
        clientMaritalStatus: data.maritalStatus,
        clientWeight: data.weight,
        clientHeight: data.height,
      });
    } else if (memberType === 'spouse') {
      const updatedSpouses = [...(quote.spouses || [])];
      updatedSpouses[memberIndex!] = {
        ...data,
        ssn: normalizeSSN(data.ssn),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      };
      onSave({ spouses: updatedSpouses });
    } else if (memberType === 'dependent') {
      const updatedDependents = [...(quote.dependents || [])];
      updatedDependents[memberIndex!] = {
        ...data,
        ssn: normalizeSSN(data.ssn),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      };
      onSave({ dependents: updatedDependents });
    }
    
    // Step 2: Sync to normalized tables (income, immigration)
    try {
      console.log('[EditMemberSheet] Starting to save normalized data...');
      
      // Ensure member exists in quote_members table and get memberId
      const ensureResponse = await fetch(`/api/quotes/${quote.id}/ensure-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: memberType === 'primary' ? 'client' : memberType,
          memberData: {
            firstName: data.firstName,
            middleName: data.middleName || null,
            lastName: data.lastName,
            secondLastName: data.secondLastName || null,
            email: data.email || null,
            phone: data.phone || null,
            dateOfBirth: data.dateOfBirth || null, // Send as string, backend will convert
            ssn: normalizeSSN(data.ssn) || null,
            gender: data.gender || null,
            isApplicant: data.isApplicant || false,
            tobaccoUser: data.tobaccoUser || false,
            preferredLanguage: data.preferredLanguage || null,
            countryOfBirth: data.countryOfBirth || null,
            maritalStatus: data.maritalStatus || null,
            weight: data.weight || null,
            height: data.height || null,
            relation: memberType === 'dependent' ? (data.relation || null) : undefined,
          },
        }),
      });
      
      if (!ensureResponse.ok) {
        console.error('[EditMemberSheet] Failed to ensure member:', await ensureResponse.text());
        onOpenChange(false); // Close sheet even if this fails
        return;
      }
      
      const { memberId } = await ensureResponse.json();
      console.log('[EditMemberSheet] Member ensured, ID:', memberId);
      
      // Step 3: Save income data if present
      if (data.annualIncome || data.employerName || data.employerPhone || data.position) {
        console.log('[EditMemberSheet] Saving income data...', {
          annualIncome: data.annualIncome,
          employerName: data.employerName,
        });
        
        const incomeResponse = await fetch(`/api/quotes/members/${memberId}/income`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            employerName: data.employerName || null,
            employerPhone: data.employerPhone || null,
            position: data.position || null,
            annualIncome: data.annualIncome || null,
            incomeFrequency: data.incomeFrequency || 'annually',
            selfEmployed: data.selfEmployed || false,
          }),
        });
        
        if (incomeResponse.ok) {
          console.log('[EditMemberSheet] Income saved successfully');
        } else {
          console.error('[EditMemberSheet] Failed to save income:', await incomeResponse.text());
        }
      }
      
      // Step 4: Save immigration data if present
      if (data.immigrationStatus || data.uscisNumber || data.naturalizationNumber) {
        console.log('[EditMemberSheet] Saving immigration data...');
        
        const immigrationResponse = await fetch(`/api/quotes/members/${memberId}/immigration`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            immigrationStatus: data.immigrationStatus || null,
            uscisNumber: data.uscisNumber || null,
            naturalizationNumber: data.naturalizationNumber || null,
            immigrationStatusCategory: data.immigrationStatusCategory || null,
          }),
        });
        
        if (immigrationResponse.ok) {
          console.log('[EditMemberSheet] Immigration saved successfully');
        } else {
          console.error('[EditMemberSheet] Failed to save immigration:', await immigrationResponse.text());
        }
      }
      
      console.log('[EditMemberSheet] All data saved, closing sheet');
      // Close the sheet after all async operations complete
      onOpenChange(false);
    } catch (error) {
      console.error('[EditMemberSheet] Error saving member data:', error);
      // Close sheet even if there's an error
      onOpenChange(false);
    }
  };

  const [showEditSsn, setShowEditSsn] = useState(false);
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);

  // Reset SSN visibility when Sheet closes
  useEffect(() => {
    if (!open) {
      setShowEditSsn(false);
    }
  }, [open]);

  // Handle revealing SSN - fetch from backend if masked, otherwise toggle visibility
  const handleRevealSSN = async () => {
    const currentSSN = editForm.getValues('ssn');
    const digits = normalizeSSN(currentSSN);
    const isIncomplete = digits.length < 9; // SSN is masked/incomplete if less than 9 digits
    
    if (isIncomplete && !showEditSsn) {
      // Fetch the full SSN from backend with ?reveal=true
      try {
        const response = await fetch(`/api/quotes/${quote.id}?reveal=true`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch revealed data');
        }
        
        const data = await response.json();
        
        // Update the SSN in the form with the revealed value (9 digits)
        if (memberType === 'primary' && data.quote.clientSsn) {
          const revealedSSN = normalizeSSN(data.quote.clientSsn);
          console.log('[SSN Reveal] Primary - Setting revealed SSN:', revealedSSN.length, 'digits');
          editForm.setValue('ssn', revealedSSN);
        } else if (memberType === 'spouse' && memberIndex !== undefined && data.quote.spouses?.[memberIndex]?.ssn) {
          const revealedSSN = normalizeSSN(data.quote.spouses[memberIndex].ssn);
          console.log('[SSN Reveal] Spouse - Setting revealed SSN:', revealedSSN.length, 'digits');
          editForm.setValue('ssn', revealedSSN);
        } else if (memberType === 'dependent' && memberIndex !== undefined && data.quote.dependents?.[memberIndex]?.ssn) {
          const revealedSSN = normalizeSSN(data.quote.dependents[memberIndex].ssn);
          console.log('[SSN Reveal] Dependent - Setting revealed SSN:', revealedSSN.length, 'digits');
          editForm.setValue('ssn', revealedSSN);
        }
        
        setShowEditSsn(true);
      } catch (error) {
        console.error('[SSN Reveal] Failed to reveal SSN:', error);
      }
    } else {
      // Normal toggle visibility (SSN is already complete)
      setShowEditSsn(prev => !prev);
    }
  };

  if (!memberData) return null;

  // Calculate all members for navigation
  const totalSpouses = quote.spouses?.length || 0;
  const totalDependents = quote.dependents?.length || 0;
  const allMembers = [
    { type: 'primary' as const, index: undefined, name: `${quote.clientFirstName} ${quote.clientLastName}` },
    ...(quote.spouses || []).map((s, i) => ({ 
      type: 'spouse' as const, 
      index: i, 
      name: `${s.firstName} ${s.lastName}` 
    })),
    ...(quote.dependents || []).map((d, i) => ({ 
      type: 'dependent' as const, 
      index: i, 
      name: `${d.firstName} ${d.lastName}` 
    })),
  ];

  const currentMemberIndex = allMembers.findIndex(m => 
    m.type === memberType && m.index === memberIndex
  );

  const hasPrevious = currentMemberIndex > 0;
  const hasNext = currentMemberIndex < allMembers.length - 1;

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentMemberIndex - 1 : currentMemberIndex + 1;
    if (newIndex >= 0 && newIndex < allMembers.length) {
      const newMember = allMembers[newIndex];
      onMemberChange(newMember.type, newMember.index);
    }
  };

  const getMemberLabel = () => {
    if (memberType === 'primary') return 'Primary Applicant';
    if (memberType === 'spouse') return `Spouse ${(memberIndex || 0) + 1}`;
    return `Dependent ${(memberIndex || 0) + 1}`;
  };

  const memberName = `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || 'Unnamed';

  return (
    <Sheet 
      open={open} 
      onOpenChange={(isOpen) => {
        // Only allow closing the sheet, never opening from here
        if (!isOpen && !isPending) {
          onOpenChange(false);
        }
      }}
    >
      <SheetContent 
        className="w-full sm:max-w-2xl flex flex-col p-0" 
        side="right"
      >
        <div className="flex flex-col gap-3 p-6 border-b">
          {/* Header with title and member info */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-lg">{memberName}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-xs font-medium">
                  {memberType === 'primary' && <User className="h-3 w-3" />}
                  {memberType === 'spouse' && <Users className="h-3 w-3" />}
                  {memberType === 'dependent' && <Users className="h-3 w-3" />}
                  {getMemberLabel()}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">
                  Member {currentMemberIndex + 1} of {allMembers.length}
                </span>
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save"
                onClick={editForm.handleSubmit(handleSave)}
              >
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {/* Navigation buttons */}
          {allMembers.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleNavigate('prev')}
                disabled={!hasPrevious || isPending}
                className="flex-1"
                data-testid="button-prev-member"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleNavigate('next')}
                disabled={!hasNext || isPending}
                className="flex-1"
                data-testid="button-next-member"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(handleSave)} className="flex flex-col flex-1 min-h-0">
            <Tabs defaultValue="basic" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mb-4 mx-4 mt-4">
                <TabsTrigger value="basic" className="text-xs">
                  <User className="h-4 w-4 mr-1" />
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="income" className="text-xs">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Income
                </TabsTrigger>
                <TabsTrigger value="immigration" className="text-xs">
                  <Plane className="h-4 w-4 mr-1" />
                  Immigration
                </TabsTrigger>
                <TabsTrigger value="documents" className="text-xs">
                  <FileText className="h-4 w-4 mr-1" />
                  Documents
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Basic Information */}
              <TabsContent value="basic" className="flex-1 overflow-y-auto space-y-6 p-4">
                <div className="grid grid-cols-2 gap-4">
              {/* First Name - Middle Name */}
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-middlename" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Last Name - Second Last Name */}
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="secondLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Second Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-secondlastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* DOB - SSN */}
              <FormField
                control={editForm.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-dob" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="ssn"
                render={({ field }) => {
                  // Detect if there's any SSN (masked or complete)
                  const hasSSN = field.value && (normalizeSSN(field.value).length >= 4 || field.value.includes('***'));
                  return (
                    <FormItem>
                      <FormLabel>SSN *</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            onChange={(e) => {
                              // Extract only digits - save WITHOUT formatting
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                              field.onChange(digits);
                            }}
                            value={displaySSN(field.value, showEditSsn)}
                            className={hasSSN ? "pr-10" : ""}
                            autoComplete="off"
                            placeholder="XXX-XX-XXXX"
                            data-testid="input-ssn"
                          />
                        </FormControl>
                        {hasSSN && (
                          <div
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRevealSSN();
                            }}
                            className="absolute right-0 top-0 h-full flex items-center px-3 cursor-pointer hover:bg-accent/50 rounded-r-md transition-colors"
                            role="button"
                            tabIndex={-1}
                            aria-label={showEditSsn ? "Hide SSN" : "Show SSN"}
                            data-testid="button-ssn-visibility"
                          >
                            {showEditSsn ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Phone - Email */}
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone {memberType === 'primary' && '*'}</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                        data-testid="input-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email {memberType === 'primary' && '*'}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Gender - Marital Status */}
              <FormField
                control={editForm.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-gender">
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
                control={editForm.control}
                name="maritalStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marital Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-maritalstatus">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                        <SelectItem value="separated">Separated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Country of Birth - Preferred Language */}
              <FormField
                control={editForm.control}
                name="countryOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Country of Birth</FormLabel>
                    <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="justify-between font-normal"
                            data-testid="select-countryofbirth"
                          >
                            {field.value || "Select country"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search country..." />
                          <CommandList>
                            <CommandEmpty>No country found.</CommandEmpty>
                            <CommandGroup>
                              {COUNTRIES.map((country) => (
                                <CommandItem
                                  key={country}
                                  value={country}
                                  onSelect={() => {
                                    field.onChange(country);
                                    setCountryPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      field.value === country ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {country}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Language</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-preferredlanguage">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Weight - Height */}
              <FormField
                control={editForm.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (Lbs)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" placeholder="150" data-testid="input-weight" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (Ft)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="5'10&quot;" data-testid="input-height" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Relation (only for dependents) */}
              {memberType === 'dependent' && (
                <FormField
                  control={editForm.control}
                  name="relation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relation *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-relation">
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
              )}
                </div>
                
                <div className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="isApplicant"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-isapplicant"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Is Applicant</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="tobaccoUser"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-tobacco"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Tobacco User</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 2: Income & Employment */}
              <TabsContent value="income" className="flex-1 overflow-y-auto space-y-4 p-4">
                {/* Employment Information Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Employment Information</h3>
                  </div>
                  
                <div className="grid grid-cols-2 gap-4">
                  {/* Employer Name */}
                  <FormField
                    control={editForm.control}
                    name="employerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Employer or company name" data-testid="input-employer-name" className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Position / Occupation */}
                  <FormField
                    control={editForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position / Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Job title or occupation" data-testid="input-position" className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Employer Phone */}
                  <FormField
                    control={editForm.control}
                    name="employerPhone"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Employer Contact</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                            placeholder="(999) 999-9999"
                            data-testid="input-employer-phone"
                            className="bg-background"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">HR or company contact number</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Self Employed Checkbox */}
                  <FormField
                    control={editForm.control}
                    name="selfEmployed"
                    render={({ field }) => (
                      <FormItem className="col-span-2 flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 bg-muted/30">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-self-employed"
                          />
                        </FormControl>
                        <div className="space-y-0.5 leading-none">
                          <FormLabel className="cursor-pointer font-medium">Self-employed or independent contractor</FormLabel>
                          <p className="text-xs text-muted-foreground">Check if you own your own business or work as a freelancer</p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                </div>

                {/* Income Details Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Income Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">

                  {/* Income Frequency */}
                  <FormField
                    control={editForm.control}
                    name="incomeFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pay Period <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "annually"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-income-frequency" className="bg-background">
                              <SelectValue placeholder="How often are you paid?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="annually">Annually (1 time/year)</SelectItem>
                            <SelectItem value="monthly">Monthly (12 times/year)</SelectItem>
                            <SelectItem value="biweekly">Biweekly (26 times/year)</SelectItem>
                            <SelectItem value="weekly">Weekly (52 times/year)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Income Amount */}
                  <FormField
                    control={editForm.control}
                    name="annualIncome"
                    render={({ field }) => {
                      const frequency = editForm.watch('incomeFrequency') || 'annually';
                      const frequencyLabel = frequency === 'annually' ? 'Annual' : frequency === 'weekly' ? 'Weekly' : frequency === 'biweekly' ? 'Biweekly' : 'Monthly';
                      
                      const calculateAnnualIncome = (amount: string) => {
                        const num = parseFloat(amount || '0');
                        if (isNaN(num) || num <= 0) return '0';
                        
                        switch (frequency) {
                          case 'annually':
                            return amount; // No calculation needed for annual
                          case 'weekly':
                            return (num * 52).toFixed(2);
                          case 'biweekly':
                            return (num * 26).toFixed(2);
                          case 'monthly':
                            return (num * 12).toFixed(2);
                          default:
                            return amount;
                        }
                      };
                      
                      const annualAmount = calculateAnnualIncome(field.value || '0');
                      const showAnnualEquivalent = field.value && parseFloat(field.value) > 0 && frequency !== 'annually';
                      
                      return (
                        <FormItem>
                          <FormLabel>{frequencyLabel} Income <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input 
                                {...field}
                                type="text"
                                placeholder="0.00" 
                                data-testid="input-income-amount"
                                className="pl-7 bg-background"
                                onChange={(e) => {
                                  let value = e.target.value;
                                  // Remove all non-numeric characters except decimal point
                                  value = value.replace(/[^\d.]/g, '');
                                  
                                  // Ensure only one decimal point
                                  const parts = value.split('.');
                                  if (parts.length > 2) {
                                    value = parts[0] + '.' + parts.slice(1).join('');
                                  }
                                  
                                  // Limit to 2 decimal places
                                  if (parts.length === 2 && parts[1].length > 2) {
                                    value = parts[0] + '.' + parts[1].substring(0, 2);
                                  }
                                  
                                  field.onChange(value);
                                }}
                                onBlur={(e) => {
                                  let value = e.target.value;
                                  if (value && value !== '') {
                                    const num = parseFloat(value);
                                    if (!isNaN(num)) {
                                      // Always format to 2 decimals on blur
                                      field.onChange(num.toFixed(2));
                                    }
                                  }
                                  field.onBlur();
                                }}
                              />
                            </div>
                          </FormControl>
                          {showAnnualEquivalent && (
                            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                              <p className="text-xs font-medium text-primary">
                                Annual Equivalent: ${parseFloat(annualAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>
                </div>
              </TabsContent>

              {/* Tab 3: Immigration Status */}
              <TabsContent value="immigration" className="flex-1 overflow-y-auto space-y-4 p-4">
                {/* Primary Status Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Immigration Status</h3>
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="immigrationStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-immigration-status" className="bg-background">
                              <SelectValue placeholder="Select immigration status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="asylum">Asylum</SelectItem>
                            <SelectItem value="citizen">U.S. Citizen</SelectItem>
                            <SelectItem value="humanitarian_parole">Humanitarian Parole</SelectItem>
                            <SelectItem value="resident">Permanent Resident</SelectItem>
                            <SelectItem value="temporary_protected_status">Temporary Protected Status (TPS)</SelectItem>
                            <SelectItem value="work_authorization">Work Authorization</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {editForm.watch('immigrationStatus') === 'citizen' && (
                    <FormField
                      control={editForm.control}
                      name="naturalizationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <span>Naturalization Certificate #</span>
                          </FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter certificate number" data-testid="input-naturalization-number" className="bg-background" />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">Found on naturalization certificate</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={editForm.control}
                    name="immigrationStatusCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Category</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., I-94, Parole, etc." data-testid="input-immigration-category" className="bg-background" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Specify the document or category type</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Documentation Numbers Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Official Numbers</h3>
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="uscisNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>USCIS Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="9-digit number (optional)" data-testid="input-uscis-number" className="bg-background font-mono" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Alien Registration Number or USCIS #</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 4: Documents */}
              <TabsContent value="documents" className="flex-1 overflow-y-auto space-y-6 p-4">
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Document #</TableHead>
                          <TableHead>Issued date</TableHead>
                          <TableHead>Exp date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Social Security (SSN) */}
                        <TableRow>
                          <TableCell className="font-medium">Social Security (SSN)</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">xxx-xx-2044</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" data-testid="button-doc-ssn-actions">
                                  Edit
                                  <ChevronDown className="h-4 w-4 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit details</DropdownMenuItem>
                                <DropdownMenuItem>Upload document</DropdownMenuItem>
                                <DropdownMenuItem>View document</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Green card */}
                        <TableRow>
                          <TableCell className="font-medium">Green card</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" data-testid="button-doc-greencard-actions">
                                  Edit
                                  <ChevronDown className="h-4 w-4 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit details</DropdownMenuItem>
                                <DropdownMenuItem>Upload document</DropdownMenuItem>
                                <DropdownMenuItem>View document</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Work permit */}
                        <TableRow>
                          <TableCell className="font-medium">Work permit</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">IOE9094849121</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">08/09/2024</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">07/17/2026</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" data-testid="button-doc-workpermit-actions">
                                  Edit
                                  <ChevronDown className="h-4 w-4 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit details</DropdownMenuItem>
                                <DropdownMenuItem>Upload document</DropdownMenuItem>
                                <DropdownMenuItem>View document</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Passport */}
                        <TableRow>
                          <TableCell className="font-medium">Passport</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">xxxxx5920</span>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" data-testid="button-doc-passport-actions">
                                  Edit
                                  <ChevronDown className="h-4 w-4 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit details</DropdownMenuItem>
                                <DropdownMenuItem>Upload document</DropdownMenuItem>
                                <DropdownMenuItem>View document</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Driver license */}
                        <TableRow>
                          <TableCell className="font-medium">Driver license</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-muted-foreground">-</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" data-testid="button-doc-license-actions">
                                  Edit
                                  <ChevronDown className="h-4 w-4 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Edit details</DropdownMenuItem>
                                <DropdownMenuItem>Upload document</DropdownMenuItem>
                                <DropdownMenuItem>View document</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

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
  const [showSsn, setShowSsn] = useState(false);
  
  // SSN visibility states for wizard
  const [showClientSsn, setShowClientSsn] = useState(false);
  const [showSpouseSsn, setShowSpouseSsn] = useState<Record<number, boolean>>({});
  const [showDependentSsn, setShowDependentSsn] = useState<Record<number, boolean>>({});
  
  // Edit states
  const [editingMember, setEditingMember] = useState<{ type: 'primary' | 'spouse' | 'dependent', index?: number } | null>(null);
  const [editingAddresses, setEditingAddresses] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(false);
  const [editingMedicines, setEditingMedicines] = useState(false);
  
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

  const form = useForm<z.infer<typeof completeQuoteSchema>>({
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
        clientSsn: normalizeSSN(data.clientSsn),
        spouses: data.spouses?.map((spouse) => ({
          ...spouse,
          ssn: normalizeSSN(spouse.ssn),
        })),
        dependents: data.dependents?.map((dependent) => ({
          ...dependent,
          ssn: normalizeSSN(dependent.ssn),
        })),
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

  const updateQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: any }) => {
      return apiRequest("PATCH", `/api/quotes/${quoteId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Quote updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update quote",
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
      selfEmployed: false,
      employerName: "",
      employerPhone: "",
      position: "",
      annualIncome: "",
      incomeFrequency: "monthly",
      immigrationStatus: "",
      naturalizationNumber: "",
      uscisNumber: "",
      immigrationStatusCategory: "",
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
      selfEmployed: false,
      employerName: "",
      employerPhone: "",
      position: "",
      annualIncome: "",
      incomeFrequency: "monthly",
      immigrationStatus: "",
      naturalizationNumber: "",
      uscisNumber: "",
      immigrationStatusCategory: "",
    });
  };

  const agents = agentsData?.users || [];
  const allQuotes = quotesData?.quotes || [];
  
  // Detect if we're viewing a specific quote
  const quoteId = params?.id;
  const isViewingQuote = !!quoteId && quoteId !== "new";
  const viewingQuote = (isViewingQuote ? allQuotes.find(q => q.id === quoteId) : null) as QuoteWithArrays | null | undefined;
  
  // Fetch total household income from all family members
  const { data: householdIncomeData } = useQuery({
    queryKey: ['/api/quotes', quoteId, 'household-income'],
    enabled: isViewingQuote && !!viewingQuote?.id,
  });
  
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

  // Edit Addresses Sheet Component
  function EditAddressesSheet({ open, onOpenChange, quote, onSave, isPending }: any) {
    const addressSchema = z.object({
      street: z.string().min(1, "Street address is required"),
      addressLine2: z.string().optional(),
      city: z.string().min(1, "City is required"),
      state: z.string().min(1, "State is required"),
      postalCode: z.string().min(1, "Postal code is required"),
      county: z.string().optional(),
    });

    const addressForm = useForm({
      resolver: zodResolver(addressSchema),
      defaultValues: {
        street: quote?.street || '',
        addressLine2: quote?.addressLine2 || '',
        city: quote?.city || '',
        state: quote?.state || '',
        postalCode: quote?.postalCode || '',
        county: quote?.county || '',
      },
    });

    useEffect(() => {
      if (quote) {
        addressForm.reset({
          street: quote.street || '',
          addressLine2: quote.addressLine2 || '',
          city: quote.city || '',
          state: quote.state || '',
          postalCode: quote.postalCode || '',
          county: quote.county || '',
        });
      }
    }, [quote]);

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Edit Addresses</SheetTitle>
            <SheetDescription>
              Update the billing and shipping addresses for this quote
            </SheetDescription>
          </SheetHeader>
          <Form {...addressForm}>
            <form onSubmit={addressForm.handleSubmit(onSave)} className="space-y-6 py-6">
              <FormField
                control={addressForm.control}
                name="street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address *</FormLabel>
                    <FormControl>
                      <GooglePlacesAddressAutocomplete
                        value={field.value}
                        onChange={(value: string) => {
                          field.onChange(value);
                        }}
                        onAddressSelect={(address) => {
                          field.onChange(address.street);
                          addressForm.setValue('city', address.city || '');
                          addressForm.setValue('state', address.state || '');
                          addressForm.setValue('postalCode', address.postalCode || '');
                          addressForm.setValue('county', address.county || '');
                        }}
                        data-testid="input-street"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addressForm.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apt, Suite, Unit, etc.</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-addressline2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addressForm.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addressForm.control}
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
                  control={addressForm.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-postalcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addressForm.control}
                  name="county"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>County</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-county" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    );
  }

  // Edit Payment Sheet Component
  function EditPaymentSheet({ open, onOpenChange, quote, onSave, isPending }: any) {
    const paymentSchema = z.object({
      recurrentPayment: z.boolean().default(true),
      firstPaymentDate: z.string().optional(),
      preferredPaymentDay: z.string().optional(),
    });

    const paymentForm = useForm({
      resolver: zodResolver(paymentSchema),
      defaultValues: {
        recurrentPayment: true,
        firstPaymentDate: quote?.effectiveDate ? format(new Date(quote.effectiveDate), 'yyyy-MM-dd') : '',
        preferredPaymentDay: '1',
      },
    });

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Edit Payment Information</SheetTitle>
            <SheetDescription>
              Configure payment schedule and preferences for this quote
            </SheetDescription>
          </SheetHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit((data) => {
              onSave({
                effectiveDate: data.firstPaymentDate ? new Date(data.firstPaymentDate) : undefined,
              });
            })} className="space-y-6 py-6">
              <FormField
                control={paymentForm.control}
                name="recurrentPayment"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Recurrent Payment</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable automatic recurring payments
                      </div>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-recurrent"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="firstPaymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-firstpaymentdate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="preferredPaymentDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Payment Day (1-31)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-paymentday">
                          <SelectValue placeholder="Select day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    );
  }

  // Edit Notes Sheet Component
  function EditNotesSheet({ open, onOpenChange, quote, onSave, isPending }: any) {
    const notesSchema = z.object({
      notes: z.string().optional(),
    });

    const notesForm = useForm({
      resolver: zodResolver(notesSchema),
      defaultValues: {
        notes: quote?.notes || '',
      },
    });

    useEffect(() => {
      if (quote) {
        notesForm.reset({ notes: quote.notes || '' });
      }
    }, [quote]);

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Edit Notes or Comments</SheetTitle>
            <SheetDescription>
              Add or update internal notes about this quote
            </SheetDescription>
          </SheetHeader>
          <Form {...notesForm}>
            <form onSubmit={notesForm.handleSubmit(onSave)} className="space-y-6 py-6">
              <FormField
                control={notesForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add any notes or comments about this quote..."
                        className="min-h-[200px]"
                        data-testid="textarea-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    );
  }

  // Edit Doctor Sheet Component
  function EditDoctorSheet({ open, onOpenChange, quote, onSave, isPending }: any) {
    const doctorSchema = z.object({
      doctorInfo: z.string().optional(),
    });

    const doctorForm = useForm({
      resolver: zodResolver(doctorSchema),
      defaultValues: {
        doctorInfo: '',
      },
    });

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Edit Primary Doctor Information</SheetTitle>
            <SheetDescription>
              Record primary care physician details for this applicant
            </SheetDescription>
          </SheetHeader>
          <Form {...doctorForm}>
            <form onSubmit={doctorForm.handleSubmit((data) => {
              const currentNotes = quote?.notes || '';
              const doctorSection = `\n\n--- Primary Doctor Information ---\n${data.doctorInfo}`;
              onSave({ notes: currentNotes + doctorSection });
            })} className="space-y-6 py-6">
              <FormField
                control={doctorForm.control}
                name="doctorInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor Information</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Add primary doctor information..."
                        className="min-h-[200px]"
                        data-testid="textarea-doctor"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    );
  }

  // Edit Medicines Sheet Component
  function EditMedicinesSheet({ open, onOpenChange, quote, onSave, isPending }: any) {
    const medicinesSchema = z.object({
      medicinesInfo: z.string().optional(),
    });

    const medicinesForm = useForm({
      resolver: zodResolver(medicinesSchema),
      defaultValues: {
        medicinesInfo: '',
      },
    });

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Edit Medicines Needed</SheetTitle>
            <SheetDescription>
              List current medications and prescriptions for this applicant
            </SheetDescription>
          </SheetHeader>
          <Form {...medicinesForm}>
            <form onSubmit={medicinesForm.handleSubmit((data) => {
              const currentNotes = quote?.notes || '';
              const medicinesSection = `\n\n--- Medicines Needed ---\n${data.medicinesInfo}`;
              onSave({ notes: currentNotes + medicinesSection });
            })} className="space-y-6 py-6">
              <FormField
                control={medicinesForm.control}
                name="medicinesInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medicines Information</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="List any medicines needed..."
                        className="min-h-[200px]"
                        data-testid="textarea-medicines"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-save"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    );
  }

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

    // Calculate formatted income
    const totalHouseholdIncome = householdIncomeData?.totalIncome || 0;
    const formattedIncome = totalHouseholdIncome > 0 
      ? new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(totalHouseholdIncome)
      : '-';

    return (
      <div className="h-full overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Sidebar Summary */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-background p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Summary</h2>
              
              <div className="space-y-3">
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
                  <label className="text-xs text-muted-foreground">Carrier</label>
                  <p className="text-sm font-medium">{product?.name || viewingQuote.productType}</p>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Effective date</label>
                  <p className="text-sm">{format(new Date(viewingQuote.effectiveDate), "MM/dd/yyyy")}</p>
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
                  <span className="text-xs text-muted-foreground">Total annual income</span>
                  <span className="text-xs font-semibold">{formattedIncome}</span>
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
                          {viewingQuote.status === 'active' ? (
                            <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                              Active Quote
                            </Badge>
                          ) : viewingQuote.status === 'draft' ? (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              Draft
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {viewingQuote.status || 'Draft'}
                            </Badge>
                          )}
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
                  <div className="flex gap-2">
                    <Button variant="default" size="sm" data-testid="button-search-plans">
                      Search plans
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-options">
                          Options
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          Block Policy
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Bell className="h-4 w-4 mr-2" />
                          New Reminder
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" />
                          Print Policy
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <X className="h-4 w-4 mr-2" />
                          Cancel Policy
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
                          <label className="text-xs font-medium text-foreground/60">Primary Holder</label>
                          <p className="text-sm font-semibold mt-0.5">
                            {viewingQuote.clientFirstName} {viewingQuote.clientMiddleName} {viewingQuote.clientLastName} {viewingQuote.clientSecondLastName}
                          </p>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="default" className="text-xs bg-blue-600 hover:bg-blue-700">
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
                          <label className="text-xs font-medium text-foreground/60">Email</label>
                          <p className="text-sm mt-0.5">{viewingQuote.clientEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-foreground/60">Phone</label>
                          <p className="text-sm mt-0.5">{viewingQuote.clientPhone}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-foreground/60">Date of Birth</label>
                          <p className="text-sm mt-0.5">
                            {viewingQuote.clientDateOfBirth ? format(new Date(viewingQuote.clientDateOfBirth), "MMM dd, yyyy") : 'N/A'}
                            {viewingQuote.clientDateOfBirth && (
                              <span className="text-foreground/60 ml-2">
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
                          <label className="text-xs font-medium text-foreground/60">SSN</label>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm font-mono">
                              {viewingQuote.clientSsn 
                                ? (showSsn ? viewingQuote.clientSsn : '***-**-' + viewingQuote.clientSsn.slice(-4)) 
                                : 'N/A'}
                            </p>
                            {viewingQuote.clientSsn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setShowSsn(!showSsn)}
                                data-testid="button-toggle-ssn"
                              >
                                {showSsn ? (
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pb-3 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg mt-0.5">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-medium text-foreground/60">Gender</label>
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
                          <label className="text-xs font-medium text-foreground/60">Street Address</label>
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
                          <label className="text-xs font-medium text-foreground/60">Location</label>
                          <p className="text-sm mt-0.5">
                            {viewingQuote.city}, {viewingQuote.state} {viewingQuote.postalCode}
                            {viewingQuote.county && (
                              <span className="block text-xs text-foreground/60 mt-0.5">{viewingQuote.county} County</span>
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
                        <DollarSign className="h-3.5 w-3.5 text-foreground/60" />
                      </div>
                      <CardTitle className="text-xs font-medium text-foreground/70">Monthly Premium</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-foreground/60">Pending</p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/10 border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded">
                        <PiggyBank className="h-3.5 w-3.5 text-foreground/60" />
                      </div>
                      <CardTitle className="text-xs font-medium text-foreground/70">Savings Total</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-foreground/60">Pending</p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/10 border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-muted rounded">
                        <FileText className="h-3.5 w-3.5 text-foreground/60" />
                      </div>
                      <CardTitle className="text-xs font-medium text-foreground/70">Original Cost</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold text-foreground/60">Pending</p>
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

              {/* Family Members Section - Compact Table */}
              <Card className="bg-accent/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
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
                <CardContent className="p-0">
                  <div className="border-t">
                    {/* Primary Applicant */}
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border-b hover-elevate">
                      <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                          {viewingQuote.clientFirstName?.[0]}{viewingQuote.clientLastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-3">
                          <p className="font-semibold text-sm truncate">
                            {viewingQuote.clientFirstName} {viewingQuote.clientLastName}
                          </p>
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant="default" className="text-xs h-4 px-1.5">Self</Badge>
                            {viewingQuote.clientIsApplicant && (
                              <Badge variant="secondary" className="text-xs h-4 px-1.5">Applicant</Badge>
                            )}
                          </div>
                        </div>
                        <div className="md:col-span-2 text-xs text-muted-foreground">
                          {viewingQuote.clientGender ? viewingQuote.clientGender.charAt(0).toUpperCase() + viewingQuote.clientGender.slice(1) : 'N/A'} • {viewingQuote.clientDateOfBirth ? Math.floor((new Date().getTime() - new Date(viewingQuote.clientDateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} yrs
                        </div>
                        <div className="md:col-span-3 text-xs text-muted-foreground truncate">
                          {viewingQuote.clientPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 inline" />
                              {viewingQuote.clientPhone}
                            </span>
                          )}
                        </div>
                        <div className="md:col-span-3 text-xs text-muted-foreground truncate">
                          {viewingQuote.clientEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 inline" />
                              {viewingQuote.clientEmail}
                            </span>
                          )}
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0" 
                            onClick={() => setEditingMember({ type: 'primary' })}
                            data-testid="button-view-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Spouses */}
                    {viewingQuote.spouses?.map((spouse, index) => (
                      <div key={`spouse-${index}`} className="flex items-center gap-3 p-3 border-b hover-elevate">
                        <Avatar className="h-9 w-9 border-2 border-muted">
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-sm">
                            {spouse.firstName?.[0]}{spouse.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                          <div className="md:col-span-3">
                            <p className="font-semibold text-sm truncate">
                              {spouse.firstName} {spouse.lastName}
                            </p>
                            <div className="flex gap-1 mt-0.5">
                              <Badge variant="outline" className="text-xs h-4 px-1.5">Spouse</Badge>
                              {spouse.isApplicant && (
                                <Badge variant="secondary" className="text-xs h-4 px-1.5">Applicant</Badge>
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-2 text-xs text-muted-foreground">
                            {spouse.gender ? spouse.gender.charAt(0).toUpperCase() + spouse.gender.slice(1) : 'N/A'} • {spouse.dateOfBirth ? Math.floor((new Date().getTime() - new Date(spouse.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} yrs
                          </div>
                          <div className="md:col-span-3 text-xs text-muted-foreground truncate">
                            {spouse.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 inline" />
                                {spouse.phone}
                              </span>
                            )}
                          </div>
                          <div className="md:col-span-3 text-xs text-muted-foreground truncate">
                            {spouse.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3 inline" />
                                {spouse.email}
                              </span>
                            )}
                          </div>
                          <div className="md:col-span-1 flex justify-end">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0" 
                              onClick={() => setEditingMember({ type: 'spouse', index })}
                              data-testid={`button-view-spouse-${index}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Dependents */}
                    {viewingQuote.dependents?.map((dependent, index) => (
                      <div key={`dependent-${index}`} className="flex items-center gap-3 p-3 border-b last:border-b-0 hover-elevate">
                        <Avatar className="h-9 w-9 border-2 border-muted">
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-sm">
                            {dependent.firstName?.[0]}{dependent.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                          <div className="md:col-span-3">
                            <p className="font-semibold text-sm truncate">
                              {dependent.firstName} {dependent.lastName}
                            </p>
                            <div className="flex gap-1 mt-0.5">
                              <Badge variant="outline" className="text-xs h-4 px-1.5">{dependent.relation || 'Dependent'}</Badge>
                              {dependent.isApplicant && (
                                <Badge variant="secondary" className="text-xs h-4 px-1.5">Applicant</Badge>
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-2 text-xs text-muted-foreground">
                            {dependent.gender ? dependent.gender.charAt(0).toUpperCase() + dependent.gender.slice(1) : 'N/A'} • {dependent.dateOfBirth ? Math.floor((new Date().getTime() - new Date(dependent.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} yrs
                          </div>
                          <div className="md:col-span-3 text-xs text-muted-foreground truncate">
                            {dependent.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 inline" />
                                {dependent.phone}
                              </span>
                            )}
                          </div>
                          <div className="md:col-span-3 text-xs text-muted-foreground truncate">
                            {dependent.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3 inline" />
                                {dependent.email}
                              </span>
                            )}
                          </div>
                          <div className="md:col-span-1 flex justify-end">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0" 
                              onClick={() => setEditingMember({ type: 'dependent', index })}
                              data-testid={`button-view-dependent-${index}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Information */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Payment information</CardTitle>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setEditingPayment(true)}
                    data-testid="button-edit-payment"
                  >
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

              {/* Notes or Comments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Notes or comments</CardTitle>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setEditingNotes(true)}
                    data-testid="button-edit-notes"
                  >
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
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setEditingDoctor(true)}
                    data-testid="button-edit-doctor"
                  >
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
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setEditingMedicines(true)}
                    data-testid="button-edit-medicines"
                  >
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

        {/* Edit Sheets */}
        <EditMemberSheet
              open={!!editingMember}
              onOpenChange={(open) => !open && setEditingMember(null)}
              quote={viewingQuote}
              memberType={editingMember?.type}
              memberIndex={editingMember?.index}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
                });
              }}
              isPending={updateQuoteMutation.isPending}
              onMemberChange={(type, index) => {
                setEditingMember({ type, index });
              }}
            />

            <EditAddressesSheet
              open={editingAddresses}
              onOpenChange={setEditingAddresses}
              quote={viewingQuote}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
                }, {
                  onSuccess: () => setEditingAddresses(false)
                });
              }}
              isPending={updateQuoteMutation.isPending}
            />

            <EditPaymentSheet
              open={editingPayment}
              onOpenChange={setEditingPayment}
              quote={viewingQuote}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
                }, {
                  onSuccess: () => setEditingPayment(false)
                });
              }}
              isPending={updateQuoteMutation.isPending}
            />

            <EditNotesSheet
              open={editingNotes}
              onOpenChange={setEditingNotes}
              quote={viewingQuote}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
                }, {
                  onSuccess: () => setEditingNotes(false)
                });
              }}
              isPending={updateQuoteMutation.isPending}
            />

            <EditDoctorSheet
              open={editingDoctor}
              onOpenChange={setEditingDoctor}
              quote={viewingQuote}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
                }, {
                  onSuccess: () => setEditingDoctor(false)
                });
              }}
              isPending={updateQuoteMutation.isPending}
            />

            <EditMedicinesSheet
              open={editingMedicines}
              onOpenChange={setEditingMedicines}
              quote={viewingQuote}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
                }, {
                  onSuccess: () => setEditingMedicines(false)
                });
              }}
              isPending={updateQuoteMutation.isPending}
            />
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
                        <SheetDescription>
                          Apply filters to find specific quotes quickly
                        </SheetDescription>
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
                                <TooltipContent side="right" sideOffset={5} align="center" className="p-3">
                                  <div>
                                    <div className="font-semibold text-sm mb-2 text-center">Agent information</div>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                      <div className="text-left font-medium">Name:</div>
                                      <div className="text-right">{agent?.firstName || 'Unknown'} {agent?.lastName || 'Agent'}</div>
                                      <div className="text-left font-medium">NPN:</div>
                                      <div className="text-right">{agent?.nationalProducerNumber || 'N/A'}</div>
                                      <div className="text-left font-medium">Email:</div>
                                      <div className="text-right">{agent?.email || 'No email'}</div>
                                      <div className="text-left font-medium">Role:</div>
                                      <div className="text-right">{agent?.role || 'N/A'}</div>
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
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                    {quote.clientIsApplicant ? 'Self' : 'Not Applicant'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {quote.clientGender ? quote.clientGender.charAt(0).toUpperCase() + quote.clientGender.slice(1) : 'N/A'}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {quote.city}, {quote.state} {quote.postalCode}
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
                        render={({ field }) => {
                          const selectedAgent = agents.find(a => a.id === field.value);
                          return (
                            <FormItem>
                              <FormLabel>Who is the agent on record for this client? <span className="text-destructive">(required)</span></FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-agent">
                                    {selectedAgent ? (
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={selectedAgent.avatar || undefined} />
                                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                            {selectedAgent.firstName?.[0] || 'A'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span>{selectedAgent.firstName} {selectedAgent.lastName}</span>
                                      </div>
                                    ) : (
                                      <SelectValue placeholder="Select..." />
                                    )}
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {agents.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage src={agent.avatar || undefined} />
                                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                            {agent.firstName?.[0] || 'A'}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span>{agent.firstName} {agent.lastName}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
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
                              <FormLabel>Date of Birth *</FormLabel>
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
                              <FormLabel>SSN *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field}
                                  type="text" 
                                  data-testid="input-client-ssn" 
                                  placeholder="XXX-XX-XXXX"
                                  value={formatSSN(field.value || '')}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                    field.onChange(digits);
                                  }}
                                  autoComplete="off"
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
                              <FormLabel>Email</FormLabel>
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
                              name={`spouses.${index}.firstName` as any}
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
                              name={`spouses.${index}.middleName` as any}
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
                              name={`spouses.${index}.lastName` as any}
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
                              name={`spouses.${index}.secondLastName` as any}
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
                              name={`spouses.${index}.dateOfBirth` as any}
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
                              name={`spouses.${index}.ssn` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>SSN *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="text" 
                                      data-testid={`input-spouse-ssn-${index}`} 
                                      placeholder="XXX-XX-XXXX"
                                      value={formatSSN(field.value || '')}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                        field.onChange(digits);
                                      }}
                                      autoComplete="off"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.gender` as any}
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
                                      value={formatSSN(field.value || '')}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                        field.onChange(digits);
                                      }}
                                      autoComplete="off"
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

                            <div className="hidden md:block"></div>
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
                                    <Input type="email" {...field} placeholder="email@example.com" data-testid={`input-dependent-email-${index}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Additional fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
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
                                    <FormLabel className="cursor-pointer">Is Applicant</FormLabel>
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
                                    <FormLabel className="cursor-pointer">Tobacco User</FormLabel>
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

                {/* Form Navigation */}
                <div className="flex justify-between gap-4 px-8 pb-8 pt-6 border-t sticky bottom-0 bg-background">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || createQuoteMutation.isPending}
                    data-testid="button-back"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={createQuoteMutation.isPending}
                      data-testid="button-next"
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={createQuoteMutation.isPending}
                      data-testid="button-submit"
                    >
                      {createQuoteMutation.isPending ? 'Creating...' : 'Create Quote'}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Edit Member Sheet */}
      <EditMemberSheet
        open={editingMember !== null}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
        quote={viewingQuote}
        memberType={editingMember?.type}
        memberIndex={editingMember?.index}
        onSave={(data) => {
          updateQuoteMutation.mutate({
            quoteId: viewingQuote.id,
            data,
          });
          // Don't close immediately - let handleSave complete async operations first
        }}
        isPending={updateQuoteMutation.isPending}
        onMemberChange={(type, index) => {
          setEditingMember({ type, index });
        }}
      />
    </div>
  );
}
