import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Users, MapPin, FileText, Check, Search, Info, Trash2, Heart, Building2, Shield, Smile, DollarSign, PiggyBank, Plane, Cross, Filter, RefreshCw, ChevronDown, ArrowLeft, ArrowRight, Mail, CreditCard, Phone, Hash, IdCard, Home, Bell, Copy, X, Archive, ChevronsUpDown, Pencil, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User as UserType, type Quote, type QuotePaymentMethod, type InsertPaymentMethod, insertPaymentMethodSchema, type QuoteMember, type QuoteMemberIncome, type QuoteMemberImmigration, type QuoteMemberDocument } from "@shared/schema";
import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format, startOfMonth, addMonths, parseISO } from "date-fns";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import { useTabsState } from "@/hooks/use-tabs-state";
import {
  detectCardType,
  getCardTypeInfo,
  formatCardNumber,
  cleanCardNumber,
  type CardType
} from "@shared/creditCardUtils";

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
  pregnant: boolean;
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
  pregnant: boolean;
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

// Helper to format date for input fields - just returns the yyyy-MM-dd string as-is
const formatDateForInput = (date: string | null | undefined): string => {
  if (!date) return '';
  // Date is already in yyyy-MM-dd format - return as-is
  return date;
};

// Helper to format date for display (converts yyyy-MM-dd to display format like MM/dd/yyyy)
const formatDateForDisplay = (date: string | null | undefined, formatStr: string = "MM/dd/yyyy"): string => {
  if (!date) return '';
  // Append time to avoid timezone issues, then format
  // This ensures the date is treated as-is without timezone conversion
  try {
    return format(parseISO(date + 'T00:00:00'), formatStr);
  } catch (e) {
    return date; // Fallback to original string if parsing fails
  }
};

// Helper to calculate age from yyyy-MM-dd date string
const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
  if (!dateOfBirth) return null;
  try {
    const today = new Date();
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (e) {
    return null;
  }
};

// Normalize SSN to formatted string with hyphens (XXX-XX-XXXX)
// This is how SSN should be stored in database per user requirement
const normalizeSSN = (ssn: string | null | undefined): string => {
  if (!ssn) return '';
  const digits = ssn.replace(/\D/g, '').slice(0, 9);
  
  // Only format if we have 9 digits
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  }
  
  // Return partial formatting for incomplete SSN
  if (digits.length > 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  } else if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  
  return digits;
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
    icon: Smile,
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
  isPrimaryDependent: z.boolean().default(false),
  tobaccoUser: z.boolean().default(false),
  pregnant: z.boolean().default(false),
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
  clientPregnant: z.boolean().default(false),
  clientSsn: z.string().min(9, "SSN is required (9 digits)"),
  // Additional client fields
  clientPreferredLanguage: z.string().optional(),
  clientCountryOfBirth: z.string().optional(),
  clientMaritalStatus: z.string().optional(),
  clientWeight: z.string().optional(),
  clientHeight: z.string().optional(),
  // Mailing address
  street: z.string().min(1, "Street address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  county: z.string().optional(),
  country: z.string().default("United States"),
  // Physical address (optional, may be same as mailing)
  physical_address: z.string().optional(),
  physical_addressLine2: z.string().optional(),
  physical_city: z.string().optional(),
  physical_state: z.string().optional(),
  physical_postalCode: z.string().optional(),
  physical_county: z.string().optional(),
  physical_country: z.string().optional(),
});

const step3Schema = z.object({
  spouses: z.array(spouseSchema).default([]),
  dependents: z.array(dependentSchema).default([]),
});

const completeQuoteSchema = step1Schema.merge(step2Schema).merge(step3Schema);

// Edit Addresses Sheet Component - Extracted outside to prevent recreation on each render
interface EditAddressesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteWithArrays;
  addressType: 'physical' | 'mailing' | 'billing' | null;
  onSave: (data: Partial<Quote>) => void;
  isPending: boolean;
}

function EditAddressesSheet({ open, onOpenChange, quote, onSave, isPending, addressType }: EditAddressesSheetProps) {
  const addressSchema = z.object({
    street: z.string().min(1, "Street address is required"),
    addressLine2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    postalCode: z.string().min(1, "Postal code is required"),
    county: z.string().optional(),
  });

  // Helper function to get address fields based on addressType
  const getAddressFields = (type: 'physical' | 'mailing' | 'billing') => {
    const prefix = type;
    return {
      street: quote?.[`${prefix}_street`] || '',
      addressLine2: quote?.[`${prefix}_address_line_2`] || '',
      city: quote?.[`${prefix}_city`] || '',
      state: quote?.[`${prefix}_state`] || '',
      postalCode: quote?.[`${prefix}_postal_code`] || '',
      county: quote?.[`${prefix}_county`] || '',
    };
  };

  // Helper function to transform form data to database fields
  const transformToDbFields = (formData: any, type: 'physical' | 'mailing' | 'billing') => {
    const prefix = type;
    return {
      [`${prefix}_street`]: formData.street,
      [`${prefix}_address_line_2`]: formData.addressLine2,
      [`${prefix}_city`]: formData.city,
      [`${prefix}_state`]: formData.state,
      [`${prefix}_postal_code`]: formData.postalCode,
      [`${prefix}_county`]: formData.county,
    };
  };

  const addressForm = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: getAddressFields(addressType || 'physical'),
  });

  // Track previous open state to prevent multiple resets
  const prevOpenRef = useRef(open);
  const prevAddressTypeRef = useRef(addressType);

  useEffect(() => {
    // Only reset when sheet opens (false → true transition) or address type changes
    if (quote && addressType && ((open && !prevOpenRef.current) || (open && addressType !== prevAddressTypeRef.current))) {
      addressForm.reset(getAddressFields(addressType));
    }
    prevOpenRef.current = open;
    prevAddressTypeRef.current = addressType;
  }, [open, addressType, quote?.id]); // Only depend on quote.id, not entire quote object

  const getTitle = () => {
    if (addressType === 'physical') return 'Edit Physical Address';
    if (addressType === 'mailing') return 'Edit Mailing Address';
    if (addressType === 'billing') return 'Edit Billing Address';
    return 'Edit Address';
  };

  const getDescription = () => {
    if (addressType === 'physical') return 'Update the physical address for this quote';
    if (addressType === 'mailing') return 'Update the mailing address for this quote';
    if (addressType === 'billing') return 'Update the billing address for this quote';
    return 'Update the address for this quote';
  };

  if (!addressType) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>{getTitle()}</SheetTitle>
          <SheetDescription>
            {getDescription()}
          </SheetDescription>
        </SheetHeader>
        <Form {...addressForm}>
          <form onSubmit={addressForm.handleSubmit((formData) => {
            const transformedData = transformToDbFields(formData, addressType);
            onSave(transformedData);
          })} className="space-y-6 py-6">
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
  const { toast } = useToast();
  const [memberTab, setMemberTab] = useTabsState(["basic", "income", "immigration", "documents"], "basic");
  const [isSaving, setIsSaving] = useState(false); // Internal loading state
  const editMemberSchema = memberType === 'dependent'
    ? dependentSchema
    : familyMemberSchema;

  // Fetch quote members to get member IDs
  const { data: membersData, isLoading: isLoadingMembers } = useQuery<{ members: any[] }>({
    queryKey: ['/api/quotes', quote?.id, 'members'],
    enabled: !!quote?.id && open,
  });

  // Find the current member ID based on memberType and memberIndex
  const currentMemberId = useMemo(() => {
    if (!membersData?.members) return null;
    
    if (memberType === 'primary') {
      return membersData.members.find(m => m.role === 'client')?.id;
    } else if (memberType === 'spouse' && memberIndex !== undefined) {
      const spouses = membersData.members.filter(m => m.role === 'spouse');
      return spouses[memberIndex]?.id;
    } else if (memberType === 'dependent' && memberIndex !== undefined) {
      const dependents = membersData.members.filter(m => m.role === 'dependent');
      return dependents[memberIndex]?.id;
    }
    return null;
  }, [membersData, memberType, memberIndex]);

  // Fetch income data for this member (404 is OK - means no income data yet)
  const { data: incomeData, isLoading: isLoadingIncome } = useQuery<{ income: any }>({
    queryKey: ['/api/quotes/members', currentMemberId, 'income'],
    queryFn: async () => {
      console.log('[Income Query] Fetching income for memberId:', currentMemberId);
      const res = await fetch(`/api/quotes/members/${currentMemberId}/income`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        console.log('[Income Query] No income data found (404) - this is OK');
        return { income: null }; // No income data yet - this is OK
      }
      if (!res.ok) {
        throw new Error('Failed to fetch income data');
      }
      const data = await res.json();
      console.log('[Income Query] Received income data:', data);
      return data;
    },
    enabled: !!currentMemberId && open,
  });

  // Fetch immigration data for this member (404 is OK - means no immigration data yet)
  const { data: immigrationData, isLoading: isLoadingImmigration } = useQuery<{ immigration: any }>({
    queryKey: ['/api/quotes/members', currentMemberId, 'immigration'],
    queryFn: async () => {
      console.log('[Immigration Query] Fetching immigration for memberId:', currentMemberId);
      const res = await fetch(`/api/quotes/members/${currentMemberId}/immigration`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        console.log('[Immigration Query] No immigration data found (404) - this is OK');
        return { immigration: null }; // No immigration data yet - this is OK
      }
      if (!res.ok) {
        throw new Error('Failed to fetch immigration data');
      }
      const data = await res.json();
      console.log('[Immigration Query] Received immigration data:', data);
      return data;
    },
    enabled: !!currentMemberId && open,
  });
  
  // Check if we're still loading ANY data - must wait for ALL queries to complete
  const isLoadingMemberData = isLoadingMembers || isLoadingIncome || isLoadingImmigration;

  // Use useMemo to prevent unnecessary recalculation and form resets
  const memberData = useMemo(() => {
    if (!quote || !memberType || !membersData?.members) return null;
    
    // Get income and immigration data from fetched data
    const income = incomeData?.income || {};
    const immigration = immigrationData?.immigration || {};
    
    console.log('[MemberData Build] Building memberData for type:', memberType, 'income:', income, 'immigration:', immigration);
    
    if (memberType === 'primary') {
      const data = {
        firstName: quote.clientFirstName || '',
        middleName: quote.clientMiddleName || '',
        lastName: quote.clientLastName || '',
        secondLastName: quote.clientSecondLastName || '',
        email: quote.clientEmail || '',
        phone: quote.clientPhone || '',
        dateOfBirth: formatDateForInput(quote.clientDateOfBirth),
        ssn: normalizeSSN(quote.clientSsn),
        gender: quote.clientGender || '',
        isApplicant: quote.clientIsApplicant ?? true,
        tobaccoUser: quote.clientTobaccoUser ?? false,
        pregnant: quote.clientPregnant ?? false,
        preferredLanguage: quote.clientPreferredLanguage || '',
        countryOfBirth: quote.clientCountryOfBirth || '',
        maritalStatus: quote.clientMaritalStatus || '',
        weight: quote.clientWeight || '',
        height: quote.clientHeight || '',
        // Income fields from API
        employerName: income.employerName || '',
        employerPhone: income.employerPhone || '',
        position: income.position || '',
        annualIncome: income.annualIncome || '',
        incomeFrequency: income.incomeFrequency || 'annually',
        selfEmployed: income.selfEmployed || false,
        // Immigration fields from API
        immigrationStatus: immigration.immigrationStatus || '',
        naturalizationNumber: immigration.naturalizationNumber || '',
        uscisNumber: immigration.uscisNumber || '',
        immigrationStatusCategory: immigration.immigrationStatusCategory || '',
      };
      console.log('[MemberData Build] Primary member data built:', data);
      return data;
    } else if (memberType === 'spouse' && memberIndex !== undefined) {
      // Get from normalized members data instead of old quote.spouses array
      const spouses = membersData.members.filter(m => m.role === 'spouse');
      const spouse = spouses[memberIndex];
      return spouse ? {
        firstName: spouse.firstName || '',
        middleName: spouse.middleName || '',
        lastName: spouse.lastName || '',
        secondLastName: spouse.secondLastName || '',
        email: spouse.email || '',
        phone: spouse.phone || '',
        dateOfBirth: formatDateForInput(spouse.dateOfBirth),
        ssn: normalizeSSN(spouse.ssn),
        gender: spouse.gender || '',
        isApplicant: spouse.isApplicant ?? false,
        isPrimaryDependent: spouse.isPrimaryDependent ?? false,
        tobaccoUser: spouse.tobaccoUser ?? false,
        pregnant: spouse.pregnant ?? false,
        preferredLanguage: spouse.preferredLanguage || '',
        countryOfBirth: spouse.countryOfBirth || '',
        maritalStatus: spouse.maritalStatus || '',
        weight: spouse.weight || '',
        height: spouse.height || '',
        // Income fields from API
        employerName: income.employerName || '',
        employerPhone: income.employerPhone || '',
        position: income.position || '',
        annualIncome: income.annualIncome || '',
        incomeFrequency: income.incomeFrequency || 'annually',
        selfEmployed: income.selfEmployed || false,
        // Immigration fields from API
        immigrationStatus: immigration.immigrationStatus || '',
        naturalizationNumber: immigration.naturalizationNumber || '',
        uscisNumber: immigration.uscisNumber || '',
        immigrationStatusCategory: immigration.immigrationStatusCategory || '',
      } : null;
    } else if (memberType === 'dependent' && memberIndex !== undefined) {
      // Get from normalized members data instead of old quote.dependents array
      const dependents = membersData.members.filter(m => m.role === 'dependent');
      const dependent = dependents[memberIndex];
      return dependent ? {
        firstName: dependent.firstName || '',
        middleName: dependent.middleName || '',
        lastName: dependent.lastName || '',
        secondLastName: dependent.secondLastName || '',
        email: dependent.email || '',
        phone: dependent.phone || '',
        dateOfBirth: formatDateForInput(dependent.dateOfBirth),
        ssn: normalizeSSN(dependent.ssn),
        gender: dependent.gender || '',
        isApplicant: dependent.isApplicant ?? false,
        isPrimaryDependent: dependent.isPrimaryDependent ?? false,
        tobaccoUser: dependent.tobaccoUser ?? false,
        pregnant: dependent.pregnant ?? false,
        preferredLanguage: dependent.preferredLanguage || '',
        countryOfBirth: dependent.countryOfBirth || '',
        maritalStatus: dependent.maritalStatus || '',
        weight: dependent.weight || '',
        height: dependent.height || '',
        relation: dependent.relation || '',
        // Income fields from API
        employerName: income.employerName || '',
        employerPhone: income.employerPhone || '',
        position: income.position || '',
        annualIncome: income.annualIncome || '',
        incomeFrequency: income.incomeFrequency || 'annually',
        selfEmployed: income.selfEmployed || false,
        // Immigration fields from API
        immigrationStatus: immigration.immigrationStatus || '',
        naturalizationNumber: immigration.naturalizationNumber || '',
        uscisNumber: immigration.uscisNumber || '',
        immigrationStatusCategory: immigration.immigrationStatusCategory || '',
      } : null;
    }
    return null;
  }, [quote?.id, memberType, memberIndex, membersData, incomeData, immigrationData]); // Include fetched data in dependencies
  
  const editForm = useForm({
    resolver: zodResolver(editMemberSchema),
    defaultValues: memberData || {},
  });

  // Reset form whenever memberData changes (including when income/immigration data loads)
  useEffect(() => {
    if (open && memberData) {
      console.log('[EditMemberSheet] Resetting form with complete data:', memberData);
      editForm.reset(memberData);
    }
  }, [open, memberData, editForm]);

  // Reset tab to "basic" whenever member changes
  useEffect(() => {
    if (open) {
      setMemberTab("basic");
    }
  }, [memberType, memberIndex, setMemberTab, open])

  const handleSave = async (data: z.infer<typeof editMemberSchema>) => {
    console.log('[EditMemberSheet] handleSave called with data:', data);
    console.log('[EditMemberSheet] Form errors:', editForm.formState.errors);
    
    // Close any open popovers
    setCountryPopoverOpen(false);
    
    // Activate loading state
    setIsSaving(true);
    
    // Step 1: Save basic data to normalized table quote_members
    try {
      console.log('[EditMemberSheet] Starting to save member basic data...');
      
      // For primary client, also update quotes table fields
      if (memberType === 'primary') {
        onSave({
          clientFirstName: data.firstName,
          clientMiddleName: data.middleName,
          clientLastName: data.lastName,
          clientSecondLastName: data.secondLastName,
          clientEmail: data.email,
          clientPhone: data.phone,
          clientSsn: normalizeSSN(data.ssn),
          clientGender: data.gender,
          clientIsApplicant: data.isApplicant,
          clientTobaccoUser: data.tobaccoUser,
          clientPregnant: data.pregnant,
          clientPreferredLanguage: data.preferredLanguage,
          clientCountryOfBirth: data.countryOfBirth,
          clientMaritalStatus: data.maritalStatus,
          clientWeight: data.weight,
          clientHeight: data.height,
        });
      }
      
      // Update normalized quote_members table for ALL members (including primary)
      if (currentMemberId) {
        const memberBasicData: any = {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          secondLastName: data.secondLastName,
          email: data.email,
          phone: data.phone,
          dateOfBirth: data.dateOfBirth,
          ssn: normalizeSSN(data.ssn),
          gender: data.gender,
          isApplicant: data.isApplicant,
          isPrimaryDependent: data.isPrimaryDependent,
          tobaccoUser: data.tobaccoUser,
          pregnant: data.pregnant,
          preferredLanguage: data.preferredLanguage,
          countryOfBirth: data.countryOfBirth,
          maritalStatus: data.maritalStatus,
          weight: data.weight,
          height: data.height,
        };
        
        if (memberType === 'dependent') {
          memberBasicData.relation = (data as any).relation;
        }
        
        const memberResponse = await fetch(`/api/quotes/members/${currentMemberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(memberBasicData),
        });
        
        if (!memberResponse.ok) {
          const errorText = await memberResponse.text();
          console.error('[EditMemberSheet] Failed to update member:', errorText);
          toast({
            variant: "destructive",
            title: "Error Saving Member",
            description: "Failed to save member data. Please try again.",
          });
          return;
        }
        
        console.log('[EditMemberSheet] Member basic data saved successfully');
      }
    
    // Step 2: Sync income and immigration to normalized tables
      
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
            isPrimaryDependent: data.isPrimaryDependent || false,
            tobaccoUser: data.tobaccoUser || false,
            pregnant: data.pregnant || false,
            preferredLanguage: data.preferredLanguage || null,
            countryOfBirth: data.countryOfBirth || null,
            maritalStatus: data.maritalStatus || null,
            weight: data.weight || null,
            height: data.height || null,
            relation: memberType === 'dependent' ? ((data as any).relation || null) : undefined,
          },
        }),
      });
      
      if (!ensureResponse.ok) {
        console.error('[EditMemberSheet] Failed to ensure member:', await ensureResponse.text());
        onOpenChange(false); // Close sheet even if this fails
        return;
      }
      
      const { memberId } = await ensureResponse.json();
      
      // Step 3 & 4: Save income and immigration data in parallel for faster performance
      // Calculate total annual income based on frequency
      let totalAnnualIncome = null;
      if (data.annualIncome) {
        const amount = parseFloat(data.annualIncome);
        if (!isNaN(amount) && amount > 0) {
          const frequency = data.incomeFrequency || 'annually';
          switch (frequency) {
            case 'weekly':
              totalAnnualIncome = (amount * 52).toFixed(2);
              break;
            case 'biweekly':
              totalAnnualIncome = (amount * 26).toFixed(2);
              break;
            case 'monthly':
              totalAnnualIncome = (amount * 12).toFixed(2);
              break;
            case 'annually':
            default:
              totalAnnualIncome = amount.toFixed(2);
              break;
          }
        }
      }
      
      // Execute income and immigration saves in parallel
      const [incomeResponse, immigrationResponse] = await Promise.all([
        fetch(`/api/quotes/members/${memberId}/income`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            employerName: data.employerName || null,
            employerPhone: data.employerPhone || null,
            position: data.position || null,
            annualIncome: data.annualIncome || null,
            incomeFrequency: data.incomeFrequency || 'annually',
            totalAnnualIncome: totalAnnualIncome,
            selfEmployed: data.selfEmployed || false,
          }),
        }),
        fetch(`/api/quotes/members/${memberId}/immigration`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            immigrationStatus: data.immigrationStatus || null,
            uscisNumber: data.uscisNumber || null,
            naturalizationNumber: data.naturalizationNumber || null,
            immigrationStatusCategory: data.immigrationStatusCategory || null,
          }),
        })
      ]);
      
      // Check both responses
      if (!incomeResponse.ok) {
        const errorText = await incomeResponse.text();
        console.error('[EditMemberSheet] Failed to save income:', errorText);
        toast({
          variant: "destructive",
          title: "Error Saving Income",
          description: "Failed to save income data. Please try again.",
        });
        return;
      }
      
      if (!immigrationResponse.ok) {
        const errorText = await immigrationResponse.text();
        console.error('[EditMemberSheet] Failed to save immigration:', errorText);
        toast({
          variant: "destructive",
          title: "Error Saving Immigration",
          description: "Failed to save immigration data. Please try again.",
        });
        return;
      }
      
      console.log('[EditMemberSheet] All data saved successfully!');
      
      // Invalidate UNIFIED query to refresh ALL data
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quote.id, 'detail'] });
      
      toast({
        title: "Success",
        description: "Member information saved successfully.",
      });
      // Don't close the sheet - allow user to continue editing or navigate to other members
    } catch (error) {
      console.error('[EditMemberSheet] Error saving member data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred while saving.",
      });
      // Don't close the sheet on error - let user try again
    } finally {
      // Always deactivate loading state
      setIsSaving(false);
    }
  };

  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);

  // Calculate all members for navigation (do this even if loading to avoid hook rule violations)
  const totalSpouses = quote?.spouses?.length || 0;
  const totalDependents = quote?.dependents?.length || 0;
  const allMembers = quote ? [
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
  ] : [];

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

  const memberName = memberData ? `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim() || 'Unnamed' : 'Loading...';

  // Show loading screen if data is still being fetched
  if (isLoadingMemberData || !memberData) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl flex items-center justify-center" side="right">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Loading member details...</p>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet 
      open={open} 
      onOpenChange={(isOpen) => {
        // Only allow closing the sheet, never opening from here
        if (!isOpen && !isSaving && !isPending) {
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
            <Button
              type="button"
              disabled={isSaving || isPending}
              data-testid="button-save"
              onClick={editForm.handleSubmit(handleSave)}
              className="mr-10"
            >
              {(isSaving || isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {(isSaving || isPending) ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {/* Navigation buttons */}
          {allMembers.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleNavigate('prev')}
                disabled={!hasPrevious || isSaving || isPending}
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
                disabled={!hasNext || isSaving || isPending}
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
            <Tabs value={memberTab} onValueChange={setMemberTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mb-4 mx-4 mt-4">
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
                    <FormLabel>First Name <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
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
                    <FormLabel>Last Name <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
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
                    <FormLabel>Date of Birth <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social Security <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        {...field}
                        onChange={(e) => {
                          // Extract only digits - save WITHOUT formatting
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                          field.onChange(digits);
                        }}
                        value={field.value ? formatSSN(field.value) : ''}
                        autoComplete="off"
                        placeholder="XXX-XX-XXXX"
                        data-testid="input-ssn"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone - Email */}
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone {memberType === 'primary' && <span className="text-destructive inline-block align-baseline">*</span>}</FormLabel>
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
                    <FormLabel>Email</FormLabel>
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
                    <FormLabel>Gender <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
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
                  <FormItem>
                    <FormLabel>Country of Birth</FormLabel>
                    <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
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
                  name={"relation" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relation <span className="text-destructive">*</span></FormLabel>
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
                    name="isPrimaryDependent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-primary-dependent"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Dependent</FormLabel>
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
                  <FormField
                    control={editForm.control}
                    name="pregnant"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-pregnant"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Pregnant</FormLabel>
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
                      const [isFocused, setIsFocused] = useState(false);
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
                      
                      // Display value with commas when NOT focused
                      const displayValue = isFocused ? (field.value || '') : (
                        field.value ? 
                          parseFloat(field.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                          : ''
                      );
                      
                      const annualAmount = calculateAnnualIncome(field.value || '0');
                      const showAnnualEquivalent = field.value && parseFloat(field.value) > 0 && frequency !== 'annually';
                      
                      return (
                        <FormItem>
                          <FormLabel>{frequencyLabel} Income <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input 
                                type="text"
                                placeholder="0.00" 
                                data-testid="input-income-amount"
                                className="pl-7 bg-background"
                                value={displayValue}
                                onFocus={() => setIsFocused(true)}
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
                                  setIsFocused(false);
                                  let value = e.target.value;
                                  // Remove commas before parsing
                                  value = value.replace(/,/g, '');
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
                        <FormLabel>Status <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
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
            </Tabs>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// Add Member Sheet Component - Extracted outside to prevent recreation on each render
interface AddMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: QuoteWithArrays;
  onSave: (data: any) => void;
  isPending: boolean;
}

function AddMemberSheet({ open, onOpenChange, quote, onSave, isPending }: AddMemberSheetProps) {
  const { toast } = useToast();
  const [memberTab, setMemberTab] = useTabsState(["basic", "income", "immigration"], "basic");
  
  const addMemberSchema = z.object({
    // Basic Information
    isApplicant: z.boolean().default(false),
    isPrimaryDependent: z.boolean().default(false),
    preferredLanguage: z.string().optional(),
    relation: z.string().min(1, "Relation is required"),
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    secondLastName: z.string().optional(),
    countryOfBirth: z.string().optional(),
    maritalStatus: z.string().optional(),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().min(1, "Gender is required"),
    ssn: z.string().min(1, "SSN is required"),
    email: z.string().email("Invalid email").optional().or(z.literal('')),
    phone: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
    tobaccoUser: z.boolean().default(false),
    // Income fields
    employerName: z.string().optional(),
    employerPhone: z.string().optional(),
    position: z.string().optional(),
    annualIncome: z.string().optional(),
    incomeFrequency: z.string().default('annually'),
    selfEmployed: z.boolean().default(false),
    // Immigration fields
    immigrationStatus: z.string().optional(),
    naturalizationNumber: z.string().optional(),
    uscisNumber: z.string().optional(),
    immigrationStatusCategory: z.string().optional(),
  });

  const defaultValues = {
    isApplicant: true,
    isPrimaryDependent: false,
    preferredLanguage: '',
    relation: '',
    firstName: '',
    middleName: '',
    lastName: '',
    secondLastName: '',
    countryOfBirth: '',
    maritalStatus: '',
    dateOfBirth: '',
    gender: '',
    ssn: '',
    email: '',
    phone: '',
    weight: '',
    height: '',
    tobaccoUser: false,
    // Income defaults
    employerName: '',
    employerPhone: '',
    position: '',
    annualIncome: '',
    incomeFrequency: 'annually',
    selfEmployed: false,
    // Immigration defaults
    immigrationStatus: '',
    naturalizationNumber: '',
    uscisNumber: '',
    immigrationStatusCategory: '',
  };

  const addMemberForm = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues,
  });

  // Track previous open state to prevent multiple resets
  const prevOpenRef = useRef(false);
  
  // Simplified reset logic - only reset on opening transition (false -> true)
  useEffect(() => {
    const isOpening = open && !prevOpenRef.current;
    if (isOpening) {
      addMemberForm.reset(defaultValues);
      setMemberTab('basic');
    }
    prevOpenRef.current = open;
  }, [open]); // ONLY depend on open

  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0" side="right">
        <div className="flex flex-col gap-3 p-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-lg">Add Family Member</SheetTitle>
              <SheetDescription className="mt-1">
                Fill in all required information for the new family member
              </SheetDescription>
            </div>
            <Button
              type="button"
              disabled={isPending}
              data-testid="button-save-member"
              onClick={addMemberForm.handleSubmit((data) => {
                onSave(data);
                // Reset form after save for next entry
                addMemberForm.reset(defaultValues);
                setMemberTab('basic');
              })}
              className="mr-10"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </Button>
          </div>
        </div>
        <Form {...addMemberForm}>
          <form onSubmit={addMemberForm.handleSubmit(onSave)} className="flex flex-col flex-1 min-h-0">
            <Tabs value={memberTab} onValueChange={setMemberTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mb-4 mx-4 mt-4">
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
              </TabsList>

              {/* Tab 1: Basic Information */}
              <TabsContent value="basic" className="flex-1 overflow-y-auto space-y-6 p-4">
                {/* Relation and Is Applicant */}
                <div className="space-y-4">
                  <FormField
                    control={addMemberForm.control}
                    name="relation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relation with primary <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-relation">
                              <SelectValue placeholder="Select relation with primary" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse</SelectItem>
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
                  <FormField
                    control={addMemberForm.control}
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
                    control={addMemberForm.control}
                    name="isPrimaryDependent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-primary-dependent"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Dependent</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* First Name - Middle Name */}
                  <FormField
                    control={addMemberForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addMemberForm.control}
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
                    control={addMemberForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addMemberForm.control}
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
                    control={addMemberForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-dob" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addMemberForm.control}
                    name="ssn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Social Security <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            {...field}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                              field.onChange(digits);
                            }}
                            value={field.value ? formatSSN(field.value) : ''}
                            autoComplete="off"
                            placeholder="XXX-XX-XXXX"
                            data-testid="input-ssn"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone - Email */}
                  <FormField
                    control={addMemberForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
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
                    control={addMemberForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Gender - Marital Status */}
                  <FormField
                    control={addMemberForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender <span className="text-destructive inline-block align-baseline">*</span></FormLabel>
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
                    control={addMemberForm.control}
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
                    control={addMemberForm.control}
                    name="countryOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country of Birth</FormLabel>
                        <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between font-normal"
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
                    control={addMemberForm.control}
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
                            <SelectItem value="chinese">Chinese</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Weight - Height */}
                  <FormField
                    control={addMemberForm.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (Lbs)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="150" data-testid="input-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addMemberForm.control}
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
                </div>
                
                <FormField
                  control={addMemberForm.control}
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
                <FormField
                  control={addMemberForm.control}
                  name="pregnant"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-pregnant"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Pregnant</FormLabel>
                    </FormItem>
                  )}
                />
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
                    control={addMemberForm.control}
                    name="employerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Company name" data-testid="input-employer-name" className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Employer Phone */}
                  <FormField
                    control={addMemberForm.control}
                    name="employerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer Phone</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                            placeholder="(555) 555-5555" 
                            data-testid="input-employer-phone" 
                            className="bg-background" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Position */}
                  <FormField
                    control={addMemberForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Position/Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Job title" data-testid="input-position" className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={addMemberForm.control}
                  name="selfEmployed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-selfemployed"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Self Employed</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Income Details Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Income Details</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Annual Income */}
                  <FormField
                    control={addMemberForm.control}
                    name="annualIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Income</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            placeholder="50000" 
                            data-testid="input-annual-income" 
                            className="bg-background" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Income Frequency */}
                  <FormField
                    control={addMemberForm.control}
                    name="incomeFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-income-frequency">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Immigration Status */}
            <TabsContent value="immigration" className="flex-1 overflow-y-auto space-y-4 p-4">
              {/* Immigration Status Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Plane className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Immigration Information</h3>
                </div>
                
                <FormField
                  control={addMemberForm.control}
                  name="immigrationStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Immigration Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-immigration-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="us_citizen">U.S. Citizen</SelectItem>
                          <SelectItem value="permanent_resident">Permanent Resident (Green Card)</SelectItem>
                          <SelectItem value="work_visa">Work Visa</SelectItem>
                          <SelectItem value="student_visa">Student Visa</SelectItem>
                          <SelectItem value="refugee">Refugee</SelectItem>
                          <SelectItem value="asylum_seeker">Asylum Seeker</SelectItem>
                          <SelectItem value="temporary_protected">Temporary Protected Status</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {addMemberForm.watch('immigrationStatus') === 'us_citizen' && (
                  <FormField
                    control={addMemberForm.control}
                    name="naturalizationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Naturalization Certificate Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Certificate number (optional)" data-testid="input-naturalization-number" className="bg-background font-mono" />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">For naturalized citizens only</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={addMemberForm.control}
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
                  control={addMemberForm.control}
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
          </Tabs>
        </form>
      </Form>
    </SheetContent>
  </Sheet>
  );
}

// Marketplace Plans Section Component
function MarketplacePlansSection({ quoteId, autoLoad = false }: { quoteId: string; autoLoad?: boolean }) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [marketplacePlans, setMarketplacePlans] = useState<any>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Auto-load plans if requested
  useEffect(() => {
    if (autoLoad && !marketplacePlans && !isLoadingPlans) {
      fetchMarketplacePlans();
    }
  }, [autoLoad]);

  const fetchMarketplacePlans = async () => {
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
      setIsExpanded(true);
      
      toast({
        title: "Plans loaded",
        description: `Found ${data.plans?.length || 0} available plans`,
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getMetalLevelColor = (metalLevel: string) => {
    const level = metalLevel?.toLowerCase();
    if (level?.includes('bronze')) return 'bg-amber-700';
    if (level?.includes('silver')) return 'bg-gray-400';
    if (level?.includes('gold')) return 'bg-yellow-500';
    if (level?.includes('platinum')) return 'bg-purple-500';
    return 'bg-blue-500';
  };

  return (
    <Card id="marketplace-plans-section">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Available Health Insurance Plans
          </CardTitle>
          <CardDescription className="mt-1">
            View available plans from healthcare.gov marketplace
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="default"
          onClick={fetchMarketplacePlans}
          disabled={isLoadingPlans}
          data-testid="button-fetch-marketplace-plans"
        >
          {isLoadingPlans ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Plans
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {!marketplacePlans && !isLoadingPlans && (
          <div className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Click "Load Plans" to view available health insurance options from the marketplace
            </p>
          </div>
        )}

        {isLoadingPlans && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Fetching plans from healthcare.gov marketplace...
              </p>
            </div>
          </div>
        )}

        {marketplacePlans && !isLoadingPlans && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
              <div>
                <p className="text-sm font-medium">
                  Found {marketplacePlans.plans?.length || 0} plans
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {marketplacePlans.year} coverage year
                </p>
              </div>
              {marketplacePlans.household_aptc && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Monthly Tax Credit</p>
                  <p className="text-sm font-semibold text-green-600">
                    {formatCurrency(marketplacePlans.household_aptc)}
                  </p>
                </div>
              )}
            </div>

            {/* Plans List */}
            <div className="space-y-3">
              {marketplacePlans.plans?.slice(0, isExpanded ? undefined : 5).map((plan: any, index: number) => (
                <Card key={plan.id || index} className="bg-accent/5">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Plan Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{plan.name}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {plan.issuer?.name}
                            </p>
                          </div>
                          <Badge className={`${getMetalLevelColor(plan.metal_level)} text-white`}>
                            {plan.metal_level}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Plan Type</p>
                            <p className="text-sm font-medium">{plan.plan_type || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Monthly Premium</p>
                            <p className="text-sm font-semibold">{formatCurrency(plan.premium)}</p>
                          </div>
                          {plan.premium_w_credit && (
                            <div>
                              <p className="text-xs text-muted-foreground">After Tax Credit</p>
                              <p className="text-sm font-semibold text-green-600">
                                {formatCurrency(plan.premium_w_credit)}
                              </p>
                            </div>
                          )}
                          {plan.deductibles?.[0] && (
                            <div>
                              <p className="text-xs text-muted-foreground">Deductible</p>
                              <p className="text-sm font-medium">
                                {formatCurrency(plan.deductibles[0].amount)}
                              </p>
                            </div>
                          )}
                        </div>

                        {plan.quality_rating?.available && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Quality Rating:</span>
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-3 w-3 rounded-sm ${
                                    i < (plan.quality_rating.global_rating || 0)
                                      ? 'bg-yellow-500'
                                      : 'bg-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-medium">
                              {plan.quality_rating.global_rating}/5
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Show More Button */}
            {marketplacePlans.plans?.length > 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full"
                data-testid="button-toggle-plans"
              >
                {isExpanded ? (
                  <>
                    Show Less
                    <ChevronDown className="h-4 w-4 ml-2 rotate-180" />
                  </>
                ) : (
                  <>
                    Show All {marketplacePlans.plans.length} Plans
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
  
  // Edit states
  const [editingMember, setEditingMember] = useState<{ type: 'primary' | 'spouse' | 'dependent', index?: number } | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [editingAddresses, setEditingAddresses] = useState<'physical' | 'mailing' | 'billing' | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(false);
  const [editingMedicines, setEditingMedicines] = useState(false);
  const [paymentMethodsSheet, setPaymentMethodsSheet] = useState<{open: boolean; paymentMethodId?: string}>({open: false});
  
  // Delete member dialog state
  const [deletingMember, setDeletingMember] = useState<{ id: string; name: string; role: string } | null>(null);
  
  // Delete address dialog state
  const [deletingAddress, setDeletingAddress] = useState<'mailing' | 'billing' | null>(null);
  
  // Marketplace plans auto-load state
  const [autoLoadMarketplacePlans, setAutoLoadMarketplacePlans] = useState(false);
  
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
  
  // Delete quote dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; clientName: string } | null>(null);
  
  // Calculate initial effective date ONCE (first day of next month)
  // This date will NOT change unless the user manually changes it
  const initialEffectiveDate = useMemo(() => format(getFirstDayOfNextMonth(), "yyyy-MM-dd"), []);
  
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

  // Determine if we're viewing a specific quote
  const isViewingQuote = params?.id && params.id !== 'new';
  
  // UNIFIED QUOTE DETAIL QUERY - Fetches ALL related data in one request
  const { data: quoteDetail, isLoading: isLoadingQuoteDetail } = useQuery<{
    quote: Quote & {
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; } | null;
      creator: { id: string; firstName: string | null; lastName: string | null; email: string; };
    };
    members: Array<{
      member: QuoteMember;
      income?: QuoteMemberIncome;
      immigration?: QuoteMemberImmigration;
      documents: QuoteMemberDocument[];
    }>;
    paymentMethods: QuotePaymentMethod[];
    totalHouseholdIncome: number;
  }>({
    queryKey: ['/api/quotes', params?.id, 'detail'],
    enabled: !!params?.id && params?.id !== 'new',
  });

  // Use the quote from unified detail if available, otherwise fallback to list (for backward compatibility)
  const viewingQuote = quoteDetail?.quote || quotesData?.quotes?.find(q => q.id === params?.id);
  const paymentMethodsData = quoteDetail ? { paymentMethods: quoteDetail.paymentMethods } : undefined;
  const isLoadingPaymentMethods = isLoadingQuoteDetail;

  // Delete payment method mutation
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('DELETE', `/api/quotes/${viewingQuote.id}/payment-methods/${paymentMethodId}`);
    },
    onSuccess: () => {
      if (params?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/quotes', params.id, 'detail'] });
      }
      toast({
        title: "Payment method deleted",
        description: "The payment method has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment method",
        variant: "destructive",
      });
    },
  });

  // Set default payment method mutation
  const setDefaultPaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      if (!viewingQuote?.id) return;
      return apiRequest(`/api/quotes/${viewingQuote.id}/payment-methods/${paymentMethodId}/set-default`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      if (params?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/quotes', params.id, 'detail'] });
      }
      toast({
        title: "Default payment method updated",
        description: "This payment method is now set as default.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set default payment method",
        variant: "destructive",
      });
    },
  });

  // Helper function to get card type from first digit
  // USER REQUIREMENT: Card numbers are stored in PLAIN TEXT
  const getCardType = (cardNumber: string): string => {
    if (!cardNumber) return 'Card';
    const firstDigit = cardNumber.charAt(0);
    switch (firstDigit) {
      case '4': return 'Visa';
      case '5': return 'Mastercard';
      case '3': return 'Amex';
      case '6': return 'Discover';
      default: return 'Card';
    }
  };

  const form = useForm<z.infer<typeof completeQuoteSchema>>({
    resolver: zodResolver(completeQuoteSchema),
    defaultValues: {
      effectiveDate: initialEffectiveDate,
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
      clientPregnant: false,
      clientSsn: "",
      // Additional client fields that were missing
      clientPreferredLanguage: "",
      clientCountryOfBirth: "",
      clientMaritalStatus: "",
      clientWeight: "",
      clientHeight: "",
      spouses: [],
      dependents: [],
      street: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      county: "",
      country: "United States",
      // Physical address fields (may be same as mailing)
      physical_address: "",
      physical_addressLine2: "",
      physical_city: "",
      physical_state: "",
      physical_postalCode: "",
      physical_county: "",
      physical_country: "United States",
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
      console.log('[CREATE QUOTE] Sending request with data:', data);
      
      // Clean up data to avoid sending undefined or empty string fields
      const cleanedData = {
        ...data,
        effectiveDate: data.effectiveDate,
        clientDateOfBirth: data.clientDateOfBirth || undefined,
        clientSsn: normalizeSSN(data.clientSsn),
        // Ensure all client fields have proper defaults
        clientPreferredLanguage: data.clientPreferredLanguage || "",
        clientCountryOfBirth: data.clientCountryOfBirth || "",
        clientMaritalStatus: data.clientMaritalStatus || "",
        clientWeight: data.clientWeight || "",
        clientHeight: data.clientHeight || "",
        clientPregnant: data.clientPregnant || false,
        // Ensure physical address fields have defaults
        physical_address: data.physical_address || data.street || "",
        physical_addressLine2: data.physical_addressLine2 || data.addressLine2 || "",
        physical_city: data.physical_city || data.city || "",
        physical_state: data.physical_state || data.state || "",
        physical_postalCode: data.physical_postalCode || data.postalCode || "",
        physical_county: data.physical_county || data.county || "",
        physical_country: data.physical_country || data.country || "United States",
        spouses: data.spouses?.map((spouse: any) => ({
          ...spouse,
          ssn: normalizeSSN(spouse.ssn),
          countryOfBirth: spouse.countryOfBirth || "",
        })) || [],
        dependents: data.dependents?.map((dependent: any) => ({
          ...dependent,
          ssn: normalizeSSN(dependent.ssn),
          countryOfBirth: dependent.countryOfBirth || "",
        })) || [],
      };
      
      const result = await apiRequest("POST", "/api/quotes", cleanedData);
      console.log('[CREATE QUOTE] Received response:', result);
      return result;
    },
    onSuccess: (response: any) => {
      console.log('[CREATE QUOTE] onSuccess called with response:', response);
      
      // Get the created quote ID
      const quoteId = response?.quote?.id || response?.id;
      
      console.log('[CREATE QUOTE] Extracted quote ID:', quoteId);
      console.log('[CREATE QUOTE] Full response structure:', JSON.stringify(response, null, 2));
      
      // IMMEDIATELY navigate to the created quote using router
      if (quoteId) {
        console.log('[CREATE QUOTE] Navigating to quote:', quoteId);
        
        // Navigate using wouter router
        setLocation(`/quotes/${quoteId}`);
        
        toast({
          title: "Quote created",
          description: "Opening quote details...",
        });
      } else {
        console.error('[CREATE QUOTE] No quote ID in response:', response);
        
        toast({
          variant: "destructive",
          title: "Error",
          description: "Quote created but could not navigate to it.",
        });
      }
      
      // Invalidate queries and reset form in background
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      
      // Reset form state for next quote (delayed to not interfere with navigation)
      setTimeout(() => {
        form.reset({
          effectiveDate: initialEffectiveDate,
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
          clientPregnant: false,
          clientSsn: "",
          // Additional client fields
          clientPreferredLanguage: "",
          clientCountryOfBirth: "",
          clientMaritalStatus: "",
          clientWeight: "",
          clientHeight: "",
          spouses: [],
          dependents: [],
          street: "",
          addressLine2: "",
          city: "",
          state: "",
          postalCode: "",
          county: "",
          country: "United States",
          // Physical address fields
          physical_address: "",
          physical_addressLine2: "",
          physical_city: "",
          physical_state: "",
          physical_postalCode: "",
          physical_county: "",
          physical_country: "United States",
        });
        setCurrentStep(1);
        setSelectedProduct("");
      }, 500);
    },
    onError: (error: any) => {
      console.error('[CREATE QUOTE] Error:', error);
      
      // Parse validation errors if they exist
      let errorMessage = "Failed to create quote";
      
      if (error.message && error.message.includes("Validation error")) {
        // Extract the first few validation errors for the user
        const errors = error.message.split("\\n").slice(0, 3);
        errorMessage = errors.join(", ");
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive", 
        title: "Error creating quote",
        description: errorMessage,
      });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: any }) => {
      return apiRequest("PATCH", `/api/quotes/${quoteId}`, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate UNIFIED query to refresh ALL related data
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', variables.quoteId, 'detail'] });
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

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      return apiRequest("DELETE", `/api/quotes/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
      toast({
        title: "Quote deleted",
        description: "The quote and all associated data have been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete quote",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!params?.id) throw new Error("Quote ID not found");
      return apiRequest("DELETE", `/api/quotes/${params.id}/members/${memberId}`);
    },
    onSuccess: () => {
      // Invalidate UNIFIED query to refresh ALL data
      if (params?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/quotes', params.id, 'detail'] });
      }
      setDeletingMember(null);
      toast({
        title: "Member deleted",
        description: "The family member has been removed from this quote.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete member",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!params?.id) throw new Error("Quote ID not found");
      
      const warnings: string[] = [];
      
      // Step 1: Create member
      const ensureResponse = await fetch(`/api/quotes/${params.id}/ensure-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: data.relation,
          memberData: {
            firstName: data.firstName,
            middleName: data.middleName || null,
            lastName: data.lastName,
            secondLastName: data.secondLastName || null,
            email: data.email || null,
            phone: data.phone || null,
            dateOfBirth: data.dateOfBirth || null,
            ssn: normalizeSSN(data.ssn) || null,
            gender: data.gender || null,
            isApplicant: data.isApplicant || false,
            isPrimaryDependent: data.isPrimaryDependent || false,
            tobaccoUser: data.tobaccoUser || false,
            pregnant: data.pregnant || false,
            preferredLanguage: data.preferredLanguage || null,
            countryOfBirth: data.countryOfBirth || null,
            maritalStatus: data.maritalStatus || null,
            weight: data.weight || null,
            height: data.height || null,
          },
        }),
      });
      
      if (!ensureResponse.ok) {
        const error = await ensureResponse.json();
        throw new Error(error.message || 'Failed to create member');
      }
      
      const { memberId } = await ensureResponse.json();
      
      // Step 2: Save income data
      let totalAnnualIncome = null;
      if (data.annualIncome) {
        const amount = parseFloat(data.annualIncome);
        if (!isNaN(amount) && amount > 0) {
          const frequency = data.incomeFrequency || 'annually';
          switch (frequency) {
            case 'weekly':
              totalAnnualIncome = (amount * 52).toFixed(2);
              break;
            case 'biweekly':
              totalAnnualIncome = (amount * 26).toFixed(2);
              break;
            case 'monthly':
              totalAnnualIncome = (amount * 12).toFixed(2);
              break;
            case 'annually':
            default:
              totalAnnualIncome = amount.toFixed(2);
              break;
          }
        }
      }
      
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
          totalAnnualIncome: totalAnnualIncome,
          selfEmployed: data.selfEmployed || false,
        }),
      });
      
      if (!incomeResponse.ok) {
        warnings.push('income');
      }
      
      // Step 3: Save immigration data
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
      
      if (!immigrationResponse.ok) {
        warnings.push('immigration');
      }
      
      return { memberId, warnings };
    },
    onSuccess: (result) => {
      // Invalidate UNIFIED query to refresh ALL data immediately
      if (params?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/quotes', params.id, 'detail'] });
        queryClient.invalidateQueries({ queryKey: ["/api/quotes"] }); // Also refresh the list
      }
      
      // Show appropriate toast based on warnings
      if (result.warnings && result.warnings.length > 0) {
        const failedSections = result.warnings.join(' and ');
        toast({
          variant: "destructive",
          title: "Partial Success",
          description: `Member created but ${failedSections} data failed to save. You can edit it later.`,
        });
      } else {
        toast({
          title: "Success",
          description: "Family member added successfully",
        });
      }
      
      // Don't close the sheet automatically - let user decide
      // setAddingMember(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add family member",
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
  
  // Fetch members with income and immigration details
  // REPLACED WITH UNIFIED QUERY - membersDetailsData now comes from quoteDetail
  // const { data: membersDetailsData } = useQuery<{ members: Array<any> }>({
  //   queryKey: ['/api/quotes', params?.id, 'members-details'],
  //   enabled: isViewingQuote && !!viewingQuote?.id,
  // });
  const membersDetailsData = quoteDetail ? { members: quoteDetail.members.map(m => ({ ...m.member, income: m.income, immigration: m.immigration })) } : undefined;

  // Helper function to get member details by role and index
  const getMemberDetails = (role: 'client' | 'spouse' | 'dependent', index?: number) => {
    if (!membersDetailsData?.members) return null;
    
    if (role === 'client') {
      return membersDetailsData.members.find(m => m.role === 'client');
    } else if (role === 'spouse' && index !== undefined) {
      const spouses = membersDetailsData.members.filter(m => m.role === 'spouse');
      return spouses[index];
    } else if (role === 'dependent' && index !== undefined) {
      const dependents = membersDetailsData.members.filter(m => m.role === 'dependent');
      return dependents[index];
    }
    return null;
  };

  // Helper function to convert snake_case to Title Case
  const formatLabel = (text: string) => {
    if (!text) return '';
    return text
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to format immigration status for display
  const getImmigrationStatusDisplay = (immigration: any) => {
    if (!immigration) return '-';
    
    // If immigration status is "citizen"
    if (immigration.immigrationStatus === 'citizen') {
      if (immigration.naturalizationNumber) {
        return 'U.S. Citizen (Naturalized)';
      }
      return 'U.S. Citizen';
    }
    
    // If has green card
    if (immigration.greenCardNumber) {
      return 'Permanent Resident';
    }
    
    // If has visa
    if (immigration.visaType) {
      return `${immigration.visaType.toUpperCase()} Visa`;
    }
    
    // If has work authorization type
    if (immigration.hasWorkAuthorization && immigration.workAuthorizationType) {
      return formatLabel(immigration.workAuthorizationType);
    }
    
    // If has immigration status category
    if (immigration.immigrationStatusCategory) {
      return formatLabel(immigration.immigrationStatusCategory);
    }
    
    // If has immigration status
    if (immigration.immigrationStatus) {
      return formatLabel(immigration.immigrationStatus);
    }
    
    return '-';
  };

  // Fetch total household income from all family members
  // REPLACED WITH UNIFIED QUERY - householdIncomeData now comes from quoteDetail
  // const { data: householdIncomeData } = useQuery({
  //   queryKey: ['/api/quotes', params?.id, 'household-income'],
  //   enabled: isViewingQuote && !!viewingQuote?.id,
  // });
  const householdIncomeData = quoteDetail ? { totalIncome: quoteDetail.totalHouseholdIncome } : undefined;
  
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
    const matchesState = !filters.state || quote.physical_state === filters.state;
    
    // Zip code filter
    const matchesZipCode = !filters.zipCode || quote.physical_postal_code.includes(filters.zipCode);
    
    // Assigned to filter (agentId)
    const matchesAssignedTo = !filters.assignedTo || quote.agentId === filters.assignedTo;
    
    // Effective date range filter (yyyy-MM-dd strings can be compared lexicographically)
    const matchesEffectiveDateFrom = !filters.effectiveDateFrom || quote.effectiveDate >= filters.effectiveDateFrom;
    const matchesEffectiveDateTo = !filters.effectiveDateTo || quote.effectiveDate <= filters.effectiveDateTo;
    
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
    { number: 3, title: "Family Members", icon: Users },
  ];

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
        firstPaymentDate: formatDateForInput(quote?.effectiveDate),
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
                effectiveDate: data.firstPaymentDate || undefined,
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

  // Add/Edit Payment Method Sheet Component
  // USER REQUIREMENT: All payment data (card numbers, CVV, account numbers, routing numbers) 
  // must be displayed in PLAIN TEXT with NO masking or encryption
  function AddPaymentMethodSheet({ open, onOpenChange, quote, paymentMethodId }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quote: QuoteWithArrays;
    paymentMethodId?: string;
  }) {
    const { toast } = useToast();
    const [paymentTab, setPaymentTab] = useState<"card" | "bank_account">("card");
    const [cardType, setCardType] = useState<CardType>('unknown');
    const [isSaving, setIsSaving] = useState(false); // Internal loading state
    const currentYear = new Date().getFullYear();
    
    // Fetch existing payment method data if editing
    const { data: paymentMethodData, isLoading: isLoadingPaymentMethod } = useQuery<{ paymentMethod: QuotePaymentMethod }>({
      queryKey: ['/api/quotes', quote?.id, 'payment-methods', paymentMethodId],
      queryFn: async () => {
        const res = await fetch(`/api/quotes/${quote.id}/payment-methods/${paymentMethodId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Failed to fetch payment method');
        }
        return res.json();
      },
      enabled: !!paymentMethodId && !!quote?.id && open,
    });

    // Create Zod schemas for validation
    const cardSchema = z.object({
      companyId: z.string(),
      quoteId: z.string(),
      paymentType: z.literal('card'),
      cardNumber: z.string().min(1, "Card number is required"),
      cardHolderName: z.string().min(1, "Cardholder name is required"),
      expirationMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Month must be 01-12"),
      expirationYear: z.string().regex(/^\d{4}$/, "Year must be 4 digits (YYYY)"),
      cvv: z.string().min(1, "CVV is required"),
      isDefault: z.boolean().default(false),
    });

    const bankAccountSchema = z.object({
      companyId: z.string(),
      quoteId: z.string(),
      paymentType: z.literal('bank_account'),
      bankName: z.string().min(1, "Bank name is required"),
      accountNumber: z.string().regex(/^\d{4,17}$/, "Account number must be 4-17 digits"),
      routingNumber: z.string().regex(/^\d{9}$/, "Routing number must be exactly 9 digits"),
      accountHolderName: z.string().min(1, "Account holder name is required"),
      accountType: z.enum(['checking', 'savings'], { required_error: "Account type is required" }),
      isDefault: z.boolean().default(false),
    });

    // Forms for both payment types
    const cardForm = useForm<z.infer<typeof cardSchema>>({
      resolver: zodResolver(cardSchema),
      defaultValues: {
        companyId: quote?.companyId || '',
        quoteId: quote?.id || '',
        paymentType: 'card' as const,
        cardNumber: '',
        cardHolderName: '',
        expirationMonth: '',
        expirationYear: '',
        cvv: '',
        isDefault: false,
      },
    });

    const bankAccountForm = useForm<z.infer<typeof bankAccountSchema>>({
      resolver: zodResolver(bankAccountSchema),
      defaultValues: {
        companyId: quote?.companyId || '',
        quoteId: quote?.id || '',
        paymentType: 'bank_account' as const,
        bankName: '',
        accountNumber: '',
        routingNumber: '',
        accountHolderName: '',
        accountType: 'checking' as const,
        isDefault: false,
      },
    });

    // Track previous open state to prevent multiple resets
    const prevOpenRef = useRef(false);

    // Reset forms when opening
    useEffect(() => {
      const isOpening = open && !prevOpenRef.current;
      
      if (isOpening) {
        // Reset to clean state when opening
        setPaymentTab('card');
        cardForm.reset({
          companyId: quote?.companyId || '',
          quoteId: quote?.id || '',
          paymentType: 'card' as const,
          cardNumber: '',
          cardHolderName: '',
          expirationMonth: '',
          expirationYear: '',
          cvv: '',
          isDefault: false,
        });
        bankAccountForm.reset({
          companyId: quote?.companyId || '',
          quoteId: quote?.id || '',
          paymentType: 'bank_account' as const,
          bankName: '',
          accountNumber: '',
          routingNumber: '',
          accountHolderName: '',
          accountType: 'checking' as const,
          isDefault: false,
        });
      }
      
      prevOpenRef.current = open;
    }, [open, quote?.companyId, quote?.id]);

    // Populate form with existing data when editing
    useEffect(() => {
      if (open && paymentMethodId && paymentMethodData?.paymentMethod) {
        const pm = paymentMethodData.paymentMethod;
        if (pm.paymentType === 'card') {
          setPaymentTab('card');
          cardForm.reset({
            companyId: pm.companyId,
            quoteId: pm.quoteId,
            paymentType: 'card',
            cardNumber: pm.cardNumber || '',
            cardHolderName: pm.cardHolderName || '',
            expirationMonth: pm.expirationMonth || '',
            expirationYear: pm.expirationYear || '',
            cvv: pm.cvv || '',
            isDefault: pm.isDefault || false,
          });
        } else if (pm.paymentType === 'bank_account') {
          setPaymentTab('bank_account');
          bankAccountForm.reset({
            companyId: pm.companyId,
            quoteId: pm.quoteId,
            paymentType: 'bank_account',
            bankName: pm.bankName || '',
            accountNumber: pm.accountNumber || '',
            routingNumber: pm.routingNumber || '',
            accountHolderName: pm.accountHolderName || '',
            accountType: pm.accountType as 'checking' | 'savings',
            isDefault: pm.isDefault || false,
          });
        }
      }
    }, [paymentMethodData, paymentMethodId, open]);

    // Unified save handler that detects which form to submit based on active tab
    const handleSave = async () => {
      setIsSaving(true);
      
      try {
        if (paymentTab === 'card') {
          const isValid = await cardForm.trigger();
          if (!isValid) {
            return;
          }
          const data = cardForm.getValues();
          
          if (paymentMethodId) {
            await apiRequest("PATCH", `/api/quotes/${quote.id}/payment-methods/${paymentMethodId}`, data);
          } else {
            await apiRequest("POST", `/api/quotes/${quote.id}/payment-methods`, data);
          }
        } else {
          const isValid = await bankAccountForm.trigger();
          if (!isValid) {
            return;
          }
          const data = bankAccountForm.getValues();
          
          if (paymentMethodId) {
            await apiRequest("PATCH", `/api/quotes/${quote.id}/payment-methods/${paymentMethodId}`, data);
          } else {
            await apiRequest("POST", `/api/quotes/${quote.id}/payment-methods`, data);
          }
        }
        
        // Refresh unified quote detail data
        await queryClient.invalidateQueries({ queryKey: ['/api/quotes', quote.id, 'detail'] });
        
        toast({
          title: paymentMethodId ? "Payment method updated" : "Payment method added",
          description: "The payment method has been saved successfully.",
        });
        
        // Close the modal after successful save
        onOpenChange(false);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to save payment method",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    };

    // Show loading state if editing and data hasn't loaded yet (GOLDEN RULE pattern)
    if (paymentMethodId && (isLoadingPaymentMethod || !paymentMethodData)) {
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="w-full sm:max-w-2xl flex items-center justify-center" side="right">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground">Loading payment method...</p>
            </div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <Sheet 
        open={open} 
        onOpenChange={(isOpen) => {
          // Only allow closing when not saving
          if (!isOpen && !isSaving) {
            onOpenChange(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0" side="right">
          {/* Header with save button */}
          <div className="flex flex-col gap-3 p-6 border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="text-lg">{paymentMethodId ? 'Edit Payment Method' : 'Add Payment Method'}</SheetTitle>
                <SheetDescription className="mt-1">
                  {paymentMethodId ? 'Update the payment method details' : 'Add a credit card or bank account for payments'}
                </SheetDescription>
              </div>
              <Button
                type="button"
                disabled={isSaving}
                data-testid="button-save-payment"
                onClick={handleSave}
                className="mr-10"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Tabs value={paymentTab} onValueChange={(value) => setPaymentTab(value as "card" | "bank_account")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="card">Credit/Debit Card</TabsTrigger>
                <TabsTrigger value="bank_account">Bank Account</TabsTrigger>
              </TabsList>

              {/* Credit/Debit Card Form */}
              <TabsContent value="card" className="space-y-4 mt-4">
                <Form {...cardForm}>
                  <div className="space-y-4">
                    {/* USER REQUIREMENT: Card number in PLAIN TEXT - no masking */}
                    <FormField
                      control={cardForm.control}
                      name="cardNumber"
                      render={({ field }) => {
                        // Detect card type on every change
                        const currentCardType = detectCardType(field.value || '');
                        const cardInfo = getCardTypeInfo(field.value || '');
                        
                        return (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              Card Number
                              {currentCardType !== 'unknown' && (
                                <Badge variant="outline" className="text-xs">
                                  {cardInfo.name}
                                </Badge>
                              )}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                {...field}
                                type="text"
                                placeholder="1234 5678 9012 3456"
                                maxLength={23}
                                data-testid="input-card-number"
                                onChange={(e) => {
                                  const cleaned = cleanCardNumber(e.target.value, field.value);
                                  const formatted = formatCardNumber(cleaned);
                                  const detectedType = detectCardType(cleaned);
                                  setCardType(detectedType);
                                  field.onChange(cleaned);
                                  e.target.value = formatted;
                                }}
                                onBlur={(e) => {
                                  const cleaned = cleanCardNumber(e.target.value);
                                  const formatted = formatCardNumber(cleaned);
                                  e.target.value = formatted;
                                  field.onBlur();
                                }}
                                value={formatCardNumber(field.value || '')}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    {/* Expiration (MM / YY) and CVV on the same line */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={cardForm.control}
                          name="expirationMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-exp-month">
                                    <SelectValue placeholder="MM" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((month) => (
                                    <SelectItem key={month} value={month}>{month}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={cardForm.control}
                          name="expirationYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="opacity-0">Year</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-exp-year">
                                    <SelectValue placeholder="YYYY" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {Array.from({ length: 10 }, (_, i) => currentYear + i).map((year) => (
                                    <SelectItem key={year} value={year.toString()}>{year.toString()}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* USER REQUIREMENT: CVV in PLAIN TEXT - no masking */}
                      <FormField
                        control={cardForm.control}
                        name="cvv"
                        render={({ field }) => {
                          const cardNumber = cardForm.watch('cardNumber') || '';
                          const detectedCardType = detectCardType(cardNumber);
                          const cardInfo = getCardTypeInfo(cardNumber);
                          const cvvLength = cardInfo.cvvLength;
                          
                          return (
                            <FormItem>
                              <FormLabel>CVV</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field}
                                  type="text"
                                  placeholder={cvvLength === 4 ? '1234' : '123'}
                                  maxLength={cvvLength}
                                  data-testid="input-cvv"
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    field.onChange(value.slice(0, cvvLength));
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <FormField
                      control={cardForm.control}
                      name="cardHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cardholder Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="John Doe"
                              data-testid="input-card-holder-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={cardForm.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-set-default"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Set as default payment method</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>
              </TabsContent>

              {/* Bank Account Form */}
              <TabsContent value="bank_account" className="space-y-4 mt-4">
                <Form {...bankAccountForm}>
                  <div className="space-y-4">
                    <FormField
                      control={bankAccountForm.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Bank of America"
                              data-testid="input-bank-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* USER REQUIREMENT: Account number in PLAIN TEXT - no masking */}
                    <FormField
                      control={bankAccountForm.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Number</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="text"
                              placeholder="123456789012"
                              maxLength={17}
                              data-testid="input-account-number"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* USER REQUIREMENT: Routing number in PLAIN TEXT - no masking */}
                    <FormField
                      control={bankAccountForm.control}
                      name="routingNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Routing Number</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="text"
                              placeholder="021000021"
                              maxLength={9}
                              data-testid="input-routing-number"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bankAccountForm.control}
                      name="accountHolderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Holder Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="John Doe"
                              data-testid="input-account-holder-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bankAccountForm.control}
                      name="accountType"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Account Type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="checking" data-testid="radio-checking" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Checking
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="savings" data-testid="radio-savings" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Savings
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bankAccountForm.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-set-default"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Set as default payment method</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // If viewing a specific quote, show modern dashboard
  if (isViewingQuote) {
    // Show loading state until ALL data is ready
    if (isLoadingQuoteDetail || !quoteDetail) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Loading quote details...</p>
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

    // Combine viewingQuote with full member details for EditMemberSheet
    const spousesFromMembers = membersDetailsData?.members?.filter(m => m.role === 'spouse') || [];
    const dependentsFromMembers = membersDetailsData?.members?.filter(m => m.role === 'dependent') || [];
    const viewingQuoteWithMembers = {
      ...viewingQuote,
      spouses: spousesFromMembers.length > 0 ? spousesFromMembers : (viewingQuote.spouses || []),
      dependents: dependentsFromMembers.length > 0 ? dependentsFromMembers : (viewingQuote.dependents || []),
    };
    
    const product = PRODUCT_TYPES.find(p => p.id === viewingQuote.productType);
    const agent = agents.find(a => a.id === viewingQuote.agentId);
    const totalApplicants = 1 + 
      (viewingQuoteWithMembers.spouses?.filter((s: any) => s.isApplicant).length || 0) + 
      (viewingQuoteWithMembers.dependents?.filter((d: any) => d.isApplicant).length || 0);
    const totalFamilyMembers = 1 + 
      (viewingQuoteWithMembers.spouses?.length || 0) + 
      (viewingQuoteWithMembers.dependents?.length || 0);
    // Count only members marked as primary dependents
    const totalDependents = [
      viewingQuoteWithMembers,
      ...(viewingQuoteWithMembers.spouses || []),
      ...(viewingQuoteWithMembers.dependents || [])
    ].filter((m: any) => m.isPrimaryDependent === true).length;

    // Calculate formatted income
    const totalHouseholdIncome = (householdIncomeData as any)?.totalIncome || 0;
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
                  <p className="text-sm">{formatDateForDisplay(viewingQuote.effectiveDate, "MM/dd/yyyy")}</p>
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
                  <span className="text-xs">{viewingQuote.clientDateOfBirth ? formatDateForDisplay(viewingQuote.clientDateOfBirth, "MM/dd/yyyy") : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <span className="text-xs">{viewingQuote.clientPhone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Location</span>
                  <span className="text-xs">{viewingQuote.physical_city}, {viewingQuote.physical_state} {viewingQuote.physical_postal_code}</span>
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
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
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
                        
                        {/* Quick Summary */}
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {viewingQuote.clientPhone || 'N/A'}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {viewingQuote.clientEmail || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {viewingQuote.clientGender ? viewingQuote.clientGender.charAt(0).toUpperCase() + viewingQuote.clientGender.slice(1) : 'N/A'}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {viewingQuote.clientDateOfBirth ? (
                                <>
                                  {formatDateForDisplay(viewingQuote.clientDateOfBirth, "MMM dd, yyyy")}
                                  <span className="text-foreground/60">
                                    ({calculateAge(viewingQuote.clientDateOfBirth) || 0} years)
                                  </span>
                                </>
                              ) : 'N/A'}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="flex items-center gap-2 font-mono">
                              <IdCard className="h-4 w-4" />
                              {viewingQuote.clientSsn || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {viewingQuote.physical_street}, {viewingQuote.physical_city}, {viewingQuote.physical_state} {viewingQuote.physical_postal_code}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    {/* Quote Info - Moved here */}
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
                        Effective {formatDateForDisplay(viewingQuote.effectiveDate, "MMM dd, yyyy")}
                      </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        size="sm" 
                        data-testid="button-search-plans"
                        onClick={() => setLocation(`/quotes/${viewingQuote.id}/marketplace-plans`)}
                      >
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
                          <p className="text-sm mt-0.5 flex items-center gap-1.5">
                            <span>
                              {viewingQuote.clientDateOfBirth ? formatDateForDisplay(viewingQuote.clientDateOfBirth, "MMM dd, yyyy") : 'N/A'}
                              {viewingQuote.clientDateOfBirth && (
                                <span className="text-foreground/60 ml-2">
                                  ({calculateAge(viewingQuote.clientDateOfBirth) || 0} years)
                                </span>
                              )}
                            </span>
                            {viewingQuote.clientDateOfBirth && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{formatDateForDisplay(viewingQuote.clientDateOfBirth, "MMMM dd, yyyy")}</p>
                                </TooltipContent>
                              </Tooltip>
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
                          <p className="text-sm font-mono mt-0.5">
                            {viewingQuote.clientSsn || 'N/A'}
                          </p>
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
                            {viewingQuote.physical_street}
                            {viewingQuote.physical_address_line_2 && <span>, {viewingQuote.physical_address_line_2}</span>}
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
                            {viewingQuote.physical_city}, {viewingQuote.physical_state} {viewingQuote.physical_postal_code}
                            {viewingQuote.physical_county && (
                              <span className="block text-xs text-foreground/60 mt-0.5">{viewingQuote.physical_county} County</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                      <p className="text-sm font-medium mt-1">{formatDateForDisplay(viewingQuote.effectiveDate, "MMM dd, yyyy")}</p>
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

              {/* Family Members Section - Horizontal Layout */}
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
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setAddingMember(true)}
                    data-testid="button-add-member"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Member
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="border-t">
                    {/* Primary Applicant */}
                    <div className="grid grid-cols-[auto_1fr_80px] gap-3 p-3 bg-primary/5 border-b hover-elevate items-center">
                      <Avatar className="h-9 w-9 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
                          {viewingQuote.clientFirstName?.[0]}{viewingQuote.clientLastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 min-w-0">
                        <div>
                          <p className="font-semibold text-sm truncate">
                            {viewingQuote.clientFirstName} {viewingQuote.clientLastName}
                          </p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            <Badge variant="default" className="text-xs h-4 px-1.5">Self</Badge>
                            {viewingQuote.clientIsApplicant && (
                              <Badge variant="secondary" className="text-xs h-4 px-1.5">Applicant</Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">DOB:</span>
                            <p className="font-medium">
                              {viewingQuote.clientDateOfBirth ? formatDateForDisplay(viewingQuote.clientDateOfBirth, "MMM dd, yyyy") : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Age:</span>
                            <p className="font-medium">{calculateAge(viewingQuote.clientDateOfBirth) || 0} yrs</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Gender:</span>
                            <p className="font-medium">{viewingQuote.clientGender ? viewingQuote.clientGender.charAt(0).toUpperCase() + viewingQuote.clientGender.slice(1) : 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">SSN:</span>
                            <p className="font-mono font-medium">
                              {viewingQuote.clientSsn || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Immigration:</span>
                            <p className="font-medium text-xs">{getImmigrationStatusDisplay(getMemberDetails('client')?.immigration)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Income:</span>
                            <p className="font-medium text-xs">
                              {getMemberDetails('client')?.income?.totalAnnualIncome 
                                ? `$${parseFloat(getMemberDetails('client')?.income?.totalAnnualIncome).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0" 
                          onClick={() => setEditingMember({ type: 'primary' })}
                          data-testid="button-view-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <div className="h-7 w-7" />
                      </div>
                    </div>

                    {/* Spouses */}
                    {membersDetailsData?.members?.filter(m => m.role === 'spouse').map((spouse, index) => (
                      <div key={`spouse-${spouse.id}`} className="grid grid-cols-[auto_1fr_80px] gap-3 p-3 border-b hover-elevate items-center">
                        <Avatar className="h-9 w-9 border-2 border-muted">
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                            {spouse.firstName?.[0]}{spouse.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 min-w-0">
                          <div>
                            <p className="font-semibold text-sm truncate">
                              {spouse.firstName} {spouse.lastName}
                            </p>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-xs h-4 px-1.5">Spouse</Badge>
                              {spouse.isApplicant && (
                                <Badge variant="secondary" className="text-xs h-4 px-1.5">Applicant</Badge>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">DOB:</span>
                              <p className="font-medium">
                                {spouse.dateOfBirth ? formatDateForDisplay(spouse.dateOfBirth, "MMM dd, yyyy") : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Age:</span>
                              <p className="font-medium">{calculateAge(spouse.dateOfBirth) || 0} yrs</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Gender:</span>
                              <p className="font-medium">{spouse.gender ? spouse.gender.charAt(0).toUpperCase() + spouse.gender.slice(1) : 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">SSN:</span>
                              <p className="font-mono font-medium">
                                {spouse.ssn || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Immigration:</span>
                              <p className="font-medium text-xs">{getImmigrationStatusDisplay(spouse.immigration)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Income:</span>
                              <p className="font-medium text-xs">
                                {spouse.income?.totalAnnualIncome 
                                  ? `$${parseFloat(spouse.income.totalAnnualIncome).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0" 
                            onClick={() => setEditingMember({ type: 'spouse', index })}
                            data-testid={`button-view-spouse-${index}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive" 
                            onClick={() => setDeletingMember({ 
                              id: spouse.id, 
                              name: `${spouse.firstName} ${spouse.lastName}`,
                              role: 'Spouse'
                            })}
                            data-testid={`button-delete-spouse-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Dependents */}
                    {membersDetailsData?.members?.filter(m => m.role === 'dependent').map((dependent, index) => (
                      <div key={`dependent-${dependent.id}`} className="grid grid-cols-[auto_1fr_80px] gap-3 p-3 border-b last:border-b-0 hover-elevate items-center">
                        <Avatar className="h-9 w-9 border-2 border-muted">
                          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                            {dependent.firstName?.[0]}{dependent.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 min-w-0">
                          <div>
                            <p className="font-semibold text-sm truncate">
                              {dependent.firstName} {dependent.lastName}
                            </p>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-xs h-4 px-1.5">{dependent.relation || 'Dependent'}</Badge>
                              {dependent.isApplicant && (
                                <Badge variant="secondary" className="text-xs h-4 px-1.5">Applicant</Badge>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">DOB:</span>
                              <p className="font-medium">
                                {dependent.dateOfBirth ? formatDateForDisplay(dependent.dateOfBirth, "MMM dd, yyyy") : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Age:</span>
                              <p className="font-medium">{calculateAge(dependent.dateOfBirth) || 0} yrs</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Gender:</span>
                              <p className="font-medium">{dependent.gender ? dependent.gender.charAt(0).toUpperCase() + dependent.gender.slice(1) : 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">SSN:</span>
                              <p className="font-mono font-medium">
                                {dependent.ssn || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Immigration:</span>
                              <p className="font-medium text-xs">{getImmigrationStatusDisplay(dependent.immigration)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Income:</span>
                              <p className="font-medium text-xs">
                                {dependent.income?.totalAnnualIncome 
                                  ? `$${parseFloat(dependent.income.totalAnnualIncome).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                  : '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0" 
                            onClick={() => setEditingMember({ type: 'dependent', index })}
                            data-testid={`button-view-dependent-${index}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive" 
                            onClick={() => setDeletingMember({ 
                              id: dependent.id, 
                              name: `${dependent.firstName} ${dependent.lastName}`,
                              role: dependent.relation || 'Dependent'
                            })}
                            data-testid={`button-delete-dependent-${index}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Address Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Physical Address */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">Physical address</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-3" 
                        onClick={() => setEditingAddresses('physical')}
                        data-testid="button-edit-physical-address"
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm">{viewingQuote.physical_street}</p>
                    {viewingQuote.physical_address_line_2 && (
                      <p className="text-sm">{viewingQuote.physical_address_line_2}</p>
                    )}
                    <p className="text-sm">{viewingQuote.physical_city}, {viewingQuote.physical_state} {viewingQuote.physical_postal_code}</p>
                    {viewingQuote.physical_county && (
                      <p className="text-xs text-muted-foreground mt-2">{viewingQuote.physical_county} County</p>
                    )}
                  </CardContent>
                </Card>

                {/* Mailing Address */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">Mailing address</CardTitle>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3" 
                          onClick={() => setEditingAddresses('mailing')}
                          data-testid="button-edit-mailing-address"
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        {viewingQuote.mailing_street && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeletingAddress('mailing')}
                            data-testid="button-delete-mailing-address"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {viewingQuote.mailing_street ? (
                      <div className="space-y-1">
                        <p className="text-sm">{viewingQuote.mailing_street}</p>
                        {viewingQuote.mailing_address_line_2 && (
                          <p className="text-sm">{viewingQuote.mailing_address_line_2}</p>
                        )}
                        <p className="text-sm">{viewingQuote.mailing_city}, {viewingQuote.mailing_state} {viewingQuote.mailing_postal_code}</p>
                        {viewingQuote.mailing_county && (
                          <p className="text-xs text-muted-foreground mt-2">{viewingQuote.mailing_county} County</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <MapPin className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Billing Address */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">Billing address</CardTitle>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3" 
                          onClick={() => setEditingAddresses('billing')}
                          data-testid="button-edit-billing-address"
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        {viewingQuote.billing_street && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeletingAddress('billing')}
                            data-testid="button-delete-billing-address"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {viewingQuote.billing_street ? (
                      <div className="space-y-1">
                        <p className="text-sm">{viewingQuote.billing_street}</p>
                        {viewingQuote.billing_address_line_2 && (
                          <p className="text-sm">{viewingQuote.billing_address_line_2}</p>
                        )}
                        <p className="text-sm">{viewingQuote.billing_city}, {viewingQuote.billing_state} {viewingQuote.billing_postal_code}</p>
                        {viewingQuote.billing_county && (
                          <p className="text-xs text-muted-foreground mt-2">{viewingQuote.billing_county} County</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <MapPin className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Payment methods</CardTitle>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setPaymentMethodsSheet({open: true})}
                    data-testid="button-add-payment-method"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingPaymentMethods ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (paymentMethodsData?.paymentMethods || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No payment methods on file
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(paymentMethodsData?.paymentMethods || []).map((pm, index) => (
                        <div 
                          key={pm.id} 
                          className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                              <CreditCard className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {pm.paymentType === 'card' ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm">
                                      {getCardType(pm.cardNumber || '')} •••• {(pm.cardNumber || '').slice(-4)}
                                    </p>
                                    {pm.isDefault && (
                                      <Badge variant="default" className="text-xs">Default</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Expires {pm.expirationMonth}/{pm.expirationYear}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm">
                                      {pm.accountType === 'checking' ? 'Checking' : 'Savings'} •••• {(pm.accountNumber || '').slice(-4)}
                                    </p>
                                    {pm.isDefault && (
                                      <Badge variant="default" className="text-xs">Default</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {pm.bankName}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {!pm.isDefault && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => setDefaultPaymentMethodMutation.mutate(pm.id)}
                                disabled={setDefaultPaymentMethodMutation.isPending}
                                data-testid={`button-set-default-${index}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setPaymentMethodsSheet({open: true, paymentMethodId: pm.id})}
                              data-testid={`button-edit-payment-${index}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => deletePaymentMethodMutation.mutate(pm.id)}
                              disabled={deletePaymentMethodMutation.isPending}
                              data-testid={`button-delete-payment-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CMS Marketplace Plans */}
              <MarketplacePlansSection quoteId={viewingQuote.id} autoLoad={autoLoadMarketplacePlans} />

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
              quote={viewingQuoteWithMembers}
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
              open={!!editingAddresses}
              onOpenChange={(open: boolean) => !open && setEditingAddresses(null)}
              quote={viewingQuote}
              addressType={editingAddresses}
              onSave={(data: Partial<Quote>) => {
                updateQuoteMutation.mutate({
                  quoteId: viewingQuote.id,
                  data
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

            <AddPaymentMethodSheet
              open={paymentMethodsSheet.open}
              onOpenChange={(open) => setPaymentMethodsSheet({open})}
              quote={viewingQuote}
              paymentMethodId={paymentMethodsSheet.paymentMethodId}
            />

            <AddMemberSheet
              open={addingMember}
              onOpenChange={setAddingMember}
              quote={viewingQuote}
              onSave={(data) => addMemberMutation.mutate(data)}
              isPending={addMemberMutation.isPending}
            />

            {/* Delete Member Confirmation Dialog */}
            <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
              <AlertDialogContent data-testid="dialog-delete-member">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Family Member?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div>
                      {deletingMember && (
                        <>
                          <p>
                            Are you sure you want to remove <strong>{deletingMember.name}</strong> ({deletingMember.role}) from this quote?
                          </p>
                          <p className="mt-4">This will delete:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>All personal information</li>
                            <li>Employment and income data</li>
                            <li>Immigration records</li>
                            <li>All uploaded documents</li>
                          </ul>
                          <p className="mt-4">
                            <strong className="text-destructive">This action cannot be undone.</strong>
                          </p>
                        </>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete-member">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (deletingMember) {
                        deleteMemberMutation.mutate(deletingMember.id);
                      }
                    }}
                    disabled={deleteMemberMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete-member"
                  >
                    {deleteMemberMutation.isPending ? 'Deleting...' : 'Delete Member'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Delete Address Confirmation Dialog */}
            <AlertDialog open={!!deletingAddress} onOpenChange={(open) => !open && setDeletingAddress(null)}>
              <AlertDialogContent data-testid="dialog-delete-address">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {deletingAddress === 'mailing' ? 'Mailing' : 'Billing'} Address?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div>
                      <p>
                        Are you sure you want to remove the {deletingAddress === 'mailing' ? 'mailing' : 'billing'} address from this quote?
                      </p>
                      <p className="mt-4">
                        This will clear all address fields. You can add a new address later if needed.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete-address">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (deletingAddress) {
                        const prefix = deletingAddress === 'mailing' ? 'mailing_' : 'billing_';
                        updateQuoteMutation.mutate({
                          quoteId: viewingQuote.id,
                          data: {
                            [`${prefix}street`]: null,
                            [`${prefix}address_line_2`]: null,
                            [`${prefix}city`]: null,
                            [`${prefix}state`]: null,
                            [`${prefix}postal_code`]: null,
                            [`${prefix}county`]: null,
                          }
                        }, {
                          onSuccess: () => {
                            setDeletingAddress(null);
                            toast({
                              title: "Address deleted",
                              description: `${deletingAddress === 'mailing' ? 'Mailing' : 'Billing'} address has been removed.`
                            });
                          }
                        });
                      }
                    }}
                    disabled={updateQuoteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete-address"
                  >
                    {updateQuoteMutation.isPending ? 'Deleting...' : 'Delete Address'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                                  {quote.physical_city}, {quote.physical_state} {quote.physical_postal_code}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm text-blue-600 dark:text-blue-400">
                                  {product?.name || quote.productType}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Effective {formatDateForDisplay(quote.effectiveDate, "MMM dd, yyyy")}
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
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => {
                                      setQuoteToDelete({
                                        id: quote.id,
                                        clientName: `${quote.clientFirstName} ${quote.clientLastName}`,
                                      });
                                      setDeleteDialogOpen(true);
                                    }}
                                    data-testid={`button-delete-quote-${quote.id}`}
                                  >
                                    Delete
                                  </DropdownMenuItem>
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
                              <FormLabel>Social Security *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field}
                                  type="text" 
                                  data-testid="input-client-ssn" 
                                  placeholder="XXX-XX-XXXX"
                                  className="font-mono"
                                  value={formatSSN(field.value || '')}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                    // Store formatted SSN with dashes (e.g., 984-06-5406)
                                    field.onChange(formatSSN(digits));
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

                      <FormField
                        control={form.control}
                        name="clientPregnant"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-client-pregnant"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-2 cursor-pointer">
                                Pregnant
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">If you are pregnant, you can't be denied coverage. You'll also see <strong>free</strong> pregnancy-related services on every plan. And you may qualify for additional financial assistance. This is all thanks to laws created by the Affordable Care Act.</p>
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

                {/* Step 3: Family Members */}
                {currentStep === 3 && (
                  <div className="space-y-6 px-8">
                    {/* Family Members Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Spouses and Dependents</h3>
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
                                  <FormLabel>Social Security *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="text" 
                                      data-testid={`input-spouse-ssn-${index}`} 
                                      placeholder="XXX-XX-XXXX"
                                      className="font-mono"
                                      value={formatSSN(field.value || '')}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                        // Store formatted SSN with dashes (e.g., 984-06-5406) as plain text
                                        field.onChange(formatSSN(digits));
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

                            <FormField
                              control={form.control}
                              name={`spouses.${index}.pregnant`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-spouse-pregnant-${index}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Pregnant
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">If you are pregnant, you can't be denied coverage. You'll also see <strong>free</strong> pregnancy-related services on every plan. And you may qualify for additional financial assistance. This is all thanks to laws created by the Affordable Care Act.</p>
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
                                  <FormLabel>Social Security *</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      type="text" 
                                      data-testid={`input-dependent-ssn-${index}`} 
                                      placeholder="XXX-XX-XXXX"
                                      className="font-mono"
                                      value={formatSSN(field.value || '')}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                                        // Store formatted SSN with dashes (e.g., 984-06-5406) as plain text
                                        field.onChange(formatSSN(digits));
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

                            <FormField
                              control={form.control}
                              name={`dependents.${index}.pregnant`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-dependent-pregnant-${index}`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="cursor-pointer">Pregnant</FormLabel>
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
                      onClick={handleNext}
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
        quote={viewingQuote!}
        memberType={editingMember?.type}
        memberIndex={editingMember?.index}
        onSave={(data) => {
          updateQuoteMutation.mutate({
            quoteId: viewingQuote!.id,
            data,
          });
          // Don't close immediately - let handleSave complete async operations first
        }}
        isPending={updateQuoteMutation.isPending}
        onMemberChange={(type, index) => {
          setEditingMember({ type, index });
        }}
      />

      {/* Delete Quote Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-quote">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {quoteToDelete && (
                  <>
                    <p>
                      Are you sure you want to permanently delete the quote for <strong>{quoteToDelete.clientName}</strong>?
                    </p>
                    <p className="mt-4">This will delete:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>The quote and all client information</li>
                      <li>All family members (spouse, dependents)</li>
                      <li>All income data</li>
                      <li>All immigration documents and records</li>
                      <li>All uploaded files</li>
                    </ul>
                    <p className="mt-4">
                      <strong className="text-destructive">This action cannot be undone.</strong>
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (quoteToDelete) {
                  deleteQuoteMutation.mutate(quoteToDelete.id);
                }
              }}
              disabled={deleteQuoteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteQuoteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
