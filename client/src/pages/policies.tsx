import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneInput } from "@shared/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, ChevronLeft, ChevronRight, Calendar, User, Users, MapPin, FileText, Check, Search, Info, Trash2, Heart, Building2, Shield, Smile, DollarSign, PiggyBank, Plane, Cross, Filter, RefreshCw, ChevronDown, ArrowLeft, ArrowRight, Mail, CreditCard, Phone, Hash, IdCard, Home, Bell, Copy, X, Archive, ChevronsUpDown, Pencil, Loader2, AlertCircle, StickyNote, FileSignature, Briefcase, ListTodo, ScrollText, Eye, EyeOff, Image, File, Download, Upload, CheckCircle2, Clock, ExternalLink, MoreHorizontal, MoreVertical, Send, Printer, Save, Lock, Edit, Folder as FolderIcon } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getCompanyQueryOptions } from "@/lib/queryClient";
import { useForm, useFieldArray, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User as UserType, type Quote, type QuotePaymentMethod, type InsertPaymentMethod, insertPaymentMethodSchema, type QuoteMember, type QuoteMemberIncome, type QuoteMemberImmigration, type QuoteMemberDocument, type QuoteReminder, type InsertQuoteReminder, insertQuoteReminderSchema } from "@shared/schema";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format, startOfMonth, addMonths, parseISO } from "date-fns";
import { policyStatusOptions, documentsStatusOptions, paymentStatusOptions, useUpdateStatuses, statusFormSchema, type StatusFormValues } from "@/lib/status-editor";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import { useTabsState } from "@/hooks/use-tabs-state";
import {
  detectCardType,
  getCardTypeInfo,
  formatCardNumber,
  cleanCardNumber,
  type CardType
} from "@shared/creditCardUtils";
import { CARRIERS_BY_TYPE, PRODUCT_TYPES as SIMPLE_PRODUCT_TYPES, getCarriersByProductType } from "@shared/carriers";
import { PolicyRenewalComparison } from "@/components/PolicyRenewalComparison";
import { parseCostShareValue, formatCostShareValue, formatCostShareValueShort, extractCostShareFromCMS, type CostShareValue } from "@shared/cost-share-utils";

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

// Format Phone Number with automatic formatting (XXX) XXX-XXXX
const formatPhoneNumber = (value: string) => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  // Format as (XXX) XXX-XXXX
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
};

// Helper to format date for input fields - extracts YYYY-MM-DD from any format
const formatDateForInput = (date: string | null | undefined): string => {
  if (!date) return '';
  // Extract YYYY-MM-DD from any date format (handles both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ")
  // This ensures HTML <input type="date"> receives a valid value
  const dateOnly = date.split('T')[0];
  return dateOnly;
};

// Helper to ensure date is in yyyy-MM-dd format for backend (no time component)
// This prevents schema validation errors that require strict yyyy-MM-dd format
const formatDateForBackend = (date: string | null | undefined): string | null => {
  if (!date) return null;
  // Extract YYYY-MM-DD from any date format (handles both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ")
  const dateOnly = date.split('T')[0];
  return dateOnly;
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

// Badge variant helper functions for status badges
function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" | "success" | "warning" {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
    new: "default",
    waiting_on_agent: "secondary",
    waiting_for_approval: "secondary",
    updated_by_client: "default",
    completed: "success",
    renewed: "outline",
    canceled: "destructive",
  };
  return variants[status] || "outline";
}

function getDocumentsStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" | "success" | "warning" {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
    pending: "warning",
    in_progress: "default",
    processing: "default",
    reviewed: "secondary",
    sent_to_client: "outline",
    completed: "success",
    declined: "destructive",
  };
  return variants[status] || "secondary";
}

function getPaymentStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" | "success" | "warning" {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
    pending: "warning",
    unpaid: "destructive",
    auto_pay: "success",
    failed: "destructive",
    paid: "success",
    not_applicable: "secondary",
  };
  return variants[status] || "secondary";
}

function formatStatusDisplay(status: string | undefined): string {
  if (!status) return "N/A";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPaymentStatusDisplay(status: string | undefined): string {
  if (!status) return "N/A";
  if (status === "not_applicable") return "Not applicable ($0)";
  return formatStatusDisplay(status);
}

// Get color class for documents status text
function getDocumentsStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-yellow-600 dark:text-yellow-500",
    in_progress: "text-blue-600 dark:text-blue-400",
    processing: "text-blue-600 dark:text-blue-400",
    reviewed: "text-purple-600 dark:text-purple-400",
    sent_to_client: "text-indigo-600 dark:text-indigo-400",
    completed: "text-green-600 dark:text-green-500",
    declined: "text-red-600 dark:text-red-500",
  };
  return colors[status] || "text-foreground";
}

// Get color class for payment status text
function getPaymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-yellow-600 dark:text-yellow-500",
    unpaid: "text-red-600 dark:text-red-500",
    auto_pay: "text-green-600 dark:text-green-500",
    failed: "text-red-600 dark:text-red-500",
    paid: "text-green-600 dark:text-green-500",
    not_applicable: "text-gray-500 dark:text-gray-400",
  };
  return colors[status] || "text-foreground";
}

// Carrier lists imported from shared module

// Helper to capitalize first letter of a string
const capitalize = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
  
  // Get raw digits first (without any formatting)
  const rawDigits = ssn.replace(/\D/g, '').slice(0, 9);
  
  // Only show full SSN if it's complete (9 raw digits) AND visibility is enabled
  if (isVisible && rawDigits.length === 9) {
    return formatSSN(rawDigits);
  } else {
    // Always show masked format for incomplete or hidden SSN
    if (rawDigits.length >= 4) {
      return `XXX-XX-${rawDigits.slice(-4)}`;
    }
    return 'XXX-XX-XXXX';
  }
};

// Format Phone Number with automatic formatting (XXX) XXX-XXXX

// Format file size from bytes to human-readable format
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Helper to extract raw value from CostShareValue or legacy string
// Used when loading existing plans for editing in the manual plan form
const getCostShareRawValue = (value: any): string => {
  if (!value) return '';
  // New format: CostShareValue object with 'raw' property
  if (typeof value === 'object' && value.raw) {
    return value.raw;
  }
  // Legacy format: plain string
  if (typeof value === 'string') {
    return value;
  }
  return '';
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

// Product types with descriptions (sorted alphabetically by name)
const PRODUCT_TYPES = [
  {
    id: "annuities",
    name: "Annuities",
    description: "Financial products that provide guaranteed income, typically for retirement",
    icon: PiggyBank,
  },
  {
    id: "dental",
    name: "Dental",
    description: "Coverage for preventive, basic, and major dental care services",
    icon: Smile,
  },
  {
    id: "final_expense",
    name: "Final Expense",
    description: "Affordable life insurance to cover funeral and end-of-life costs",
    icon: DollarSign,
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
    id: "medicaid",
    name: "Medicaid",
    description: "State and federal program offering health coverage for low-income individuals and families",
    icon: Heart,
  },
  {
    id: "medicare",
    name: "Medicare",
    description: "Government health insurance for individuals 65+ or with certain disabilities",
    icon: Shield,
  },
  {
    id: "private",
    name: "Private",
    description: "Health plans offered outside of government programs, with customizable coverage options",
    icon: Building2,
  },
  {
    id: "supplemental",
    name: "Supplemental",
    description: "Additional insurance that pays benefits for specific events like accidents, critical illness, or hospital stays",
    icon: Plus,
  },
  {
    id: "travel",
    name: "Travel",
    description: "Coverage for medical emergencies, trip cancellations, and travel-related issues",
    icon: Plane,
  },
  {
    id: "vision",
    name: "Vision",
    description: "Insurance for eye exams, glasses, contact lenses, and more",
    icon: Smile,
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
  middleName: z.string().default(''),
  lastName: z.string().min(1, "Last name is required"),
  secondLastName: z.string().default(''),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  ssn: z.string().min(1, "SSN is required"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().default(''),
  email: z.string().default(''),
  isApplicant: z.boolean().default(true), // Default: dependent needs insurance (not on Medicaid/CHIP)
  isPrimaryDependent: z.boolean().default(false),
  tobaccoUser: z.boolean().default(false),
  pregnant: z.boolean().default(false),
  preferredLanguage: z.string().default(''),
  countryOfBirth: z.string().default(''),
  maritalStatus: z.string().default(''),
  weight: z.string().default(''),
  height: z.string().default(''),
  // Income fields
  employerName: z.string().default(''),
  employerPhone: z.string().default(''),
  position: z.string().default(''),
  annualIncome: z.string().default(''),
  incomeFrequency: z.string().default('annually'), // weekly, biweekly, monthly, annually
  incomeSource: z.string().default(''), // employment, self-employment, social-security, pension, unemployment, alimony, investment, rental, other
  selfEmployed: z.boolean().default(false),
  // Immigration fields
  immigrationStatus: z.string().default(''),
  naturalizationNumber: z.string().default(''), // Only for citizens
  uscisNumber: z.string().default(''),
  immigrationStatusCategory: z.string().default(''),
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

const step4Schema = z.object({
  // Primary applicant income
  clientAnnualIncome: z.string().default(''),
  clientIncomeFrequency: z.string().default('annually'),
  clientIncomeSource: z.string().default(''),
  clientEmployerName: z.string().default(''),
});

const completeQuoteSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema);

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
    if (addressType === 'physical') return 'Update the physical address for this policy';
    if (addressType === 'mailing') return 'Update the mailing address for this policy';
    if (addressType === 'billing') return 'Update the billing address for this policy';
    return 'Update the address for this policy';
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

// Helper functions for income field (outside render to avoid recreation)
const calculateAnnualIncome = (amount: string, frequency: string): string => {
  const num = parseFloat(amount || '0');
  if (isNaN(num) || num <= 0) return '0';
  
  switch (frequency) {
    case 'annually':
      return amount;
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

const getFrequencyLabel = (frequency: string): string => {
  switch (frequency) {
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Biweekly';
    case 'monthly': return 'Monthly';
    default: return 'Annual';
  }
};

// Optimized Income Field Component
const IncomeField = React.memo(({ control, frequency }: { control: any; frequency: string }) => {
  const [isFocused, setIsFocused] = useState(false);
  const { field, fieldState } = useController({
    name: 'annualIncome',
    control,
  });

  const frequencyLabel = useMemo(() => getFrequencyLabel(frequency), [frequency]);
  
  const displayValue = useMemo(() => {
    if (isFocused) return field.value || '';
    if (!field.value) return '';
    return parseFloat(field.value).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }, [isFocused, field.value]);
  
  const annualAmount = useMemo(() => calculateAnnualIncome(field.value || '0', frequency), [field.value, frequency]);
  const showAnnualEquivalent = useMemo(() => {
    return field.value && parseFloat(field.value) > 0 && frequency !== 'annually';
  }, [field.value, frequency]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/[^\d.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    field.onChange(value);
  }, [field]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    let value = e.target.value.replace(/,/g, '').trim();
    
    // Always update the field state
    if (!value || value === '') {
      // Empty field = delete income
      field.onChange('');
    } else {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        // Format to 2 decimals (including zero)
        field.onChange(num.toFixed(2));
      }
    }
    field.onBlur();
  }, [field]);

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
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
      </FormControl>
      {showAnnualEquivalent && (
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
          <p className="text-xs font-medium text-primary">
            Annual Equivalent: ${parseFloat(annualAmount).toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            })}
          </p>
        </div>
      )}
      {fieldState.error && <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>}
    </FormItem>
  );
});

IncomeField.displayName = 'IncomeField';

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
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const hasInitializedRef = useRef(false);
  
  const editMemberSchema = memberType === 'dependent'
    ? dependentSchema
    : familyMemberSchema;

  // Fetch policy members to get member IDs
  const { data: membersData, isLoading: isLoadingMembers } = useQuery<{ members: any[] }>({
    queryKey: ['/api/policies', quote?.id, 'members'],
    queryFn: async () => {
      const res = await fetch(`/api/policies/${quote?.id}/members`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch members');
      }
      return res.json();
    },
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

  const isMemberDataReady = open && !isLoadingMembers;

  // Use useMemo to prevent unnecessary recalculation and form resets
  const memberData = useMemo(() => {
    if (!quote || !memberType || !membersData?.members) return null;
    
    if (memberType === 'primary') {
      return {
        firstName: quote.clientFirstName || '',
        middleName: quote.clientMiddleName || '',
        lastName: quote.clientLastName || '',
        secondLastName: quote.clientSecondLastName || '',
        email: quote.clientEmail || '',
        phone: quote.clientPhone || '',
        dateOfBirth: formatDateForInput(quote.clientDateOfBirth) || '',
        ssn: normalizeSSN(quote.clientSsn) || '',
        gender: quote.clientGender || '',
        isApplicant: quote.clientIsApplicant ?? true,
        tobaccoUser: quote.clientTobaccoUser ?? false,
        pregnant: quote.clientPregnant ?? false,
        preferredLanguage: quote.clientPreferredLanguage || '',
        countryOfBirth: quote.clientCountryOfBirth || '',
        maritalStatus: quote.clientMaritalStatus || '',
        weight: quote.clientWeight || '',
        height: quote.clientHeight || '',
        employerName: '',
        employerPhone: '',
        position: '',
        annualIncome: '',
        incomeFrequency: 'annually',
        selfEmployed: false,
        immigrationStatus: '',
        naturalizationNumber: '',
        uscisNumber: '',
        immigrationStatusCategory: '',
      };
    } else if (memberType === 'spouse' && memberIndex !== undefined) {
      const spouses = membersData.members.filter(m => m.role === 'spouse');
      let spouse = spouses[memberIndex];
      
      if (!spouse && quote.spouses && quote.spouses[memberIndex]) {
        spouse = quote.spouses[memberIndex];
      }
      
      return spouse ? {
        firstName: spouse.firstName || '',
        middleName: spouse.middleName || '',
        lastName: spouse.lastName || '',
        secondLastName: spouse.secondLastName || '',
        email: spouse.email || '',
        phone: spouse.phone || '',
        dateOfBirth: formatDateForInput(spouse.dateOfBirth) || '',
        ssn: normalizeSSN(spouse.ssn) || '',
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
        employerName: '',
        employerPhone: '',
        position: '',
        annualIncome: '',
        incomeFrequency: 'annually',
        selfEmployed: false,
        immigrationStatus: '',
        naturalizationNumber: '',
        uscisNumber: '',
        immigrationStatusCategory: '',
      } : null;
    } else if (memberType === 'dependent' && memberIndex !== undefined) {
      const dependents = membersData.members.filter(m => m.role === 'dependent');
      let dependent = dependents[memberIndex];
      
      if (!dependent && quote.dependents && quote.dependents[memberIndex]) {
        dependent = quote.dependents[memberIndex];
      }
      
      return dependent ? {
        firstName: dependent.firstName || '',
        middleName: dependent.middleName || '',
        lastName: dependent.lastName || '',
        secondLastName: dependent.secondLastName || '',
        email: dependent.email || '',
        phone: dependent.phone || '',
        dateOfBirth: formatDateForInput(dependent.dateOfBirth) || '',
        ssn: normalizeSSN(dependent.ssn) || '',
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
        employerName: '',
        employerPhone: '',
        position: '',
        annualIncome: '',
        incomeFrequency: 'annually',
        selfEmployed: false,
        immigrationStatus: '',
        naturalizationNumber: '',
        uscisNumber: '',
        immigrationStatusCategory: '',
      } : null;
    }
    return null;
  }, [quote?.id, memberType, memberIndex, membersData]);
  
  const editForm = useForm({
    resolver: zodResolver(editMemberSchema),
    defaultValues: memberData || {},
    shouldUnregister: false,
  });

  // Track previous member to detect genuine member switches
  const prevMemberIdRef = useRef(currentMemberId);
  
  // Reset the initialization flag when sheet closes
  useEffect(() => {
    if (!open) {
      hasInitializedRef.current = false;
      prevMemberIdRef.current = undefined;
    }
  }, [open]);
  
  // CRITICAL: Only reset when actually switching members (not on refetch)
  useEffect(() => {
    // Only reset if currentMemberId genuinely changed (not just a refetch)
    if (currentMemberId !== prevMemberIdRef.current) {
      hasInitializedRef.current = false;
      prevMemberIdRef.current = currentMemberId;
    }
  }, [currentMemberId]);

  // Reset form ONCE when data is ready AND member has changed
  useEffect(() => {
    if (isMemberDataReady && memberData && !hasInitializedRef.current) {
      editForm.reset(memberData, { keepDirty: false });
      hasInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMemberDataReady, hasInitializedRef.current]);

  const handleSave = (data: z.infer<typeof editMemberSchema>) => {
    setCountryPopoverOpen(false);
    
    if (memberType === 'primary') {
      onSave({
        clientFirstName: data.firstName,
        clientMiddleName: data.middleName,
        clientLastName: data.lastName,
        clientSecondLastName: data.secondLastName,
        clientEmail: data.email,
        clientPhone: data.phone,
        clientDateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : null,
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
  };

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

  // Show loading screen until ALL data is ready (members + income + immigration)
  if (!isMemberDataReady || !memberData) {
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
    <Sheet open={open} onOpenChange={onOpenChange}>
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
              disabled={isPending}
              data-testid="button-save"
              onClick={editForm.handleSubmit(handleSave)}
              className="mr-10 min-w-[120px]"
            >
              {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isPending ? 'Saving...' : 'Save'}
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
            <div className="flex-1 overflow-y-auto p-4">
              <Accordion type="multiple" defaultValue={["basic", "income", "immigration"]} className="space-y-4">
                {/* Basic Information */}
                <AccordionItem value="basic" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Basic Information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-6">
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
                            data-testid="checkbox-is-dependent"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2 cursor-pointer">
                            Dependent
                          </FormLabel>
                        </div>
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
                  </AccordionContent>
                </AccordionItem>

                {/* Income & Employment */}
                <AccordionItem value="income" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium">Income & Employment</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-4">
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

                  {/* Income Amount - Optimized */}
                  <IncomeField control={editForm.control} frequency={editForm.watch('incomeFrequency') || 'annually'} />
                </div>
                </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Immigration Status */}
                <AccordionItem value="immigration" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4" />
                      <span className="font-medium">Immigration Status</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-4">
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// Inline Member Editor Component - Renders inline expansion panel with accordion sections
interface InlineMemberEditorProps {
  quoteId: string;
  quote: QuoteWithArrays;
  memberType: 'primary' | 'spouse' | 'dependent';
  memberIndex?: number;
  onClose: () => void;
  onSave: (data: Partial<Quote>) => void;
  isPending: boolean;
}

function InlineMemberEditor({ quoteId, quote, memberType, memberIndex, onClose, onSave, isPending }: InlineMemberEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const hasInitializedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const editMemberSchema = memberType === 'dependent' ? dependentSchema : familyMemberSchema;

  // Track current member identity for change detection
  const memberIdentity = `${memberType}-${memberIndex ?? 'primary'}`;
  const previousMemberIdentityRef = useRef(memberIdentity);

  // Fetch policy members to get member IDs
  const { data: membersData, isLoading: isLoadingMembers } = useQuery<{ members: any[] }>({
    queryKey: ['/api/policies', quoteId, 'members'],
    queryFn: async () => {
      const res = await fetch(`/api/policies/${quoteId}/members`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
    enabled: !!quoteId,
  });

  // Find the current member ID
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

  // Fetch income data - BUG FIX 1: Guard against null currentMemberId
  const { data: incomeData, isLoading: isLoadingIncome } = useQuery<{ income: any }>({
    queryKey: ['/api/policies/members', currentMemberId, 'income'],
    queryFn: async () => {
      const res = await fetch(`/api/policies/members/${currentMemberId}/income`, {
        credentials: 'include',
      });
      if (res.status === 404) return { income: null };
      if (!res.ok) throw new Error('Failed to fetch income data');
      return res.json();
    },
    enabled: !!currentMemberId,
  });

  // Fetch immigration data - BUG FIX 1: Guard against null currentMemberId
  const { data: immigrationData, isLoading: isLoadingImmigration } = useQuery<{ immigration: any }>({
    queryKey: ['/api/policies/members', currentMemberId, 'immigration'],
    queryFn: async () => {
      const res = await fetch(`/api/policies/members/${currentMemberId}/immigration`, {
        credentials: 'include',
      });
      if (res.status === 404) return { immigration: null };
      if (!res.ok) throw new Error('Failed to fetch immigration data');
      return res.json();
    },
    enabled: !!currentMemberId,
  });

  const isLoadingMemberData = isLoadingMembers || isLoadingIncome || isLoadingImmigration;
  const isMemberDataReady = !isLoadingMembers && (!currentMemberId || (!isLoadingIncome && !isLoadingImmigration));

  // Build member data for form
  const memberData = useMemo(() => {
    if (!quote || !memberType || !membersData?.members) return null;
    
    const income = incomeData?.income || {};
    const immigration = immigrationData?.immigration || {};
    
    if (memberType === 'primary') {
      return {
        firstName: quote.clientFirstName || '',
        middleName: quote.clientMiddleName || '',
        lastName: quote.clientLastName || '',
        secondLastName: quote.clientSecondLastName || '',
        email: quote.clientEmail || '',
        phone: quote.clientPhone || '',
        dateOfBirth: formatDateForInput(quote.clientDateOfBirth) || '',
        ssn: normalizeSSN(quote.clientSsn) || '',
        gender: quote.clientGender || '',
        isApplicant: quote.clientIsApplicant ?? true,
        tobaccoUser: quote.clientTobaccoUser ?? false,
        pregnant: quote.clientPregnant ?? false,
        preferredLanguage: quote.clientPreferredLanguage || '',
        countryOfBirth: quote.clientCountryOfBirth || '',
        maritalStatus: quote.clientMaritalStatus || '',
        weight: quote.clientWeight || '',
        height: quote.clientHeight || '',
        employerName: income.employerName || '',
        employerPhone: income.employerPhone || '',
        position: income.position || '',
        annualIncome: income.annualIncome || '',
        incomeFrequency: income.incomeFrequency || 'annually',
        selfEmployed: income.selfEmployed ?? false,
        immigrationStatus: immigration.immigrationStatus || '',
        naturalizationNumber: immigration.naturalizationNumber || '',
        uscisNumber: immigration.uscisNumber || '',
        immigrationStatusCategory: immigration.immigrationStatusCategory || '',
      };
    } else if (memberType === 'spouse' && memberIndex !== undefined) {
      const spouses = membersData.members.filter(m => m.role === 'spouse');
      let spouse = spouses[memberIndex];
      if (!spouse && quote.spouses && quote.spouses[memberIndex]) {
        spouse = quote.spouses[memberIndex];
      }
      
      return spouse ? {
        firstName: spouse.firstName || '',
        middleName: spouse.middleName || '',
        lastName: spouse.lastName || '',
        secondLastName: spouse.secondLastName || '',
        email: spouse.email || '',
        phone: spouse.phone || '',
        dateOfBirth: formatDateForInput(spouse.dateOfBirth) || '',
        ssn: normalizeSSN(spouse.ssn) || '',
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
        employerName: income.employerName || '',
        employerPhone: income.employerPhone || '',
        position: income.position || '',
        annualIncome: income.annualIncome || '',
        incomeFrequency: income.incomeFrequency || 'annually',
        selfEmployed: income.selfEmployed ?? false,
        immigrationStatus: immigration.immigrationStatus || '',
        naturalizationNumber: immigration.naturalizationNumber || '',
        uscisNumber: immigration.uscisNumber || '',
        immigrationStatusCategory: immigration.immigrationStatusCategory || '',
      } : null;
    } else if (memberType === 'dependent' && memberIndex !== undefined) {
      const dependents = membersData.members.filter(m => m.role === 'dependent');
      let dependent = dependents[memberIndex];
      if (!dependent && quote.dependents && quote.dependents[memberIndex]) {
        dependent = quote.dependents[memberIndex];
      }
      
      return dependent ? {
        firstName: dependent.firstName || '',
        middleName: dependent.middleName || '',
        lastName: dependent.lastName || '',
        secondLastName: dependent.secondLastName || '',
        email: dependent.email || '',
        phone: dependent.phone || '',
        dateOfBirth: formatDateForInput(dependent.dateOfBirth) || '',
        ssn: normalizeSSN(dependent.ssn) || '',
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
        employerName: income.employerName || '',
        employerPhone: income.employerPhone || '',
        position: income.position || '',
        annualIncome: income.annualIncome || '',
        incomeFrequency: income.incomeFrequency || 'annually',
        selfEmployed: income.selfEmployed ?? false,
        immigrationStatus: immigration.immigrationStatus || '',
        naturalizationNumber: immigration.naturalizationNumber || '',
        uscisNumber: immigration.uscisNumber || '',
        immigrationStatusCategory: immigration.immigrationStatusCategory || '',
      } : null;
    }
    return null;
  }, [quoteId, memberType, memberIndex, membersData, incomeData, immigrationData]);
  
  const editForm = useForm({
    resolver: zodResolver(editMemberSchema),
    defaultValues: memberData || {},
    shouldUnregister: false,
  });

  // Save original values for cancel
  const originalValuesRef = useRef(memberData);

  // Reset form when data is ready
  useEffect(() => {
    if (isMemberDataReady && memberData && !hasInitializedRef.current) {
      editForm.reset(memberData, { keepDirty: false });
      originalValuesRef.current = memberData;
      hasInitializedRef.current = true;
    }
  }, [isMemberDataReady, memberData, editForm]);

  // BUG FIX 3: Detect member changes and reset state
  useEffect(() => {
    const currentIdentity = memberIdentity;
    const previousIdentity = previousMemberIdentityRef.current;

    // If member identity changed (switching between members)
    if (currentIdentity !== previousIdentity) {
      // Warn if switching during save
      if (isSaving) {
        toast({
          variant: "destructive",
          title: "Save Canceled",
          description: "Switched to different member. Previous save operation was canceled.",
          duration: 3000,
        });
      }

      // Cancel any in-flight operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Reset all state
      setIsSaving(false);
      setCountryPopoverOpen(false);
      hasInitializedRef.current = false;

      // Reset form to clean state
      if (memberData) {
        editForm.reset(memberData, { keepDirty: false });
        originalValuesRef.current = memberData;
      }

      // Update ref
      previousMemberIdentityRef.current = currentIdentity;
    }
  }, [memberIdentity, isSaving, memberData, editForm, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSave = async (data: z.infer<typeof editMemberSchema>) => {
    // BUG FIX 1: Early validation - don't attempt save without required data
    if (!quoteId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot save: Quote ID is missing.",
        duration: 3000,
      });
      return;
    }

    setCountryPopoverOpen(false);
    setIsSaving(true);
    
    // Create new abort controller for this save operation
    abortControllerRef.current = new AbortController();
    
    toast({
      title: "Saving...",
      description: "Please wait while we save the member information.",
      duration: 10000,
    });
    
    try {
      // Save primary client data to quotes table
      if (memberType === 'primary') {
        onSave({
          quoteId: quoteId,
          data: {
            clientFirstName: data.firstName,
            clientMiddleName: data.middleName,
            clientLastName: data.lastName,
            clientSecondLastName: data.secondLastName,
            clientEmail: data.email,
            clientPhone: data.phone,
            clientDateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : null,
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
          }
        });
      }
      
      // Update normalized quote_members table
      if (currentMemberId) {
        const memberBasicData: any = {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          secondLastName: data.secondLastName,
          email: data.email,
          phone: data.phone,
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : null,
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
        
        const memberResponse = await fetch(`/api/policies/${quoteId}/members/${currentMemberId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(memberBasicData),
        });
        
        if (!memberResponse.ok) {
          throw new Error('Failed to update member');
        }
      }
    
      // Ensure member exists and get memberId
      const ensureResponse = await fetch(`/api/policies/${quoteId}/ensure-member`, {
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
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : null,
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
        throw new Error('Failed to ensure member');
      }
      
      const { memberId } = await ensureResponse.json();
      
      // Calculate total annual income
      let totalAnnualIncome = null;
      if (data.annualIncome !== undefined && data.annualIncome !== null && data.annualIncome !== '') {
        const amount = parseFloat(data.annualIncome);
        if (!isNaN(amount) && amount >= 0) {
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
      
      // Save income and immigration in parallel
      const savePromises = [];
      
      // Income save
      const incomePayload = {
        employerName: data.employerName || null,
        employerPhone: data.employerPhone || null,
        position: data.position || null,
        annualIncome: data.annualIncome || null,
        incomeFrequency: data.incomeFrequency || 'annually',
        totalAnnualIncome: totalAnnualIncome,
        selfEmployed: data.selfEmployed || false,
      };
      
      const hasIncome = data.employerName || data.position || data.annualIncome;
      if (hasIncome) {
        savePromises.push(
          fetch(`/api/policies/members/${memberId}/income`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(incomePayload),
          })
        );
      } else if (incomeData?.income?.id) {
        savePromises.push(
          fetch(`/api/policies/members/${memberId}/income/${incomeData.income.id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        );
      }
      
      // Immigration save
      const immigrationPayload = {
        immigrationStatus: data.immigrationStatus || null,
        naturalizationNumber: data.naturalizationNumber || null,
        uscisNumber: data.uscisNumber || null,
        immigrationStatusCategory: data.immigrationStatusCategory || null,
      };
      
      const hasImmigration = data.immigrationStatus || data.uscisNumber || data.naturalizationNumber;
      if (hasImmigration) {
        savePromises.push(
          fetch(`/api/policies/members/${memberId}/immigration`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(immigrationPayload),
          })
        );
      } else if (immigrationData?.immigration?.id) {
        savePromises.push(
          fetch(`/api/policies/members/${memberId}/immigration/${immigrationData.immigration.id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        );
      }
      
      // Wait for all saves to complete
      const responses = await Promise.all(savePromises);
      const failedResponse = responses.find(r => !r.ok);
      if (failedResponse) {
        throw new Error('Failed to save member data');
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/policies', quoteId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['/api/policies', quoteId, 'members'] });
      if (currentMemberId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies/members', currentMemberId, 'income'] });
        queryClient.invalidateQueries({ queryKey: ['/api/policies/members', currentMemberId, 'immigration'] });
      }
      
      toast({
        title: "Saved",
        description: "Member information has been updated successfully.",
        duration: 3000,
      });
      
      // Update original values and close
      originalValuesRef.current = data;
      onClose();
    } catch (error: any) {
      // BUG FIX 2: Improved error handling with retry guidance
      // Check if error was due to abort (member switch)
      if (error.name === 'AbortError') {
        return; // Silent - already showed warning in useEffect
      }

      toast({
        variant: "destructive",
        title: "Error Saving Member",
        description: error.message || "Failed to save member data. You can edit and retry, or cancel to discard changes.",
        duration: 5000,
      });
      // Form stays open on error so user can retry or cancel
    } finally {
      // BUG FIX 2: Always reset isSaving state
      setIsSaving(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    // BUG FIX 2: Cancel any in-flight operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset to original values
    if (originalValuesRef.current) {
      editForm.reset(originalValuesRef.current, { keepDirty: false });
    }
    
    // Clear saving state
    setIsSaving(false);
    
    onClose();
  };

  if (isLoadingMemberData) {
    return (
      <div className="bg-muted/20 p-6 border-t" data-testid="inline-editor-loading">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading member data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-t" data-testid="inline-member-editor">
      <Form {...editForm}>
        <form onSubmit={editForm.handleSubmit(handleSave)} className="p-6 space-y-4">
          <Accordion type="single" collapsible defaultValue="basic" className="w-full">
            {/* Basic Info Section */}
            <AccordionItem value="basic">
              <AccordionTrigger className="text-base font-semibold" data-testid="accordion-basic-info">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Basic Information
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  {/* First Name */}
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Middle Name */}
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

                  {/* Last Name */}
                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Second Last Name */}
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

                  {/* Date of Birth */}
                  <FormField
                    control={editForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-dob" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* SSN */}
                  <FormField
                    control={editForm.control}
                    name="ssn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSN <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatSSN(e.target.value))}
                            placeholder="XXX-XX-XXXX"
                            data-testid="input-ssn"
                            className="font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Gender */}
                  <FormField
                    control={editForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender <span className="text-destructive">*</span></FormLabel>
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

                  {/* Phone */}
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                            placeholder="(999) 999-9999"
                            data-testid="input-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Marital Status */}
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
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Country of Birth */}
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

                  {/* Preferred Language */}
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

                  {/* Weight */}
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

                  {/* Height */}
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
                  )}

                  {/* Checkboxes */}
                  <div className="lg:col-span-2 space-y-3">
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
                              data-testid="checkbox-is-dependent"
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
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Income Section */}
            <AccordionItem value="income">
              <AccordionTrigger className="text-base font-semibold" data-testid="accordion-income">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Income & Employment
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  {/* Employer Name */}
                  <FormField
                    control={editForm.control}
                    name="employerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Employer or company name" data-testid="input-employer-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Position */}
                  <FormField
                    control={editForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position / Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Job title or occupation" data-testid="input-position" />
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
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Employer Contact</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                            placeholder="(999) 999-9999"
                            data-testid="input-employer-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Income Frequency */}
                  <FormField
                    control={editForm.control}
                    name="incomeFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pay Period</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "annually"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-income-frequency">
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
                  <IncomeField control={editForm.control} frequency={editForm.watch('incomeFrequency') || 'annually'} />

                  {/* Self Employed */}
                  <FormField
                    control={editForm.control}
                    name="selfEmployed"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2 flex flex-row items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-self-employed"
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Self-employed or independent contractor</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Immigration Section */}
            <AccordionItem value="immigration">
              <AccordionTrigger className="text-base font-semibold" data-testid="accordion-immigration">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  Immigration Status
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                  {/* Immigration Status */}
                  <FormField
                    control={editForm.control}
                    name="immigrationStatus"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-immigration-status">
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

                  {/* Naturalization Number (only if citizen) */}
                  {editForm.watch('immigrationStatus') === 'citizen' && (
                    <FormField
                      control={editForm.control}
                      name="naturalizationNumber"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel>Naturalization Certificate #</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter certificate number" data-testid="input-naturalization-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* USCIS Number */}
                  <FormField
                    control={editForm.control}
                    name="uscisNumber"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>USCIS Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="9-digit number (optional)" data-testid="input-uscis-number" className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Immigration Status Category */}
                  <FormField
                    control={editForm.control}
                    name="immigrationStatusCategory"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Status Category</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., I-94, Parole, etc." data-testid="input-immigration-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Save/Cancel Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving || isPending}
              data-testid="button-cancel-inline-edit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isPending}
              data-testid="button-save-inline-edit"
            >
              {isSaving || isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// Helper function to generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const date = new Date();
      date.setHours(hour, minute);
      const display12h = format(date, "h:mm a");
      options.push({ value, label: display12h });
    }
  }
  return options;
};

// Helper function to parse reminderBefore string (e.g., "15min", "1hour", "2days")
const parseReminderBefore = (reminderBefore: string | null | undefined): { value: number; unit: string } => {
  if (!reminderBefore) return { value: 60, unit: 'minutes' };
  
  const match = reminderBefore.match(/^(\d+)(min|hour|day|week)s?$/);
  if (!match) return { value: 60, unit: 'minutes' };
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  // Convert to standard units
  const unitMap: Record<string, string> = {
    'min': 'minutes',
    'hour': 'hours',
    'day': 'days',
    'week': 'weeks'
  };
  
  return { value, unit: unitMap[unit] || 'minutes' };
};

// Helper function to format reminderBefore for submission (e.g., 15 minutes -> "15min")
const formatReminderBefore = (value: number, unit: string): string => {
  const unitMap: Record<string, string> = {
    'minutes': 'min',
    'hours': 'hour',
    'days': 'day',
    'weeks': 'week'
  };
  
  return `${value}${unitMap[unit] || 'min'}`;
};

// Reminder Form Component
interface ReminderFormProps {
  reminder: QuoteReminder | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}

const reminderFormSchema = insertQuoteReminderSchema
  .omit({ companyId: true, quoteId: true, createdBy: true, status: true, snoozedUntil: true, reminderBefore: true })
  .extend({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dueDate: z.string().min(1, "Due date is required"),
    dueTime: z.string().min(1, "Due time is required"),
    timezone: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    reminderType: z.enum(['follow_up', 'document_request', 'payment_due', 'policy_renewal', 'call_client', 'send_email', 'review_application', 'other']),
    notifyUsers: z.array(z.string()).optional(),
    isPrivate: z.boolean().optional(),
    // Temporary fields for form UI (will be combined before submission)
    reminderBeforeValue: z.number().optional(),
    reminderBeforeUnit: z.string().optional(),
  });

type ReminderFormData = z.infer<typeof reminderFormSchema>;

function ReminderForm({ reminder, onSubmit, onCancel, isPending }: ReminderFormProps) {
  // Parse reminderBefore from combined string format
  const parsedReminder = reminder?.reminderBefore ? parseReminderBefore(reminder.reminderBefore) : { value: 60, unit: 'minutes' };
  
  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: reminder?.title || '',
      description: reminder?.description || '',
      dueDate: reminder?.dueDate ? format(new Date(reminder.dueDate), 'yyyy-MM-dd') : '',
      dueTime: reminder?.dueTime || '',
      timezone: reminder?.timezone || 'America/New_York',
      reminderBeforeValue: parsedReminder.value,
      reminderBeforeUnit: parsedReminder.unit,
      reminderType: (reminder?.reminderType || 'follow_up') as 'follow_up' | 'document_request' | 'payment_due' | 'policy_renewal' | 'call_client' | 'send_email' | 'review_application' | 'other',
      priority: (reminder?.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      notifyUsers: reminder?.notifyUsers || [],
      isPrivate: reminder?.isPrivate || false,
    },
  });

  // Wrap onSubmit to combine reminderBefore fields
  const handleFormSubmit = (data: ReminderFormData) => {
    const { reminderBeforeValue, reminderBeforeUnit, ...rest } = data;
    
    // Combine reminderBeforeValue and reminderBeforeUnit into single string
    const reminderBefore = reminderBeforeValue && reminderBeforeUnit 
      ? formatReminderBefore(reminderBeforeValue, reminderBeforeUnit)
      : undefined;
    
    onSubmit({
      ...rest,
      reminderBefore,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid gap-4">
          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter reminder title" data-testid="input-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Add details about this reminder" rows={3} data-testid="textarea-description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Due Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => {
                const [calendarOpen, setCalendarOpen] = useState(false);
                return (
                  <FormItem>
                    <FormLabel>Due Date *</FormLabel>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-due-date"
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? formatDateForDisplay(field.value, "MM/dd/yyyy") : "Select date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value ? parseISO(field.value + 'T00:00:00') : undefined}
                          onSelect={(date) => {
                            field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          fromDate={new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="dueTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Time *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-due-time">
                        <div className="flex items-center">
                          <Clock className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Select time" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {generateTimeOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Timezone */}
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Reminder Before */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="reminderBeforeValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder Before</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="number" 
                      min="0"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      data-testid="input-reminder-before" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reminderBeforeUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-reminder-unit">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="reminderType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="document_request">Document Request</SelectItem>
                      <SelectItem value="payment_due">Payment Due</SelectItem>
                      <SelectItem value="policy_renewal">Policy Renewal</SelectItem>
                      <SelectItem value="call_client">Call Client</SelectItem>
                      <SelectItem value="send_email">Send Email</SelectItem>
                      <SelectItem value="review_application">Review Application</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority-form">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Private Reminder */}
          <FormField
            control={form.control}
            name="isPrivate"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 mt-1"
                    data-testid="checkbox-private"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Private reminder</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Only you will be able to see this reminder
                  </p>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
            data-testid="button-cancel-reminder"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            data-testid="button-submit-reminder"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {reminder ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              reminder ? 'Update Reminder' : 'Create Reminder'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Add Member Inline Component - Renders inline within Family Members card
interface AddMemberInlineProps {
  quote: QuoteWithArrays;
  onClose: () => void;
  onSave: (data: any, options?: any) => void;
  isPending: boolean;
}

function AddMemberInline({ quote, onClose, onSave, isPending }: AddMemberInlineProps) {
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);

  const addMemberSchema = dependentSchema;

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
    pregnant: false,
    employerName: '',
    employerPhone: '',
    position: '',
    annualIncome: '',
    incomeFrequency: 'annually',
    selfEmployed: false,
    immigrationStatus: '',
    naturalizationNumber: '',
    uscisNumber: '',
    immigrationStatusCategory: '',
  };

  const addMemberForm = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues,
  });

  const handleSave = (data: z.infer<typeof addMemberSchema>) => {
    setCountryPopoverOpen(false);
    onSave(data, {
      onSuccess: () => {
        addMemberForm.reset(defaultValues);
        onClose();
      }
    });
  };

  const handleCancel = () => {
    addMemberForm.reset(defaultValues);
    onClose();
  };
  
  return (
    <div className="bg-muted/20 border-t" data-testid="add-member-inline">
      <Form {...addMemberForm}>
        <form onSubmit={addMemberForm.handleSubmit(handleSave)} className="p-6 space-y-4">
            <Accordion type="single" collapsible defaultValue="basic" className="w-full">
              {/* Basic Info Section */}
              <AccordionItem value="basic">
                <AccordionTrigger className="text-base font-semibold" data-testid="accordion-basic-info">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Basic Information
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                    {/* First Name */}
                    <FormField
                      control={addMemberForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-firstname" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Middle Name */}
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

                    {/* Last Name */}
                    <FormField
                      control={addMemberForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-lastname" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Second Last Name */}
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

                    {/* Date of Birth */}
                    <FormField
                      control={addMemberForm.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input {...field} type="date" data-testid="input-dob" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* SSN */}
                    <FormField
                      control={addMemberForm.control}
                      name="ssn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SSN <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(formatSSN(e.target.value))}
                              placeholder="XXX-XX-XXXX"
                              data-testid="input-ssn"
                              className="font-mono"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Gender */}
                    <FormField
                      control={addMemberForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender <span className="text-destructive">*</span></FormLabel>
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

                    {/* Phone */}
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
                              placeholder="(999) 999-9999"
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email */}
                    <FormField
                      control={addMemberForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Marital Status */}
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
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Country of Birth */}
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

                    {/* Preferred Language */}
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
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Weight */}
                    <FormField
                      control={addMemberForm.control}
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

                    {/* Height */}
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

                    {/* Relation field - shown for adding new members */}
                    <FormField
                      control={addMemberForm.control}
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

                    {/* Checkboxes */}
                    <div className="lg:col-span-2 space-y-3">
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
                                data-testid="checkbox-is-dependent"
                              />
                            </FormControl>
                            <FormLabel className="cursor-pointer">Dependent</FormLabel>
                          </FormItem>
                        )}
                      />
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
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Income Section */}
              <AccordionItem value="income">
                <AccordionTrigger className="text-base font-semibold" data-testid="accordion-income">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Income & Employment
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                    {/* Employer Name */}
                    <FormField
                      control={addMemberForm.control}
                      name="employerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Employer or company name" data-testid="input-employer-name" />
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
                        <FormItem>
                          <FormLabel>Position / Title</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Job title or occupation" data-testid="input-position" />
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
                        <FormItem className="lg:col-span-2">
                          <FormLabel>Employer Contact</FormLabel>
                          <FormControl>
                            <Input 
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(formatPhoneNumber(e.target.value))}
                              placeholder="(999) 999-9999"
                              data-testid="input-employer-phone"
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
                          <FormLabel>Pay Period</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "annually"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-income-frequency">
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
                    <IncomeField control={addMemberForm.control} frequency={addMemberForm.watch('incomeFrequency') || 'annually'} />

                    {/* Self Employed */}
                    <FormField
                      control={addMemberForm.control}
                      name="selfEmployed"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2 flex flex-row items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-self-employed"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">Self-employed or independent contractor</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Immigration Section */}
              <AccordionItem value="immigration">
                <AccordionTrigger className="text-base font-semibold" data-testid="accordion-immigration">
                  <div className="flex items-center gap-2">
                    <Plane className="h-4 w-4" />
                    Immigration Status
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                    {/* Immigration Status */}
                    <FormField
                      control={addMemberForm.control}
                      name="immigrationStatus"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-immigration-status">
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

                    {/* Naturalization Number (only if citizen) */}
                    {addMemberForm.watch('immigrationStatus') === 'citizen' && (
                      <FormField
                        control={addMemberForm.control}
                        name="naturalizationNumber"
                        render={({ field }) => (
                          <FormItem className="lg:col-span-2">
                            <FormLabel>Naturalization Certificate #</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter certificate number" data-testid="input-naturalization-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* USCIS Number */}
                    <FormField
                      control={addMemberForm.control}
                      name="uscisNumber"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel>USCIS Number</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="9-digit number (optional)" data-testid="input-uscis-number" className="font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Immigration Status Category */}
                    <FormField
                      control={addMemberForm.control}
                      name="immigrationStatusCategory"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel>Status Category</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., I-94, Parole, etc." data-testid="input-immigration-category" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Form Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
                data-testid="button-cancel-member"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-member"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Member'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
  );
}


// States with State-Based Exchanges (SBE) that don't use the federal CMS Marketplace
const STATE_BASED_EXCHANGES = [
  'CA', // California – Covered California
  'CO', // Colorado – Connect for Health Colorado
  'CT', // Connecticut – Access Health CT
  'DC', // District of Columbia – DC Health Link
  'ID', // Idaho – Your Health Idaho
  'IL', // Illinois
  'KY', // Kentucky – kynect
  'ME', // Maine – CoverME.gov
  'MD', // Maryland – Maryland Health Connection
  'MA', // Massachusetts – MA Health Connector
  'MN', // Minnesota – MNsure
  'NV', // Nevada – Nevada Health Link
  'NJ', // New Jersey – Get Covered NJ
  'NM', // New Mexico – beWellnm
  'PA', // Pennsylvania – Pennie
  'RI', // Rhode Island – HealthSource RI
  'VT', // Vermont – Vermont Health Connect
  'VA', // Virginia – Virginia's Insurance Marketplace
  'WA', // Washington – Washington Healthplanfinder
];

// Map state codes to their marketplace names
const STATE_MARKETPLACE_NAMES: Record<string, string> = {
  'CA': 'Covered California',
  'CO': 'Connect for Health Colorado',
  'CT': 'Access Health CT',
  'DC': 'DC Health Link',
  'ID': 'Your Health Idaho',
  'IL': 'Illinois State Marketplace',
  'KY': 'kynect',
  'ME': 'CoverME.gov',
  'MD': 'Maryland Health Connection',
  'MA': 'MA Health Connector',
  'MN': 'MNsure',
  'NV': 'Nevada Health Link',
  'NJ': 'Get Covered NJ',
  'NM': 'beWellnm',
  'PA': 'Pennie',
  'RI': 'HealthSource RI',
  'VT': 'Vermont Health Connect',
  'VA': "Virginia's Insurance Marketplace",
  'WA': 'Washington Healthplanfinder',
};

export default function PoliciesPage() {
  const [location, setLocation] = useLocation();
  const { toast} = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  
  // Helper function to navigate to a policy and clear search
  const navigateToPolicy = (policyId: string) => {
    setSearchInput("");
    setFilters(prev => ({ ...prev, searchTerm: "" }));
    setLocation(`/customers/${policyId}`);
  };
  
  // Edit states
  const [editingMember, setEditingMember] = useState<{ type: 'primary' | 'spouse' | 'dependent', index?: number } | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
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
  
  // Delete plan dialog state
  const [deletingPlan, setDeletingPlan] = useState<{ id: string; name: string } | null>(null);
  
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
    effectiveYears: [] as number[],
    searchFamilyMembers: false,
  });
  
  // OEP 2026 filter state
  const [oepFilter, setOepFilter] = useState<"aca" | "medicare" | null>(null);
  
  // Sidebar view selection state
  const [selectedView, setSelectedView] = useState<"policies" | "oep-aca" | "oep-medicare" | "important" | "archived" | "exports">("policies");
  
  // Folder selection and expand/collapse states
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [agencyFoldersOpen, setAgencyFoldersOpen] = useState(true);
  const [myFoldersOpen, setMyFoldersOpen] = useState(true);
  
  // Multi-select state for bulk operations
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<Set<string>>(new Set());
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  
  // OEP Renewal modal state
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [renewalData, setRenewalData] = useState<any>(null);
  const [renewingPolicyId, setRenewingPolicyId] = useState<string | null>(null);
  
  // Delete quote dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; clientName: string } | null>(null);
  
  // Notes sheet state
  const [notesSheetOpen, setNotesSheetOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [notePinned, setNotePinned] = useState(false);
  const [noteResolved, setNoteResolved] = useState(false);
  const [searchNotes, setSearchNotes] = useState("");
  const [filterCategory, setFilterCategory] = useState<'all' | 'pinned' | 'important' | 'unresolved' | 'resolved'>('all');
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const notesListRef = useRef<HTMLDivElement>(null);
  
  // Delete note dialog state
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Image attachment states
  const [noteAttachments, setNoteAttachments] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Folder management dialog states
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<{ id: string; name: string; type: 'agency' | 'personal' } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderType, setNewFolderType] = useState<'agency' | 'personal'>('personal');
  
  // Documents sheet state
  const [documentsSheetOpen, setDocumentsSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchDocuments, setSearchDocuments] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  
  
  const documentFileInputRef = useRef<HTMLInputElement>(null);
  
  // Reminders sheet state
  const [remindersSheetOpen, setRemindersSheetOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<QuoteReminder | null>(null);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  
  // SSN visibility toggle state (for member card)
  const [ssnVisible, setSsnVisible] = useState(false);
  const [filterReminderStatus, setFilterReminderStatus] = useState<string>('all');
  const [filterReminderPriority, setFilterReminderPriority] = useState<string>('all');
  const [searchReminders, setSearchReminders] = useState("");
  const [reminderToDelete, setReminderToDelete] = useState<string | null>(null);
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [snoozeReminderId, setSnoozeReminderId] = useState<string | null>(null);
  const [snoozeDuration, setSnoozeDuration] = useState<string>("1hour");
  
  // Consent modal state
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  
  // Status editor state
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  
  // Consents sheet state
  const [consentsSheetOpen, setConsentsSheetOpen] = useState(false);
  const [showConsentForm, setShowConsentForm] = useState(false); // Track if we're in form view
  const [viewingConsent, setViewingConsent] = useState<any | null>(null); // Track if we're viewing a consent
  
  // Cancel/Archive/Duplicate/Block confirmation dialogs
  const [cancelPolicyDialogOpen, setCancelPolicyDialogOpen] = useState(false);
  const [archivePolicyDialogOpen, setArchivePolicyDialogOpen] = useState(false);
  const [duplicatePolicyDialogOpen, setDuplicatePolicyDialogOpen] = useState(false);
  const [blockPolicyDialogOpen, setBlockPolicyDialogOpen] = useState(false);
  const [removePlanDialogOpen, setRemovePlanDialogOpen] = useState(false);
  
  // Policy Information fields (local state for editing)
  const [policyInfo, setPolicyInfo] = useState({
    memberId: '',
    npnMarketplace: '',
    saleType: '',
    effectiveDate: '',
    marketplaceId: '',
    ffmMarketplace: '',
    specialEnrollmentReason: '',
    cancellationDate: '',
    specialEnrollmentDate: '',
  });
  
  // Manual plan dialog state
  const [manualPlanDialogOpen, setManualPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [carrierPopoverOpen, setCarrierPopoverOpen] = useState(false);
  
  // Simplified plan dialog state - manual entry only
  const [simplePlanFormData, setSimplePlanFormData] = useState({ 
    planId: '',
    carrier: '',
    planName: '',
    metalLevel: '',
    planType: '',
    monthlyPayment: '',
    originalPrice: '',
    marketplaceId: '', 
    memberId: '',
    effectiveDate: '', 
    expirationDate: '' 
  });
  
  // Empty form state for manual plan dialog
  const emptyManualPlanData = {
    // Basic Info
    productType: '',
    carrier: '',
    carrierIssuerId: '',
    planName: '',
    cmsPlanId: '',
    metal: '',
    networkType: '',
    rating: '',
    // Cost Details
    planWas: '',
    premium: '',
    taxCredit: '',
    deductible: '',
    deductibleFamily: '',
    outOfPocketMax: '',
    outOfPocketMaxFamily: '',
    // Copays/Benefits
    primaryCare: '',
    specialist: '',
    urgentCare: '',
    emergency: '',
    mentalHealth: '',
    genericDrugs: '',
    // Additional Benefits
    preferredBrandDrugs: '',
    nonPreferredBrandDrugs: '',
    specialtyDrugs: '',
    inpatientFacility: '',
    inpatientPhysician: '',
    outpatientFacility: '',
    outpatientPhysician: '',
    imaging: '',
    labWork: '',
    xrays: '',
    preventiveCare: '',
    rehabilitation: '',
    habilitationServices: '',
    skilledNursing: '',
    durableMedicalEquipment: '',
    hospiceCare: '',
    emergencyTransport: '',
    // Features
    dentalChild: false,
    dentalAdult: false,
    hsaEligible: false,
    simpleChoice: false,
    specialistReferralRequired: false,
    hasNationalNetwork: false,
    // Disease Management Programs
    diseaseManagementPrograms: '',
    // Policy Information
    effectiveDate: '',
    cancellationDate: '',
    specialEnrollmentDate: '',
    specialEnrollmentReason: '',
    // Enrollment
    saleType: '',
    ffmMarketplace: '',
    npnMarketplace: '',
    marketplaceId: '',
    memberId: '',
    policyTotalCost: '',
  };
  
  const [manualPlanData, setManualPlanData] = useState(emptyManualPlanData);
  
  // Other policies year filter state
  const [otherPoliciesYear, setOtherPoliciesYear] = useState<string>("all");
  
  // Calculate initial effective date ONCE (first day of next month)
  // This date will NOT change unless the user manually changes it
  const initialEffectiveDate = useMemo(() => format(getFirstDayOfNextMonth(), "yyyy-MM-dd"), []);
  
  // Determine if we're in the wizard view based on URL
  const showWizard = location === "/customers/new";
  
  // Extract policyId from URL using wouter's useRoute
  const [, params] = useRoute('/customers/:id');
  const policyId = params?.id && params.id !== 'new' ? params.id : null;
  
  // Reset all editing states when navigating between policies
  useEffect(() => {
    setAddingMember(false);
    setExpandedMemberId(null);
    setEditingAddresses(null);
    setEditingNotes(false);
    setEditingDoctor(false);
    setEditingMedicines(false);
    setPaymentMethodsSheet({open: false});
    setNotesSheetOpen(false);
    setDocumentsSheetOpen(false);
    setRemindersSheetOpen(false);
    setConsentsSheetOpen(false);
  }, [policyId]);
  
  // Fetch policies statistics
  const { data: stats, isLoading: isLoadingStats } = useQuery<{
    totalPolicies: number;
    totalApplicants: number;
    canceledPolicies: number;
    canceledApplicants: number;
  }>({
    queryKey: ['/api/policies/stats'],
    enabled: !showWizard,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab switch
  });
  
  // Fetch OEP 2026 statistics
  const { data: oepStats } = useQuery<{
    aca: number;
    medicare: number;
  }>({
    queryKey: ['/api/policies/oep-stats'],
    enabled: !showWizard,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab switch
  });
  
  // Fetch policy folders
  const { data: foldersData } = useQuery<{ agency: any[]; personal: any[] }>({
    queryKey: ['/api/policy-folders'],
    enabled: !showWizard,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const agencyFolders = foldersData?.agency || [];
  const myFolders = foldersData?.personal || [];
  
  // Bulk move mutation
  const bulkMoveMutation = useMutation({
    mutationFn: async (params: { folderId: string | null; folderName?: string }) => {
      return apiRequest('POST', '/api/policies/bulk/move-to-folder', {
        policyIds: Array.from(selectedPolicyIds),
        folderId: params.folderId,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/policy-folders'] });
      setSelectedPolicyIds(new Set());
      
      const count = data.count || selectedPolicyIds.size;
      const policyText = count === 1 ? 'policy' : 'policies';
      const destination = variables.folderName 
        ? `moved to "${variables.folderName}"`
        : 'removed from folder';
      
      toast({
        title: "Success",
        description: `${count} ${policyText} ${destination}`,
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move policies",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleBulkMove = (folderId: string | null, folderName?: string) => {
    if (selectedPolicyIds.size === 0) return;
    bulkMoveMutation.mutate({ folderId, folderName });
  };
  
  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/policy-folders', {
        name: newFolderName.trim(),
        type: newFolderType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policy-folders'] });
      setCreateFolderDialogOpen(false);
      setNewFolderName("");
      toast({
        title: "Folder created",
        description: `Folder "${newFolderName}" has been created successfully.`,
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating folder",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Rename folder mutation
  const renameFolderMutation = useMutation({
    mutationFn: async () => {
      if (!folderToEdit) throw new Error("No folder selected");
      return apiRequest('PATCH', `/api/policy-folders/${folderToEdit.id}`, {
        name: newFolderName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policy-folders'] });
      setRenameFolderDialogOpen(false);
      setFolderToEdit(null);
      setNewFolderName("");
      toast({
        title: "Folder renamed",
        description: "Folder has been renamed successfully.",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error renaming folder",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async () => {
      if (!folderToEdit) throw new Error("No folder selected");
      return apiRequest('DELETE', `/api/policy-folders/${folderToEdit.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policy-folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/policies'], exact: false });
      setDeleteFolderDialogOpen(false);
      setFolderToEdit(null);
      setSelectedFolderId(null); // Clear selection if viewing deleted folder
      toast({
        title: "Folder deleted",
        description: "Folder has been deleted successfully.",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting folder",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });
  
  // Renewal mutation
  const renewalMutation = useMutation({
    mutationFn: async (policyId: string) => {
      setRenewingPolicyId(policyId);
      return await apiRequest('POST', `/api/policies/${policyId}/renewals`, {});
    },
    onSuccess: (data) => {
      setRenewingPolicyId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/policies'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['/api/policies/oep-stats'] });
      
      // Navigate directly to the renewed policy after a short delay
      if (data?.renewedPolicy?.id) {
        // Show success toast
        toast({
          title: "Policy renewed successfully",
          description: `New policy ${data.renewedPolicy.id} created for 2026`,
          duration: 3000,
        });
        
        // Show warning toast if plans couldn't be fetched
        if (data.plansFetchWarning) {
          setTimeout(() => {
            toast({
              title: "Action Required",
              description: data.plansFetchWarning,
              variant: "default",
              duration: 6000,
            });
          }, 1000); // Delay slightly so it appears after the success toast
        }
        
        // Small delay to ensure queries invalidate before navigation
        setTimeout(() => {
          setLocation(`/customers/${data.renewedPolicy.id}`);
        }, 500);
      }
    },
    onError: (error: Error) => {
      setRenewingPolicyId(null);
      toast({
        title: "Error al renovar póliza",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Function to handle viewing a quote - navigates to the quote detail page
  const handleViewQuote = (quote: Quote | any) => {
    console.log('[handleViewQuote] Navigating to policy:', quote?.id);
    if (quote?.id) {
      // Navigate to the policy detail page
      setLocation(`/customers/${quote.id}`);
      console.log('[handleViewQuote] Navigation called to:', `/customers/${quote.id}`);
    } else {
      console.error('[handleViewQuote] No quote ID provided');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not open quote - no ID found",
      });
    }
  };

  // Fetch current user
  const { data: userData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });

  // Fetch agents for selection
  const { data: agentsData } = useQuery<{ users: UserType[] }>({
    queryKey: ["/api/users"],
  });

  // Fetch company agents for reassignment
  const { data: companyAgentsData } = useQuery<{ agents: Array<{ id: string; firstName: string; lastName: string; email: string; avatar?: string; role: string }> }>({
    queryKey: ["/api/company/agents"],
  });
  const companyAgents = companyAgentsData?.agents || [];

  // Debounce search for family members (server-side search) - MUST be declared before use
  const [debouncedFamilySearch, setDebouncedFamilySearch] = useState("");

  // Fetch policies - Hybrid search: server-side for family members, client-side for primary client
  const { data: policiesResponse, isLoading } = useQuery<{ items: Quote[]; nextCursor: string | null }>({
    queryKey: ["/api/policies", { 
      searchTerm: filters.searchFamilyMembers ? debouncedFamilySearch : undefined, 
      includeFamilyMembers: filters.searchFamilyMembers,
      folderId: selectedFolderId
    }],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      
      // When family member search is enabled, send debounced search term to server
      if (filters.searchFamilyMembers && debouncedFamilySearch.trim()) {
        params.append('searchTerm', debouncedFamilySearch.trim());
        params.append('searchFamilyMembers', 'true');
      }
      
      // Add folderId parameter if set
      if (selectedFolderId !== null) {
        params.append('folderId', selectedFolderId);
      }
      
      const url = `/api/policies${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch policies');
      return response.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Extract policies from response
  const allQuotes = policiesResponse?.items || [];

  // CORRECT SOLUTION: Extract policy ID from query string OR path
  // Common navigation uses ?policyId=XXX, fallback to /policies/XXX format
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const policyIdFromQuery = urlParams.get('policyId');
  const pathParts = location.split('/');
  const policyIdFromPath = pathParts[2] && pathParts[2] !== 'new' ? pathParts[2].split('?')[0] : null;
  const selectedPolicyId = policyIdFromQuery || policyIdFromPath;
  
  // Find the basic policy from list
  const basicPolicy = allQuotes.find(q => q.id === selectedPolicyId);
  
  // Fetch full details (with income/immigration) when we have a policy selected
  const { data: quoteDetail, isLoading: isLoadingQuoteDetail } = useQuery<{
    policy: Quote & {
      agent?: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string; } | null;
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
    queryKey: ['/api/policies', selectedPolicyId, 'detail'],
    queryFn: async () => {
      if (!selectedPolicyId) throw new Error('No policy selected');
      const response = await fetch(`/api/policies/${selectedPolicyId}/detail`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch policy details');
      return response.json();
    },
    enabled: !!selectedPolicyId,
  });

  // Use detail data if available (has income/immigration), otherwise use basic policy
  const viewingQuote = quoteDetail?.policy || basicPolicy;
  const isViewingQuote = !!viewingQuote;
  const paymentMethodsData = quoteDetail ? { paymentMethods: quoteDetail.paymentMethods || [] } : undefined;
  const isLoadingPaymentMethods = isLoadingQuoteDetail;
  
  // Initialize policyInfo when viewingQuote changes
  useEffect(() => {
    if (viewingQuote) {
      setPolicyInfo({
        memberId: viewingQuote.memberId || '',
        npnMarketplace: viewingQuote.npnMarketplace || '',
        saleType: viewingQuote.saleType || '',
        effectiveDate: viewingQuote.effectiveDate || '',
        marketplaceId: viewingQuote.marketplaceId || '',
        ffmMarketplace: viewingQuote.ffmMarketplace || '',
        specialEnrollmentReason: viewingQuote.specialEnrollmentReason || '',
        cancellationDate: viewingQuote.cancellationDate || '',
        specialEnrollmentDate: viewingQuote.specialEnrollmentDate || '',
      });
    }
  }, [
    viewingQuote?.id, 
    viewingQuote?.memberId,
    viewingQuote?.npnMarketplace,
    viewingQuote?.saleType,
    viewingQuote?.effectiveDate,
    viewingQuote?.marketplaceId,
    viewingQuote?.ffmMarketplace,
    viewingQuote?.specialEnrollmentReason,
    viewingQuote?.cancellationDate,
    viewingQuote?.specialEnrollmentDate
  ]);

  // Note: Agent assignment only happens when user makes an actual edit to the policy
  // (handled in the PATCH mutation), not just by viewing it

  // Debounce effect for family member search
  useEffect(() => {
    if (!filters.searchFamilyMembers) {
      // If family member search is disabled, clear debounced value
      setDebouncedFamilySearch("");
      return;
    }
    
    // Debounce the search when family member search is enabled
    const timer = setTimeout(() => {
      setDebouncedFamilySearch(searchInput);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchInput, filters.searchFamilyMembers]);

  // Pre-select product type when opening manual plan dialog
  useEffect(() => {
    if (manualPlanDialogOpen && viewingQuote?.productType) {
      setManualPlanData(prev => ({ ...prev, productType: viewingQuote.productType }));
    }
  }, [manualPlanDialogOpen, viewingQuote?.productType]);


  // Load plan data when editing an existing plan
  useEffect(() => {
    if (manualPlanDialogOpen && editingPlanId && viewingQuote?.plans) {
      const existingPlan = viewingQuote.plans.find((p: any) => p.id === editingPlanId);
      if (existingPlan) {
        const plan = existingPlan.planData || {};
        setSimplePlanFormData({
          planId: plan.id || existingPlan.planId || '',
          carrier: plan.issuer?.name || existingPlan.carrier || '',
          planName: plan.name || existingPlan.planName || '',
          metalLevel: plan.metal_level || existingPlan.metalLevel || '',
          planType: plan.type || existingPlan.planType || '',
          monthlyPayment: String(plan.premium_w_credit ?? plan.premium ?? existingPlan.monthlyPayment ?? ''),
          originalPrice: String(plan.premium ?? existingPlan.originalPrice ?? ''),
          marketplaceId: plan.marketplaceId || existingPlan.marketplaceId || '',
          memberId: plan.memberId || existingPlan.memberId || '',
          effectiveDate: plan.effectiveDate || existingPlan.effectiveDate || '',
          expirationDate: plan.expirationDate || existingPlan.expirationDate || '',
        });
      }
    }
  }, [manualPlanDialogOpen, editingPlanId, viewingQuote?.plans]);
  // Fetch quote notes
  const { data: quoteNotesData, isLoading: isLoadingNotes } = useQuery<{ notes: any[] }>({
    queryKey: ['/api/policies', selectedPolicyId, 'notes'],
    queryFn: async () => {
      const response = await fetch(`/api/policies/${selectedPolicyId}/notes`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
    enabled: !!selectedPolicyId && selectedPolicyId !== 'new',
  });

  const quoteNotes = quoteNotesData?.notes || [];
  const quoteNotesCount = quoteNotes.length || 0;

  // Fetch other policies by applicant
  const { data: otherPoliciesData, isLoading: isLoadingOtherPolicies } = useQuery({
    queryKey: ['/api/policies/by-applicant', viewingQuote?.clientSsn, viewingQuote?.clientEmail, viewingQuote?.clientFirstName, viewingQuote?.clientLastName, viewingQuote?.clientDateOfBirth, otherPoliciesYear, viewingQuote?.id],
    enabled: !!(viewingQuote?.clientSsn || viewingQuote?.clientEmail),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (viewingQuote?.clientSsn) params.append('ssn', viewingQuote.clientSsn);
      if (viewingQuote?.clientEmail) params.append('email', viewingQuote.clientEmail);
      if (viewingQuote?.clientFirstName) params.append('firstName', viewingQuote.clientFirstName);
      if (viewingQuote?.clientLastName) params.append('lastName', viewingQuote.clientLastName);
      if (viewingQuote?.clientDateOfBirth) params.append('dob', viewingQuote.clientDateOfBirth);
      if (otherPoliciesYear !== 'all') {
        params.append('effectiveYear', otherPoliciesYear);
      }
      if (viewingQuote?.id) params.append('excludePolicyId', viewingQuote.id);
      
      const response = await fetch(`/api/policies/by-applicant?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch policies');
      return response.json();
    },
  });

  const otherPolicies = otherPoliciesData?.policies || [];

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      if (!newNoteText.trim()) throw new Error("Note content is required");
      return apiRequest('POST', `/api/policies/${viewingQuote.id}/notes`, {
        note: newNoteText.trim(),
        isImportant: isImportant,
        isPinned: notePinned,
        isResolved: noteResolved,
        attachments: noteAttachments.length > 0 ? noteAttachments : null,
      });
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'notes'] });
      }
      setNewNoteText("");
      setIsImportant(false);
      setNotePinned(false);
      setNoteResolved(false);
      setNoteAttachments([]);
      toast({
        title: "Note created",
        description: "Your note has been saved successfully.",
      });
      // Auto-scroll to bottom after note is created
      setTimeout(() => {
        if (notesListRef.current) {
          notesListRef.current.scrollTop = notesListRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create note",
        variant: "destructive",
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async () => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      if (!editingNoteId) throw new Error("Note ID not found");
      if (!newNoteText.trim()) throw new Error("Note content is required");
      return apiRequest('PATCH', `/api/policies/${viewingQuote.id}/notes/${editingNoteId}`, {
        note: newNoteText.trim(),
        isImportant: isImportant,
        isPinned: notePinned,
        isResolved: noteResolved,
        attachments: noteAttachments,
      });
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'notes'] });
      }
      setEditingNoteId(null);
      setNewNoteText("");
      setIsImportant(false);
      setNotePinned(false);
      setNoteResolved(false);
      setNoteAttachments([]);
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update note",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      console.log('[DELETE MUTATION] Starting with noteId:', noteId, 'quoteId:', viewingQuote?.id);
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      const url = `/api/policies/${viewingQuote.id}/notes/${noteId}`;
      console.log('[DELETE MUTATION] Calling DELETE to:', url);
      const result = await apiRequest('DELETE', url);
      console.log('[DELETE MUTATION] Success:', result);
      return result;
    },
    onSuccess: () => {
      console.log('[DELETE MUTATION] onSuccess triggered');
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'notes'] });
      }
      setNoteToDelete(null);
      setShowDeleteDialog(false);
      toast({
        title: "Note deleted",
        description: "The note has been removed successfully.",
      });
    },
    onError: (error: any) => {
      console.error('[DELETE MUTATION] onError:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  // Fetch quote documents
  const { data: quoteDocumentsData, isLoading: isLoadingDocuments } = useQuery<{ documents: any[] }>({
    queryKey: ['/api/policies', selectedPolicyId, 'documents', selectedCategory, searchDocuments],
    queryFn: async () => {
      if (!selectedPolicyId) throw new Error("Quote ID not found");
      const params_obj = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params_obj.append('category', selectedCategory);
      }
      if (searchDocuments) {
        params_obj.append('q', searchDocuments);
      }
      const url = `/api/policies/${selectedPolicyId}/documents${params_obj.toString() ? `?${params_obj.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json();
    },
    enabled: !!selectedPolicyId && selectedPolicyId !== 'new',
  });

  const quoteDocuments = quoteDocumentsData?.documents || [];
  const quoteDocumentsCount = quoteDocuments.length || 0;

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      const response = await fetch(`/api/policies/${viewingQuote.id}/documents/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload document');
      }
      return response.json();
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'documents'] });
      }
      setUploadDialogOpen(false);
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('DELETE', `/api/policies/${viewingQuote.id}/documents/${documentId}`);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'documents'] });
      }
      setDocumentToDelete(null);
      toast({
        title: "Document deleted",
        description: "The document has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  // Fetch quote reminders count (always enabled for badge)
  const { data: remindersCountData } = useQuery<{ reminders: QuoteReminder[] }>({
    queryKey: ['/api/policies', selectedPolicyId, 'reminders', 'pending'],
    queryFn: async () => {
      if (!selectedPolicyId) throw new Error("Quote ID not found");
      const url = `/api/policies/${selectedPolicyId}/reminders?status=pending`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch reminders count');
      return response.json();
    },
    enabled: !!selectedPolicyId && selectedPolicyId !== 'new',
  });

  const pendingRemindersCount = remindersCountData?.reminders?.length || 0;

  // Fetch quote reminders (only when sheet is open)
  const { data: quoteRemindersData, isLoading: isLoadingReminders } = useQuery<{ reminders: QuoteReminder[] }>({
    queryKey: ['/api/policies', selectedPolicyId, 'reminders', filterReminderStatus, filterReminderPriority, searchReminders],
    queryFn: async () => {
      if (!selectedPolicyId) throw new Error("Quote ID not found");
      const params_obj = new URLSearchParams();
      if (filterReminderStatus && filterReminderStatus !== 'all') {
        params_obj.append('status', filterReminderStatus);
      }
      if (filterReminderPriority && filterReminderPriority !== 'all') {
        params_obj.append('priority', filterReminderPriority);
      }
      if (searchReminders.trim()) {
        params_obj.append('q', searchReminders);
      }
      const url = `/api/policies/${selectedPolicyId}/reminders${params_obj.toString() ? `?${params_obj.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch reminders');
      return response.json();
    },
    enabled: !!selectedPolicyId && selectedPolicyId !== 'new' && remindersSheetOpen,
  });

  const quoteReminders = quoteRemindersData?.reminders || [];

  // Fetch consent documents for quote (with real-time polling when sheet is open)
  const { data: consentsData, isLoading: isLoadingConsents } = useQuery<{ consents: any[] }>({
    queryKey: ['/api/policies', selectedPolicyId, 'consents'],
    queryFn: async () => {
      if (!selectedPolicyId) throw new Error("Quote ID not found");
      const response = await fetch(`/api/policies/${selectedPolicyId}/consents`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch consents');
      return response.json();
    },
    enabled: !!selectedPolicyId && selectedPolicyId !== 'new',
    refetchInterval: consentsSheetOpen ? 5000 : false, // Refetch every 5 seconds when sheet is open
    refetchOnWindowFocus: true, // Also refetch when window regains focus
  });

  const consents = consentsData?.consents || [];
  const latestConsent = consents[0]; // Most recent consent

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (data: Omit<InsertQuoteReminder, 'companyId' | 'quoteId' | 'createdBy'>) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('POST', `/api/policies/${viewingQuote.id}/reminders`, data);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders', 'pending'] });
      }
      setReminderFormOpen(false);
      setSelectedReminder(null);
      toast({
        title: "Reminder created",
        description: "Reminder has been created successfully.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Update reminder mutation
  const updateReminderMutation = useMutation({
    mutationFn: async ({ reminderId, data }: { reminderId: string; data: Partial<InsertQuoteReminder> }) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('PUT', `/api/policies/${viewingQuote.id}/reminders/${reminderId}`, data);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders', 'pending'] });
      }
      setReminderFormOpen(false);
      setSelectedReminder(null);
      toast({
        title: "Reminder updated",
        description: "Reminder has been updated successfully.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update reminder",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Complete reminder mutation
  const completeReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('PUT', `/api/policies/${viewingQuote.id}/reminders/${reminderId}/complete`, {});
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders', 'pending'] });
      }
      toast({
        title: "Reminder completed",
        description: "Reminder marked as completed.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete reminder",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Snooze reminder mutation
  const snoozeReminderMutation = useMutation({
    mutationFn: async ({ reminderId, duration }: { reminderId: string; duration: string }) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('PUT', `/api/policies/${viewingQuote.id}/reminders/${reminderId}/snooze`, { duration });
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders', 'pending'] });
      }
      setSnoozeDialogOpen(false);
      setSnoozeReminderId(null);
      toast({
        title: "Reminder snoozed",
        description: "Reminder has been snoozed.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to snooze reminder",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Delete reminder mutation
  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('DELETE', `/api/policies/${viewingQuote.id}/reminders/${reminderId}`);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'reminders', 'pending'] });
      }
      setReminderToDelete(null);
      toast({
        title: "Reminder deleted",
        description: "Reminder has been removed successfully.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reminder",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Resend consent mutation
  const resendConsentMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return apiRequest('POST', `/api/consents/${consentId}/send`, {});
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'consents'] });
      }
      toast({
        title: "Consent resent",
        description: "Consent document has been resent successfully.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend consent",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Delete consent mutation
  const deleteConsentMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return apiRequest('DELETE', `/api/policy-consents/${consentId}`);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'consents'] });
      }
      toast({
        title: "Consent deleted",
        description: "Consent document has been removed successfully.",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete consent",
        variant: "destructive",
      });
      setTimeout(() => toast({ description: "" }), 3000);
    },
  });

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    let filtered = [...quoteNotes];

    // Apply filters
    if (filterCategory === 'pinned') {
      filtered = filtered.filter(note => note.isPinned);
    } else if (filterCategory === 'important') {
      filtered = filtered.filter(note => note.isImportant);
    } else if (filterCategory === 'resolved') {
      filtered = filtered.filter(note => note.isResolved);
    } else if (filterCategory === 'unresolved') {
      filtered = filtered.filter(note => !note.isResolved);
    }

    // Apply search
    if (searchNotes.trim()) {
      const search = searchNotes.toLowerCase();
      filtered = filtered.filter(note => 
        note.note.toLowerCase().includes(search) ||
        (note.category && note.category.toLowerCase().includes(search))
      );
    }

    // Sort: pinned first, then by creation date (oldest first, newest last)
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return filtered;
  }, [quoteNotes, filterCategory, searchNotes]);

  // Filter documents based on category and search
  const filteredDocuments = useMemo(() => {
    let filtered = [...quoteDocuments];

    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    // Apply search
    if (searchDocuments.trim()) {
      const search = searchDocuments.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.fileName?.toLowerCase().includes(search) ||
        doc.description?.toLowerCase().includes(search)
      );
    }

    // Sort by upload date (newest first)
    filtered.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [quoteDocuments, selectedCategory, searchDocuments]);

  // Auto-scroll to bottom when notes sheet opens or notes change
  useEffect(() => {
    if (notesSheetOpen && filteredNotes.length > 0) {
      // Multiple attempts to ensure scroll happens after Sheet animation
      const scrollToBottom = () => {
        if (notesListRef.current) {
          notesListRef.current.scrollTop = notesListRef.current.scrollHeight;
        }
      };

      // Attempt scroll multiple times to catch the sheet after animation
      const timeouts = [100, 300, 600, 800].map(delay => 
        setTimeout(scrollToBottom, delay)
      );

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [notesSheetOpen, filteredNotes.length]);

  // Delete payment method mutation
  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      if (!viewingQuote?.id) throw new Error("Quote ID not found");
      return apiRequest('DELETE', `/api/policies/${viewingQuote.id}/payment-methods/${paymentMethodId}`);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'detail'] });
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
      return apiRequest('POST', `/api/policies/${viewingQuote.id}/payment-methods/${paymentMethodId}/set-default`);
    },
    onSuccess: () => {
      if (selectedPolicyId) {
        queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'detail'] });
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
      // Step 4: Income fields
      clientAnnualIncome: "",
      clientIncomeFrequency: "annually",
      clientIncomeSource: "",
      clientEmployerName: "",
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
      
      // Remove original address fields and remap them with correct names
      const { 
        street, addressLine2, city, state, postalCode, county,
        physical_address, physical_addressLine2, 
        physical_city, physical_state, physical_postalCode, physical_county,
        ...restData 
      } = data;
      
      // Clean up data to avoid sending undefined or empty string fields
      const cleanedData = {
        ...restData,
        effectiveDate: formatDateForBackend(data.effectiveDate),
        clientDateOfBirth: formatDateForBackend(data.clientDateOfBirth),
        clientSsn: normalizeSSN(data.clientSsn),
        // Ensure all client fields have proper defaults
        clientPreferredLanguage: data.clientPreferredLanguage || "",
        clientCountryOfBirth: data.clientCountryOfBirth || "",
        clientMaritalStatus: data.clientMaritalStatus || "",
        clientWeight: data.clientWeight || "",
        clientHeight: data.clientHeight || "",
        clientPregnant: data.clientPregnant || false,
        // Map mailing address fields with correct prefix
        mailing_street: street || "",
        mailing_address_line_2: addressLine2 || "",
        mailing_city: city || "",
        mailing_state: state || "",
        mailing_postal_code: postalCode || "",
        mailing_county: county || "",
        // Map physical address fields - note: physical_street, not physical_address!
        physical_street: physical_address || street || "",
        physical_address_line_2: physical_addressLine2 || addressLine2 || "",
        physical_city: physical_city || city || "",
        physical_state: physical_state || state || "",
        physical_postal_code: physical_postalCode || postalCode || "",
        physical_county: physical_county || county || "",
        country: data.country || "United States",
        spouses: data.spouses?.map((spouse: any) => ({
          ...spouse,
          dateOfBirth: formatDateForBackend(spouse.dateOfBirth),
          ssn: normalizeSSN(spouse.ssn),
          countryOfBirth: spouse.countryOfBirth || "",
        })) || [],
        dependents: data.dependents?.map((dependent: any) => ({
          ...dependent,
          dateOfBirth: formatDateForBackend(dependent.dateOfBirth),
          ssn: normalizeSSN(dependent.ssn),
          countryOfBirth: dependent.countryOfBirth || "",
        })) || [],
      };
      
      const result = await apiRequest("POST", "/api/policies", cleanedData);
      console.log('[CREATE QUOTE] Received response:', result);
      return result;
    },
    onSuccess: async (response: any) => {
      console.log('[CREATE QUOTE] onSuccess called with response:', response);
      
      try {
        // Get the created policy ID
        const quoteId = response?.policy?.id || response?.id;
        
        console.log('[CREATE QUOTE] Extracted policy ID:', quoteId);
        console.log('[CREATE QUOTE] Full response structure:', JSON.stringify(response, null, 2));
        
        // Navigate to the created policy after invalidating queries
        if (quoteId) {
          console.log('[CREATE QUOTE] Navigating to policy:', quoteId);
          
          // Invalidate queries first to ensure fresh data
          await queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
          
          // Small delay to ensure the policy is available in the database
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Navigate to the policy detail page
          handleViewQuote({ id: quoteId });
          
          // Reset the form for next time
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
            physical_address: "",
            physical_addressLine2: "",
            physical_city: "",
            physical_state: "",
            physical_postalCode: "",
            physical_county: "",
            physical_country: "United States",
          });
          setCurrentStep(1);
          setIsCreatingQuote(false);
          
          toast({
            title: "Policy Created Successfully!",
            description: `Policy ID: ${quoteId}`,
          });
        } else {
          // Fallback: if we don't get the ID, show error
          console.error('[CREATE QUOTE] No quote ID in response:', response);
          
          // Still reset the form
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
            physical_address: "",
            physical_addressLine2: "",
            physical_city: "",
            physical_state: "",
            physical_postalCode: "",
            physical_county: "",
            physical_country: "United States",
          });
          setCurrentStep(1);
          setIsCreatingQuote(false);
          
          // Invalidate queries to refresh the list
          await queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
          
          toast({
            title: "Policy Created",
            description: "The policy was created successfully. You can find it in the policies list.",
          });
        }
      } catch (error) {
        console.error('[CREATE QUOTE] Error in onSuccess handler:', error);
        console.error('[CREATE QUOTE] Error details:', JSON.stringify(error));
        
        // Reset form state even on error
        setCurrentStep(1);
        setIsCreatingQuote(false);
        
        // Invalidate queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
        
        toast({
          title: "Policy Created",
          description: "The policy was created but there was an issue navigating to it. Please check the policies list.",
        });
      }
      
      // Invalidate queries and reset form in background
      queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
      
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
      return apiRequest("PATCH", `/api/policies/${quoteId}`, data);
    },
    onSuccess: (_, variables) => {
      // Invalidate UNIFIED query to refresh ALL related data
      queryClient.invalidateQueries({ queryKey: ['/api/policies', variables.quoteId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
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
      return apiRequest("DELETE", `/api/policies/${quoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
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

  // Change agent mutation
  const changeAgentMutation = useMutation({
    mutationFn: async (newAgentId: string) => {
      if (!selectedPolicyId) throw new Error("Policy ID not found");
      return apiRequest("PATCH", `/api/policies/${selectedPolicyId}`, {
        agentId: newAgentId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
      toast({
        title: "Agent Updated",
        description: "The agent has been successfully changed.",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to change agent",
        duration: 3000,
      });
    },
  });

  // Change status mutation
  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!selectedPolicyId) throw new Error("Policy ID not found");
      return apiRequest("PATCH", `/api/policies/${selectedPolicyId}`, {
        status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/policies/stats"] });
      toast({
        title: "Status Updated",
        description: "The status has been successfully changed.",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to change status",
        duration: 3000,
      });
    },
  });


  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!selectedPolicyId) throw new Error("Quote ID not found");
      return apiRequest("DELETE", `/api/policies/${selectedPolicyId}/members/${memberId}`);
    },
    onSuccess: async () => {
      // Invalidate BOTH queries to refresh ALL data
      if (selectedPolicyId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'detail'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/policies'] })
        ]);
      }
      setDeletingMember(null);
      toast({
        title: "Member deleted",
        description: "The family member has been removed from this policy.",
        duration: 3000,
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
      if (!selectedPolicyId) throw new Error("Quote ID not found");
      
      const warnings: string[] = [];
      
      // Determine role based on relation
      // role can be: "client", "spouse", "dependent"
      // relation can be: "spouse", "child", "parent", "sibling", "other"
      const memberRole = data.relation === 'spouse' ? 'spouse' : 'dependent';
      
      // Step 1: Create member
      const ensureResponse = await fetch(`/api/policies/${selectedPolicyId}/ensure-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: memberRole,
          memberData: {
            firstName: data.firstName,
            middleName: data.middleName || null,
            lastName: data.lastName,
            secondLastName: data.secondLastName || null,
            email: data.email || null,
            phone: data.phone || null,
            dateOfBirth: formatDateForBackend(data.dateOfBirth),
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
            relation: data.relation || null, // Guardar el relation también
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
      
      const incomeResponse = await fetch(`/api/policies/members/${memberId}/income`, {
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
      const immigrationResponse = await fetch(`/api/policies/members/${memberId}/immigration`, {
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
    onSuccess: async (result) => {
      // Invalidate BOTH queries to refresh ALL data immediately
      if (selectedPolicyId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/policies', selectedPolicyId, 'detail'] }),
          queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false })
        ]);
      }
      
      // Show appropriate toast based on warnings
      if (result.warnings && result.warnings.length > 0) {
        const failedSections = result.warnings.join(' and ');
        toast({
          variant: "destructive",
          title: "Partial Success",
          description: `Member created but ${failedSections} data failed to save. You can edit it later.`,
          duration: 3000,
        });
      } else {
        toast({
          title: "Success",
          description: "Family member added successfully",
          duration: 3000,
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
    } else if (currentStep === 4) {
      isValid = true; // Income fields are optional but collected
    }

    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else if (isValid && currentStep === 4) {
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
      isPrimaryDependent: false,
      tobaccoUser: false,
      pregnant: false,
      preferredLanguage: "",
      countryOfBirth: "",
      maritalStatus: "",
      weight: "",
      height: "",
      employerName: "",
      employerPhone: "",
      position: "",
      annualIncome: "",
      selfEmployed: false,
      incomeFrequency: "annually",
      incomeSource: "",
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
      relation: "",
      phone: "",
      email: "",
      isApplicant: true,
      isPrimaryDependent: false,
      tobaccoUser: false,
      pregnant: false,
      preferredLanguage: "",
      countryOfBirth: "",
      maritalStatus: "",
      weight: "",
      height: "",
      employerName: "",
      employerPhone: "",
      position: "",
      annualIncome: "",
      selfEmployed: false,
      incomeFrequency: "annually",
      incomeSource: "",
      immigrationStatus: "",
      naturalizationNumber: "",
      uscisNumber: "",
      immigrationStatusCategory: "",
    });
  };

  const agents = agentsData?.users || [];
  
  // Fetch members with income and immigration details from UNIFIED QUERY
  // The API returns { member, income, immigration, documents } for each member
  // We need to flatten this structure so income/immigration are accessible
  const membersDetailsData = quoteDetail && quoteDetail.members ? { 
    members: quoteDetail.members.map(m => ({
      ...m.member,
      income: m.income,
      immigration: m.immigration,
      documents: m.documents || []
    }))
  } : undefined;

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
  //   queryKey: ['/api/policies', selectedPolicyId, 'household-income'],
  //   enabled: isViewingQuote && !!viewingQuote?.id,
  // });
  const householdIncomeData = quoteDetail ? { totalIncome: quoteDetail.totalHouseholdIncome } : undefined;
  
  // Filter quotes based on filters (hybrid: client-side for primary, server-side for family)
  const filteredQuotes = allQuotes.filter((quote) => {
    // Client-side search filter (only when family member search is disabled)
    let matchesSearch = true;
    if (!filters.searchFamilyMembers && searchInput.trim()) {
      const searchLower = searchInput.toLowerCase().trim();
      const fullName = `${quote.clientFirstName} ${quote.clientMiddleName || ''} ${quote.clientLastName} ${quote.clientSecondLastName || ''}`.toLowerCase();
      const email = (quote.clientEmail || '').toLowerCase();
      const phone = (quote.clientPhone || '').toLowerCase();
      
      matchesSearch = fullName.includes(searchLower) || 
                      email.includes(searchLower) || 
                      phone.includes(searchLower);
    }
    // When family member search is enabled, server handles filtering
    
    // Status filter
    const matchesStatus = filters.status === "all" || quote.status === filters.status;
    
    // Product filter
    const matchesProduct = filters.productType === "all" || quote.productType === filters.productType;
    
    // State filter
    const matchesState = !filters.state || quote.physical_state === filters.state;
    
    // Zip code filter
    const matchesZipCode = !filters.zipCode || quote.physical_postal_code?.includes(filters.zipCode);
    
    // Assigned to filter (agentId)
    const matchesAssignedTo = !filters.assignedTo || quote.agentId === filters.assignedTo;
    
    // Effective date range filter (yyyy-MM-dd strings can be compared lexicographically)
    const matchesEffectiveDateFrom = !filters.effectiveDateFrom || quote.effectiveDate >= filters.effectiveDateFrom;
    const matchesEffectiveDateTo = !filters.effectiveDateTo || quote.effectiveDate <= filters.effectiveDateTo;
    
    // Family group size (applicants) filter
    const matchesApplicantsFrom = !filters.applicantsFrom || (quote.familyGroupSize && quote.familyGroupSize >= parseInt(filters.applicantsFrom));
    const matchesApplicantsTo = !filters.applicantsTo || (quote.familyGroupSize && quote.familyGroupSize <= parseInt(filters.applicantsTo));
    
    // Effective year filter (extract year from date string to avoid timezone issues)
    const effectiveYear = quote.effectiveDate ? parseInt(quote.effectiveDate.split('-')[0]) : null;
    const matchesEffectiveYear = filters.effectiveYears.length === 0 || (effectiveYear && filters.effectiveYears.includes(effectiveYear));
    
    // OEP filter - only show eligible policies for renewal
    let matchesOEP = true;
    if (oepFilter) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const renewalEligibleYear = currentMonth >= 9 ? currentYear : currentYear - 1;
      
      const isEligibleForRenewal = 
        effectiveYear === renewalEligibleYear && 
        quote.renewalStatus !== 'completed' && 
        quote.status !== 'cancelled';
      
      if (oepFilter === 'aca') {
        matchesOEP = isEligibleForRenewal && (quote.productType === 'Health Insurance ACA' || quote.productType?.toLowerCase() === 'aca');
      } else if (oepFilter === 'medicare') {
        matchesOEP = isEligibleForRenewal && (quote.productType?.startsWith('Medicare') || quote.productType?.toLowerCase() === 'medicare');
      }
    }
    
    // Sidebar view filter
    let matchesView = true;
    if (selectedView === 'archived') {
      // Show only archived policies
      matchesView = quote.isArchived === true;
    } else if (selectedView === 'exports') {
      // Show policies ready for export (approved, submitted, or completed statuses) - exclude archived
      matchesView = (quote.status === 'approved' || quote.status === 'submitted' || quote.status === 'completed') && !quote.isArchived;
    } else if (selectedView === 'important') {
      // Show policies that need attention (pending_review, rejected, or have issues) - exclude archived
      matchesView = (quote.status === 'pending_review' || quote.status === 'rejected' || 
                   quote.documentsStatus === 'declined' || quote.paymentStatus === 'failed') && !quote.isArchived;
    } else {
      // 'policies', 'oep-aca', and 'oep-medicare' views - exclude archived policies
      matchesView = !quote.isArchived;
    }
    
    return matchesSearch && matchesStatus && matchesProduct && matchesState && 
           matchesZipCode && matchesAssignedTo && matchesEffectiveDateFrom && 
           matchesEffectiveDateTo && matchesApplicantsFrom && matchesApplicantsTo &&
           matchesEffectiveYear && matchesOEP && matchesView;
  });
  
  // Check if any filters are active
  const hasActiveFilters = filters.status !== "all" || filters.productType !== "all" || 
    filters.state || filters.zipCode || filters.assignedTo || filters.effectiveDateFrom || 
    filters.effectiveDateTo || filters.applicantsFrom || filters.applicantsTo ||
    filters.effectiveYears.length > 0 || filters.searchFamilyMembers;
  
  // Pagination logic
  const totalItems = filteredQuotes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedQuotes = filteredQuotes.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchInput, filters]);
  
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
      effectiveYears: [],
      searchFamilyMembers: false,
    });
  };

  // Step indicators
  const steps = [
    { number: 1, title: "Policy Information", icon: FileText },
    { number: 2, title: "Personal Information & Address", icon: User },
    { number: 3, title: "Family Members", icon: Users },
    { number: 4, title: "Household Income", icon: DollarSign },
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
              Configure payment schedule and preferences for this policy
            </SheetDescription>
          </SheetHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit((data) => {
              onSave({
                effectiveDate: formatDateForBackend(data.firstPaymentDate),
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
              Add or update internal notes about this policy
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
                        placeholder="Add any notes or comments about this policy..."
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
      queryKey: ['/api/policies', quote?.id, 'payment-methods', paymentMethodId],
      queryFn: async () => {
        const res = await fetch(`/api/policies/${quote?.id}/payment-methods/${paymentMethodId}`, {
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
      policyId: z.string(),
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
      policyId: z.string(),
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
        policyId: quote?.id || '',
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
        policyId: quote?.id || '',
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
          policyId: quote?.id || '',
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
          policyId: quote?.id || '',
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
    }, [open]);

    // Populate form with existing data when editing
    useEffect(() => {
      if (open && paymentMethodId && paymentMethodData?.paymentMethod) {
        const pm = paymentMethodData.paymentMethod;
        if (pm.paymentType === 'card') {
          setPaymentTab('card');
          cardForm.reset({
            companyId: pm.companyId,
            policyId: pm.quoteId,
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
            policyId: pm.quoteId,
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
            await apiRequest("PATCH", `/api/policies/${quote.id}/payment-methods/${paymentMethodId}`, data);
          } else {
            await apiRequest("POST", `/api/policies/${quote.id}/payment-methods`, data);
          }
        } else {
          const isValid = await bankAccountForm.trigger();
          if (!isValid) {
            return;
          }
          const data = bankAccountForm.getValues();
          
          if (paymentMethodId) {
            await apiRequest("PATCH", `/api/policies/${quote.id}/payment-methods/${paymentMethodId}`, data);
          } else {
            await apiRequest("POST", `/api/policies/${quote.id}/payment-methods`, data);
          }
        }
        
        // Refresh unified policy detail data
        await queryClient.invalidateQueries({ queryKey: ['/api/policies', quote.id, 'detail'] });
        
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
    // ROBUST FIX: Show loading state until viewingQuote is actually available
    // This prevents the "Policy not found" flash before data loads
    if (isLoadingQuoteDetail || !viewingQuote) {
      return (
        <>
          <div className="flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground">Loading policy details...</p>
            </div>
          </div>
        </>
      );
    }

    // PERMANENT FIX: Show ALL family members (exclude only 'client')
    const allFamilyMembers = membersDetailsData?.members?.filter(m => m.role !== 'client') || [];
    const spousesFromMembers = allFamilyMembers.filter(m => m.role === 'spouse');
    const dependentsFromMembers = allFamilyMembers.filter(m => m.role !== 'spouse'); // Everyone else is a dependent
    
    // CRITICAL: Ensure spouses and dependents are always arrays, never undefined
    const viewingQuoteWithMembers: QuoteWithArrays = {
      ...viewingQuote,
      spouses: spousesFromMembers.length > 0 ? spousesFromMembers as Spouse[] : ((viewingQuote?.spouses as Spouse[]) ?? []),
      dependents: dependentsFromMembers.length > 0 ? dependentsFromMembers as Dependent[] : ((viewingQuote?.dependents as Dependent[]) ?? []),
    };
    
    const product = PRODUCT_TYPES.find(p => p.id === viewingQuote.productType);
    // Use agent from quoteDetail if available, otherwise fallback to agents list
    const agent = quoteDetail?.policy?.agent || agents.find(a => a.id === viewingQuote.agentId);
    const totalApplicants = 1 + 
      (viewingQuoteWithMembers.spouses?.filter((s) => s.isApplicant).length || 0) + 
      (viewingQuoteWithMembers.dependents?.filter((d) => d.isApplicant).length || 0);
    const totalFamilyMembers = 1 + 
      (viewingQuoteWithMembers.spouses?.length || 0) + 
      (viewingQuoteWithMembers.dependents?.length || 0);
    // Count only members marked as primary dependents
    const totalDependents = [
      viewingQuoteWithMembers,
      ...(viewingQuoteWithMembers.spouses || []),
      ...(viewingQuoteWithMembers.dependents || [])
    ].filter((m) => m.isPrimaryDependent === true).length;

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

    // Validate data required for CMS Marketplace API
    const validateMarketplaceData = () => {
      const missing: string[] = [];
      
      // Check county (required for FIPS code)
      if (!viewingQuote.physical_county) {
        missing.push("County information (Physical Address)");
      }
      
      // Check if at least one member has income data
      const hasIncome = (householdIncomeData as any)?.totalIncome > 0;
      if (!hasIncome) {
        missing.push("Household income information");
      }
      
      // Check if primary client has date of birth
      if (!viewingQuote.clientDateOfBirth) {
        missing.push("Primary applicant date of birth");
      }
      
      // Check if all applicant spouses have DOB
      const spousesWithoutDOB = (viewingQuoteWithMembers.spouses || [])
        .filter((s: any) => s.isApplicant && !s.dateOfBirth);
      if (spousesWithoutDOB.length > 0) {
        missing.push(`Date of birth for ${spousesWithoutDOB.length} spouse(s)`);
      }
      
      // Check if all applicant dependents have DOB
      const dependentsWithoutDOB = (viewingQuoteWithMembers.dependents || [])
        .filter((d: any) => d.isApplicant && !d.dateOfBirth);
      if (dependentsWithoutDOB.length > 0) {
        missing.push(`Date of birth for ${dependentsWithoutDOB.length} dependent(s)`);
      }
      
      return missing;
    };

    return (
      <div className="h-full overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Sidebar Summary - Right side on desktop */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-l bg-background p-6 overflow-y-auto flex-shrink-0 order-1 lg:order-2">
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="space-y-4">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Policy {viewingQuote.id}</h2>
                  <p className="text-xs text-muted-foreground">Internal Code</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground mb-2 block">Agent</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={changeAgentMutation.isPending}>
                      <button className="w-full h-9 px-3 py-2 bg-background border border-input rounded-md flex items-center justify-between text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed" data-testid="select-agent">
                        <div className="flex items-center gap-2">
                          {agent?.avatar ? (
                            <img 
                              src={agent.avatar} 
                              alt=""
                              className="h-6 w-6 rounded-full object-cover border border-border flex-shrink-0"
                            />
                          ) : agent ? (
                            <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                              {agent.firstName?.[0]}{agent.lastName?.[0]}
                            </div>
                          ) : null}
                          <span className="truncate">{agent ? `${agent.firstName} ${agent.lastName}` : "Select agent..."}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[320px]">
                      {companyAgents.map((agentOption) => (
                        <DropdownMenuItem
                          key={agentOption.id}
                          onClick={() => changeAgentMutation.mutate(agentOption.id)}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {agentOption.avatar ? (
                              <img 
                                src={agentOption.avatar} 
                                alt=""
                                className="h-6 w-6 rounded-full object-cover border border-border flex-shrink-0"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                                {agentOption.firstName?.[0]}{agentOption.lastName?.[0]}
                              </div>
                            )}
                            <span>{agentOption.firstName} {agentOption.lastName}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Status Badges - Inline Editable */}
                <div className="pb-3 border-b space-y-2">
                  {/* Policy Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <div className="flex items-center gap-2">
                      {viewingQuote.isBlocked && (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <StatusBadgeEditor
                        type="policy"
                        statusType="status"
                        currentValue={viewingQuote.status}
                        id={viewingQuote.id}
                        allStatuses={{
                          status: viewingQuote.status,
                          documentsStatus: viewingQuote.documentsStatus,
                          paymentStatus: viewingQuote.paymentStatus,
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Documents Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Documents status:</span>
                    <StatusBadgeEditor
                      type="policy"
                      statusType="documentsStatus"
                      currentValue={viewingQuote.documentsStatus}
                      id={viewingQuote.id}
                      allStatuses={{
                        status: viewingQuote.status,
                        documentsStatus: viewingQuote.documentsStatus,
                        paymentStatus: viewingQuote.paymentStatus,
                      }}
                    />
                  </div>
                  
                  {/* Payment Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment status:</span>
                    <StatusBadgeEditor
                      type="policy"
                      statusType="paymentStatus"
                      currentValue={viewingQuote.paymentStatus}
                      id={viewingQuote.id}
                      allStatuses={{
                        status: viewingQuote.status,
                        documentsStatus: viewingQuote.documentsStatus,
                        paymentStatus: viewingQuote.paymentStatus,
                      }}
                    />
                  </div>

                  {/* Consent Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consent status:</span>
                    <Badge 
                      variant={
                        viewingQuote.consentStatus === 'signed' ? 'default' :
                        viewingQuote.consentStatus === 'sent' ? 'secondary' :
                        viewingQuote.consentStatus === 'failed' ? 'destructive' :
                        'outline'
                      }
                      className={
                        viewingQuote.consentStatus === 'signed' ? 'bg-green-600 hover:bg-green-700' :
                        viewingQuote.consentStatus === 'sent' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
                        ''
                      }
                    >
                      {viewingQuote.consentStatus === 'signed' ? 'Signed' :
                       viewingQuote.consentStatus === 'sent' ? 'Sent' :
                       viewingQuote.consentStatus === 'failed' ? 'Failed' :
                       'Not Sent'}
                    </Badge>
                  </div>
                </div>

                <div className="pb-3 border-b">
                  <label className="text-xs text-muted-foreground">Carrier</label>
                  <p className="text-sm font-medium">{product?.name || viewingQuote.productType}</p>
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
                  <span className="text-xs font-semibold">{viewingQuote.memberId || '-'}</span>
                </div>
              </div>
            </div>

            {/* Policy Actions */}
            <div className="space-y-2 pt-4 border-t">
              <button
                onClick={() => setDocumentsSheetOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
                data-testid="button-documents"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Documents</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs h-5 px-1.5 border border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                >
                  {quoteDocumentsCount}
                </Badge>
              </button>

              <button
                onClick={() => {
                  console.log('[NOTES] Button clicked, opening sheet...');
                  setNotesSheetOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
                data-testid="button-notes"
              >
                <div className="flex items-center gap-2.5">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Notes</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs h-5 px-1.5 border border-slate-500/50 bg-slate-500/10 text-slate-700 dark:text-slate-400"
                >
                  {quoteNotesCount}
                </Badge>
              </button>

              <button
                onClick={() => setRemindersSheetOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
                data-testid="button-reminders"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Reminders</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs h-5 px-1.5 border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  data-testid="badge-reminders-count"
                >
                  {pendingRemindersCount}
                </Badge>
              </button>

              <button
                onClick={() => setConsentsSheetOpen(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover-elevate active-elevate-2 text-left transition-colors"
                data-testid="button-signature-forms"
              >
                <div className="flex items-center gap-2.5">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Signature Forms</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`text-xs h-5 px-1.5 ${
                    consents.filter(c => c.status === 'signed').length > 0
                      ? "border border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                      : "border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                  }`}
                  data-testid="badge-signature-forms"
                >
                  {consents.filter(c => c.status === 'signed').length > 0 
                    ? consents.filter(c => c.status === 'signed').length 
                    : "Pending"}
                </Badge>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area - Left side on desktop */}
        <div className="flex-1 overflow-y-auto order-2 lg:order-1">
          <div className="p-6">
            {/* Block Warning Banner */}
            {viewingQuote.isBlocked && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  An authorized person from your Agency blocked updates on this policy.
                </p>
              </div>
            )}

            {/* Renewal Alert Banner */}
            {(() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentDay = now.getDate();
              const currentYear = now.getFullYear();
              
              const isInRenewalPeriod = 
                (currentMonth >= 9) ||
                (currentMonth === 0) ||
                (currentMonth === 1 && currentDay === 1);
              
              if (!isInRenewalPeriod) return null;
              
              const renewalEligibleYear = currentMonth >= 9 ? currentYear : currentYear - 1;
              const renewalTargetYear = renewalEligibleYear + 1;
              
              const effectiveYear = viewingQuote.effectiveDate ? parseInt(viewingQuote.effectiveDate.split('-')[0]) : null;
              const isACA = viewingQuote.productType === 'Health Insurance ACA' || viewingQuote.productType?.toLowerCase() === 'aca';
              const isMedicare = viewingQuote.productType?.startsWith('Medicare') || viewingQuote.productType?.toLowerCase() === 'medicare';
              
              const isRenewalPolicy = !!viewingQuote.renewedFromPolicyId;
              const isFuturePolicy = effectiveYear && effectiveYear > renewalEligibleYear;
              
              const needsRenewal = (isACA || isMedicare) && 
                                   !isRenewalPolicy &&
                                   !isFuturePolicy &&
                                   effectiveYear === renewalEligibleYear &&
                                   viewingQuote.renewalStatus !== 'completed' &&
                                   viewingQuote.status !== 'cancelled' &&
                                   !viewingQuote.isArchived;
              
              if (!needsRenewal) return null;

              return (
                <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="alert-renewal-required">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Renewal Required for {renewalTargetYear}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      This policy is active in {renewalEligibleYear} and will need to be renewed for {renewalTargetYear}. Please initiate the renewal process before the end of the Open Enrollment Period.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => renewalMutation.mutate(viewingQuote.id)}
                    disabled={renewingPolicyId === viewingQuote.id}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                    data-testid="button-renew-detail"
                  >
                    {renewingPolicyId === viewingQuote.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Renewing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Renew for {renewalTargetYear}
                      </>
                    )}
                  </Button>
                </div>
              );
            })()}
            
            {/* Two Column Layout: Member Card + Insurance Plans */}
            <div className="mb-6">
              <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5" style={{ height: '440px' }}>
                
                {/* LEFT: Member Card - Elegant Design - FIXED height */}
                <div className="rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden 2xl:col-span-5 flex flex-col" style={{ height: '440px' }}>
                  {/* Header with Product Type */}
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const productType = PRODUCT_TYPES.find(p => p.id === viewingQuote.productType || p.name === viewingQuote.productType);
                        const IconComponent = productType?.icon;
                        return IconComponent ? (
                          <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-4.5 w-4.5 text-primary" />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-muted border border-border/40 flex items-center justify-center flex-shrink-0">
                            <Shield className="h-4.5 w-4.5 text-muted-foreground" />
                          </div>
                        );
                      })()}
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {product?.name || viewingQuote.productType || 'Policy'}
                        </span>
                      </div>
                      <div className="ml-2 px-3 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                        {policyInfo.effectiveDate?.split('-')[0] || new Date().getFullYear()}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50" data-testid="button-options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setBlockPolicyDialogOpen(true)}>
                          <Lock className="h-3.5 w-3.5 mr-2" />
                          {viewingQuote.isBlocked ? 'Unblock' : 'Block'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRemindersSheetOpen(true); setSelectedReminder(null); setReminderFormOpen(true); }}>
                          <Bell className="h-3.5 w-3.5 mr-2" />
                          Reminder
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/customers/${viewingQuote.id}/print`, '_blank')}>
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          Print
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDuplicatePolicyDialogOpen(true)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setCancelPolicyDialogOpen(true)} className="text-destructive">
                          <X className="h-3.5 w-3.5 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setArchivePolicyDialogOpen(true)}>
                          <Archive className="h-3.5 w-3.5 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {/* Main Content */}
                  <div className="p-5">
                    {/* Member Info with Avatar */}
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0 border border-border/30">
                        {viewingQuote.clientGender === 'male' ? (
                          <svg viewBox="0 0 24 24" className="h-9 w-9 sm:h-11 sm:w-11 text-muted-foreground/60" fill="currentColor">
                            <circle cx="12" cy="7" r="4" />
                            <path d="M12 14c-4 0-7 2-7 4.5V20h14v-1.5c0-2.5-3-4.5-7-4.5z" />
                          </svg>
                        ) : viewingQuote.clientGender === 'female' ? (
                          <svg viewBox="0 0 24 24" className="h-9 w-9 sm:h-11 sm:w-11 text-muted-foreground/60" fill="currentColor">
                            <circle cx="12" cy="6" r="3.5" />
                            <path d="M12 12c-3.5 0-6.5 1.8-6.5 4v0.5c0 0.3 0.2 0.5 0.5 0.5h1l1 3h8l1-3h1c0.3 0 0.5-0.2 0.5-0.5V16c0-2.2-3-4-6.5-4z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-9 w-9 sm:h-11 sm:w-11 text-muted-foreground/40" fill="currentColor">
                            <circle cx="12" cy="7" r="4" />
                            <path d="M12 14c-4 0-7 2-7 4.5V20h14v-1.5c0-2.5-3-4.5-7-4.5z" />
                          </svg>
                        )}
                      </div>
                      
                      {/* Member Details */}
                      <div className="flex-1 min-w-0">
                        {/* Name with copy button */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-tight">
                            {[viewingQuote.clientFirstName, viewingQuote.clientMiddleName, viewingQuote.clientLastName, viewingQuote.clientSecondLastName].filter(Boolean).join(' ')}
                          </h2>
                          <button
                            type="button"
                            onClick={() => {
                              const fullName = [viewingQuote.clientFirstName, viewingQuote.clientMiddleName, viewingQuote.clientLastName, viewingQuote.clientSecondLastName].filter(Boolean).join(' ');
                              navigator.clipboard.writeText(fullName);
                              toast({ title: "Copied", description: "Name copied to clipboard", duration: 2000 });
                            }}
                            className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors"
                            data-testid="button-copy-name"
                          >
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        
                        {/* Info Grid - All on same line */}
                        <div className="grid grid-cols-3 gap-x-4 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">Date of Birth</span>
                            <div className="flex items-center gap-1">
                              <p className="font-medium">
                                {viewingQuote.clientDateOfBirth ? formatDateForDisplay(viewingQuote.clientDateOfBirth, "MM/dd/yyyy") : '—'}
                                {viewingQuote.clientDateOfBirth && (
                                  <span className="text-muted-foreground ml-1">({calculateAge(viewingQuote.clientDateOfBirth)} yrs)</span>
                                )}
                              </p>
                              {viewingQuote.clientDateOfBirth && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(formatDateForDisplay(viewingQuote.clientDateOfBirth!, "MM/dd/yyyy"));
                                    toast({ title: "Copied", duration: 2000 });
                                  }}
                                  className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors"
                                  data-testid="button-copy-dob"
                                >
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Sex</span>
                            <p className="font-medium">{viewingQuote.clientGender === 'male' ? 'Male' : viewingQuote.clientGender === 'female' ? 'Female' : '—'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">SSN</span>
                            <div className="flex items-center gap-1">
                              <p className="font-medium font-mono" data-testid="text-ssn-display">{displaySSN(viewingQuote.clientSsn, ssnVisible)}</p>
                              {viewingQuote.clientSsn && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setSsnVisible(!ssnVisible)}
                                    className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors"
                                    data-testid="button-toggle-ssn"
                                  >
                                    {ssnVisible ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                                  </button>
                                  {ssnVisible && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(viewingQuote.clientSsn!);
                                        toast({ title: "Copied", duration: 2000 });
                                      }}
                                      className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors"
                                      data-testid="button-copy-ssn"
                                    >
                                      <Copy className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contact Info Section */}
                  <div className="px-5 py-3 bg-muted/20 border-t border-border/30">
                    <div className="space-y-2 text-sm">
                      {/* Phone + Email row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Phone */}
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-background border border-border/40 flex items-center justify-center flex-shrink-0">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium truncate">{viewingQuote.clientPhone || '—'}</span>
                          {viewingQuote.clientPhone && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(viewingQuote.clientPhone!);
                                toast({ title: "Copied", duration: 2000 });
                              }}
                              className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                              data-testid="button-copy-phone"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        {/* Email */}
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-background border border-border/40 flex items-center justify-center flex-shrink-0">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="font-medium truncate">{viewingQuote.clientEmail || '—'}</span>
                          {viewingQuote.clientEmail && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(viewingQuote.clientEmail!);
                                toast({ title: "Copied", duration: 2000 });
                              }}
                              className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                              data-testid="button-copy-email"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Address - structured layout */}
                      <div className="flex items-start gap-2.5 pt-2 mt-2 border-t border-border/30">
                        <div className="h-8 w-8 rounded-lg bg-background border border-border/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 space-y-1">
                          {/* Row 1: Address + Apt */}
                          <div className="grid grid-cols-3 gap-x-4">
                            <div className="col-span-2">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Address</span>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium">{viewingQuote.physical_street || '—'}</p>
                                {viewingQuote.physical_street && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(viewingQuote.physical_street!);
                                      toast({ title: "Copied", duration: 2000 });
                                    }}
                                    className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                                    data-testid="button-copy-street"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Apt</span>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium">{viewingQuote.physical_address_line_2 || '—'}</p>
                                {viewingQuote.physical_address_line_2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(viewingQuote.physical_address_line_2!);
                                      toast({ title: "Copied", duration: 2000 });
                                    }}
                                    className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                                    data-testid="button-copy-apt"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Row 2: City + State + Zip Code */}
                          <div className="grid grid-cols-3 gap-x-4">
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">City</span>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium">{viewingQuote.physical_city || '—'}</p>
                                {viewingQuote.physical_city && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(viewingQuote.physical_city!);
                                      toast({ title: "Copied", duration: 2000 });
                                    }}
                                    className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                                    data-testid="button-copy-city"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">State</span>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium">{viewingQuote.physical_state || '—'}</p>
                                {viewingQuote.physical_state && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(viewingQuote.physical_state!);
                                      toast({ title: "Copied", duration: 2000 });
                                    }}
                                    className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                                    data-testid="button-copy-state"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Zip Code</span>
                              <div className="flex items-center gap-1">
                                <p className="text-sm font-medium">{viewingQuote.physical_postal_code || '—'}</p>
                                {viewingQuote.physical_postal_code && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(viewingQuote.physical_postal_code!);
                                      toast({ title: "Copied", duration: 2000 });
                                    }}
                                    className="p-1 rounded-md border border-border/50 bg-background hover:bg-muted transition-colors flex-shrink-0"
                                    data-testid="button-copy-zip"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Insurance Plans Card - Elegant Design - FIXED height */}
                <div className="rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col 2xl:col-span-7" style={{ height: '440px' }}>
                  {/* Header */}
                  <div className="px-5 py-3 bg-muted/30 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const productType = PRODUCT_TYPES.find(p => p.id === viewingQuote.productType || p.name === viewingQuote.productType);
                          const IconComponent = productType?.icon;
                          return IconComponent ? (
                            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <IconComponent className="h-4.5 w-4.5 text-primary" />
                            </div>
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-background border border-border/40 flex items-center justify-center">
                              <Shield className="h-4.5 w-4.5 text-muted-foreground" />
                            </div>
                          );
                        })()}
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">Insurance Plans</h3>
                          <p className="text-xs text-muted-foreground">{(quoteDetail?.plans || []).length} plan{(quoteDetail?.plans || []).length !== 1 ? 's' : ''} enrolled</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Plans Body */}
                  <div className="pl-5 pr-4 py-4 flex-1 overflow-y-auto">
                    {(() => {
                      const plans = quoteDetail?.plans || [];
                      
                      if (plans.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                              <Shield className="h-7 w-7 text-muted-foreground/60" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">No Plans Added</p>
                            <p className="text-xs text-muted-foreground mb-5 max-w-[200px]">Search the marketplace or add a plan manually</p>
                            <div className="flex items-center gap-2">
                              <Button variant="default" size="sm" className="h-8 text-xs" onClick={() => setManualPlanDialogOpen(true)} data-testid="button-add-plan-empty">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add Plan
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      
                      // Show full plan details inline
                      return (
                        <div className="space-y-4">
                          {plans.map((policyPlan: any, index: number) => {
                            const plan = typeof policyPlan.planData === 'string' ? JSON.parse(policyPlan.planData) : policyPlan.planData;
                            if (!plan) return null;
                            
                            const individualDeductible = plan.deductibles?.find((d: any) => !d.family);
                            const familyDeductible = plan.deductibles?.find((d: any) => d.family);
                            const mainDeductible = individualDeductible || familyDeductible || plan.deductibles?.[0];
                            const individualMoop = plan.moops?.find((m: any) => !m.family);
                            const outOfPocketMax = individualMoop?.amount || plan.out_of_pocket_limit;
                            
                            const formatCurrency = (value: any) => {
                              if (value === null || value === undefined) return 'N/A';
                              const num = typeof value === 'string' ? parseFloat(value) : value;
                              if (isNaN(num)) return 'N/A';
                              if (num < 0) return '$0';
                              if (num === 0) return '$0';
                              return num % 1 === 0 ? `${num.toFixed(0)}` : `${num.toFixed(2)}`;
                            };
                            
                            const getBenefitCost = (benefitName: string) => {
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

                            const formatManualCost = (value: any) => {
                              if (!value) return null;
                              const rawValue = getCostShareRawValue(value);
                              const costShareValue = parseCostShareValue(rawValue);
                              return costShareValue ? formatCostShareValueShort(costShareValue) : null;
                            };

                            const primaryCareCost = getBenefitCost('Primary Care') || formatManualCost(plan.copay_primary);
                            const specialistCost = getBenefitCost('Specialist') || formatManualCost(plan.copay_specialist);
                            const urgentCareCost = getBenefitCost('Urgent Care') || formatManualCost(plan.copay_urgent_care);
                            const emergencyCost = getBenefitCost('Emergency') || formatManualCost(plan.copay_emergency);
                            const genericDrugsCost = getBenefitCost('Generic Drugs');
                            const mentalHealthCost = getBenefitCost('Mental');
                            
                            const premium = plan.premium_w_credit !== undefined ? plan.premium_w_credit : plan.premium;
                            
                            return (
                              <div key={policyPlan.id || index} className="rounded-lg border border-border/60 bg-background/40 overflow-hidden">
                                {/* Header: Carrier + Plan Name + Badges */}
                                <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-foreground">{plan.issuer?.name || 'Insurance Provider'}</p>
                                      <p className="text-sm text-primary font-medium truncate">{plan.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      <Badge variant="secondary" className="text-[10px] h-5 font-medium">{plan.metal_level || 'N/A'}</Badge>
                                      <Badge variant="outline" className="text-[10px] h-5">{plan.type || 'N/A'}</Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Cost Summary - Prominent */}
                                <div className="p-4">
                                  <div className="flex items-center gap-6">
                                    {/* Monthly Payment - Large and prominent */}
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground mb-1">Monthly Payment</p>
                                      <p className="text-3xl font-bold text-primary">
                                        ${(plan.premium_w_credit ?? plan.premium ?? 0).toFixed(2)}
                                      </p>
                                    </div>
                                    
                                    {/* Savings */}
                                    {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null && plan.premium !== plan.premium_w_credit && (
                                      <div className="text-center">
                                        <p className="text-xs text-muted-foreground mb-1">Savings</p>
                                        <p className="text-xl font-semibold text-green-600">
                                          ${Math.abs((plan.premium ?? 0) - (plan.premium_w_credit ?? plan.premium ?? 0)).toFixed(2)}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Plan Was */}
                                    {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null && plan.premium !== plan.premium_w_credit && (
                                      <div className="text-center">
                                        <p className="text-xs text-muted-foreground mb-1">Plan Was</p>
                                        <p className="text-lg font-medium text-muted-foreground line-through">
                                          ${(plan.premium ?? 0).toFixed(2)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Plan ID, Marketplace ID, Member ID, Effective Date, Expiration Date */}
                                  <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Plan ID</p>
                                      <p className="font-mono text-xs">{plan.id || 'N/A'}</p>
                                    </div>
                                    {(plan.marketplaceId || policyPlan.marketplaceId) && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Marketplace ID</p>
                                        <p className="font-mono text-xs">{plan.marketplaceId || policyPlan.marketplaceId}</p>
                                      </div>
                                    )}
                                    {(plan.memberId || policyPlan.memberId) && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Member ID</p>
                                        <p className="font-mono text-xs">{plan.memberId || policyPlan.memberId}</p>
                                      </div>
                                    )}
                                    {(plan.effectiveDate || policyPlan.effectiveDate) && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Effective Date</p>
                                        <p className="text-xs">{plan.effectiveDate || policyPlan.effectiveDate}</p>
                                      </div>
                                    )}
                                    {(plan.expirationDate || policyPlan.expirationDate) && (
                                      <div>
                                        <p className="text-xs text-muted-foreground">Expiration Date</p>
                                        <p className="text-xs">{plan.expirationDate || policyPlan.expirationDate}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="px-4 py-2 border-t border-border/40 flex items-center justify-end gap-1.5 bg-muted/10">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingPlanId(policyPlan.id); setManualPlanDialogOpen(true); }} data-testid={`button-edit-plan-${policyPlan.id}`}>
                                    <Edit className="h-3 w-3 mr-1" /> Edit
                                  </Button>
                                  <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setDeletingPlan({ id: policyPlan.id, name: policyPlan.planName || 'this plan' })} data-testid={`button-remove-plan-${policyPlan.id}`}>
                                    <X className="h-3 w-3 mr-1" /> Remove
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">

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

                {/* Add Member Inline Editor */}
                {addingMember && (
                  <AddMemberInline
                    quote={viewingQuote}
                    onClose={() => setAddingMember(false)}
                    onSave={addMemberMutation.mutate}
                    isPending={addMemberMutation.isPending}
                  />
                )}

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
                            {[
                              viewingQuote.clientFirstName,
                              viewingQuote.clientMiddleName,
                              viewingQuote.clientLastName,
                              viewingQuote.clientSecondLastName
                            ].filter(Boolean).join(' ')}
                          </p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            <Badge variant="default" className="text-xs h-4 px-1.5">Self</Badge>
                            {viewingQuote.clientIsApplicant && (
                              <Badge variant="default" className="text-xs h-4 px-1.5 bg-blue-600 hover:bg-blue-700">Applicant</Badge>
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
                            <div className="flex items-center gap-1">
                              <p className="font-mono font-medium">
                                {viewingQuote.clientSsn ? displaySSN(viewingQuote.clientSsn, ssnVisible) : 'N/A'}
                              </p>
                              {viewingQuote.clientSsn && (
                                <button
                                  type="button"
                                  onClick={() => setSsnVisible(!ssnVisible)}
                                  className="p-0.5 rounded hover:bg-muted transition-colors"
                                  data-testid="button-toggle-ssn-primary"
                                >
                                  {ssnVisible ? (
                                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </button>
                              )}
                            </div>
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
                          onClick={() => {
                            const memberId = `primary-${viewingQuote.id}`;
                            setExpandedMemberId(expandedMemberId === memberId ? null : memberId);
                          }}
                          data-testid="button-view-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <div className="h-7 w-7" />
                      </div>
                    </div>

                    {/* Primary Member Inline Editor */}
                    {expandedMemberId === `primary-${viewingQuote.id}` && viewingQuote?.id && (
                      <InlineMemberEditor
                        quoteId={viewingQuote.id}
                        quote={viewingQuote}
                        memberType="primary"
                        onClose={() => setExpandedMemberId(null)}
                        onSave={updateQuoteMutation.mutate}
                        isPending={updateQuoteMutation.isPending}
                      />
                    )}

                    {/* Spouses */}
                    {(viewingQuoteWithMembers.spouses || []).map((spouse: any, index: number) => (
                      <React.Fragment key={`spouse-${spouse.id || index}`}>
                        <div className="grid grid-cols-[auto_1fr_80px] gap-3 p-3 border-b hover-elevate items-center">
                          <Avatar className="h-9 w-9 border-2 border-muted">
                            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                              {spouse.firstName?.[0]}{spouse.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 min-w-0">
                            <div>
                              <p className="font-semibold text-sm truncate">
                                {[
                                  spouse.firstName,
                                  spouse.middleName,
                                  spouse.lastName,
                                  spouse.secondLastName
                                ].filter(Boolean).join(' ')}
                              </p>
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                <Badge variant="outline" className="text-xs h-4 px-1.5">Spouse</Badge>
                                {spouse.isApplicant && (
                                  <Badge variant="default" className="text-xs h-4 px-1.5 bg-blue-600 hover:bg-blue-700">Applicant</Badge>
                                )}
                                {spouse.isPrimaryDependent && (
                                  <Badge variant="default" className="text-xs h-4 px-1.5 bg-green-600 hover:bg-green-700">Dependent</Badge>
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
                                <div className="flex items-center gap-1">
                                  <p className="font-mono font-medium">
                                    {spouse.ssn ? displaySSN(spouse.ssn, ssnVisible) : 'N/A'}
                                  </p>
                                  {spouse.ssn && (
                                    <button
                                      type="button"
                                      onClick={() => setSsnVisible(!ssnVisible)}
                                      className="p-0.5 rounded hover:bg-muted transition-colors"
                                      data-testid={`button-toggle-ssn-spouse-${index}`}
                                    >
                                      {ssnVisible ? (
                                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                                      ) : (
                                        <Eye className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </button>
                                  )}
                                </div>
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
                              onClick={() => {
                                const memberId = `spouse-${index}`;
                                setExpandedMemberId(expandedMemberId === memberId ? null : memberId);
                              }}
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
                                role: 'Spouse',
                                index: index
                              })}
                              data-testid={`button-delete-spouse-${index}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Spouse Inline Editor */}
                        {expandedMemberId === `spouse-${index}` && viewingQuote?.id && (
                          <InlineMemberEditor
                            quoteId={viewingQuote.id}
                            quote={viewingQuote}
                            memberType="spouse"
                            memberIndex={index}
                            onClose={() => setExpandedMemberId(null)}
                            onSave={updateQuoteMutation.mutate}
                            isPending={updateQuoteMutation.isPending}
                          />
                        )}
                      </React.Fragment>
                    ))}

                    {/* Dependents */}
                    {(viewingQuoteWithMembers.dependents || []).map((dependent: any, index: number) => (
                      <React.Fragment key={`dependent-${dependent.id || index}`}>
                        <div className="grid grid-cols-[auto_1fr_80px] gap-3 p-3 border-b last:border-b-0 hover-elevate items-center">
                          <Avatar className="h-9 w-9 border-2 border-muted">
                            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                              {dependent.firstName?.[0]}{dependent.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 min-w-0">
                            <div>
                              <p className="font-semibold text-sm truncate">
                                {[
                                  dependent.firstName,
                                  dependent.middleName,
                                  dependent.lastName,
                                  dependent.secondLastName
                                ].filter(Boolean).join(' ')}
                              </p>
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                <Badge variant="outline" className="text-xs h-4 px-1.5">{dependent.relation || 'Dependent'}</Badge>
                                {dependent.isApplicant && (
                                  <Badge variant="default" className="text-xs h-4 px-1.5 bg-blue-600 hover:bg-blue-700">Applicant</Badge>
                                )}
                                {dependent.isPrimaryDependent && (
                                  <Badge variant="default" className="text-xs h-4 px-1.5 bg-green-600 hover:bg-green-700">Dependent</Badge>
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
                                <div className="flex items-center gap-1">
                                  <p className="font-mono font-medium">
                                    {dependent.ssn ? displaySSN(dependent.ssn, ssnVisible) : 'N/A'}
                                  </p>
                                  {dependent.ssn && (
                                    <button
                                      type="button"
                                      onClick={() => setSsnVisible(!ssnVisible)}
                                      className="p-0.5 rounded hover:bg-muted transition-colors"
                                      data-testid={`button-toggle-ssn-dependent-${index}`}
                                    >
                                      {ssnVisible ? (
                                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                                      ) : (
                                        <Eye className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </button>
                                  )}
                                </div>
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
                              onClick={() => {
                                const memberId = `dependent-${index}`;
                                setExpandedMemberId(expandedMemberId === memberId ? null : memberId);
                              }}
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
                                role: dependent.relation || 'Dependent',
                                index: index
                              })}
                              data-testid={`button-delete-dependent-${index}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Dependent Inline Editor */}
                        {expandedMemberId === `dependent-${index}` && viewingQuote?.id && (
                          <InlineMemberEditor
                            quoteId={viewingQuote.id}
                            quote={viewingQuote}
                            memberType="dependent"
                            memberIndex={index}
                            onClose={() => setExpandedMemberId(null)}
                            onSave={updateQuoteMutation.mutate}
                            isPending={updateQuoteMutation.isPending}
                          />
                        )}
                      </React.Fragment>
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

              {/* CMS Marketplace Plans - Navigation to dedicated page */}

              {/* Other Policies */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle>Other policies of the applicant</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Effective year:</span>
                    <Select value={otherPoliciesYear} onValueChange={setOtherPoliciesYear}>
                      <SelectTrigger className="w-24 h-8" data-testid="select-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingOtherPolicies ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : otherPolicies.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No other policies found for this applicant{otherPoliciesYear !== 'all' ? ` in ${otherPoliciesYear}` : ''}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Agent</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Policy</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otherPolicies.map((policy: any) => {
                          const product = PRODUCT_TYPES.find(p => p.id === policy.productType);
                          const agent = agents.find(a => a.id === policy.agentId);
                          const assignedAgent = agents.find(a => a.id === policy.agentId);
                          
                          const formatCurrency = (value: any) => {
                            if (value === null || value === undefined) return 'N/A';
                            const num = typeof value === 'string' ? parseFloat(value) : value;
                            if (isNaN(num)) return 'N/A';
                            // Round to $0 if negative, otherwise show real price
                            if (num < 0) return '$0';
                            if (num === 0) return '$0';
                            // Show with cents only if there are cents, otherwise show without decimals
                            return num % 1 === 0 ? `$${num.toFixed(0)}` : `$${num.toFixed(2)}`;
                          };
                          
                          return (
                            <TableRow 
                              key={policy.id} 
                              className="cursor-pointer hover:bg-accent/5"
                              onClick={() => setLocation(`/customers/${policy.id}`)}
                              data-testid={`row-other-policy-${policy.id}`}
                            >
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-pointer">
                                      <div 
                                        className="font-medium text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                        onClick={() => setLocation(`/customers/${policy.id}`)}
                                      >
                                        {policy.clientFirstName} {policy.clientMiddleName} {policy.clientLastName} {policy.clientSecondLastName}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                          {policy.clientIsApplicant ? 'Self' : 'Not Applicant'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {policy.clientGender ? policy.clientGender.charAt(0).toUpperCase() + policy.clientGender.slice(1) : 'N/A'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {policy.physical_city}, {policy.physical_state} {policy.physical_postal_code}
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={8} align="start" className="p-3">
                                    <div>
                                      <div className="font-semibold text-sm mb-2 text-center">Client information</div>
                                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                        <div className="text-left font-medium">Client:</div>
                                        <div className="text-right">
                                          {policy.clientFirstName} {policy.clientMiddleName} {policy.clientLastName} {policy.clientSecondLastName}
                                        </div>
                                        <div className="text-left font-medium">Date of birth:</div>
                                        <div className="text-right">
                                          {policy.clientDateOfBirth ? formatDateForDisplay(policy.clientDateOfBirth, "MMM dd, yyyy") : 'N/A'}
                                        </div>
                                        <div className="text-left font-medium">Address:</div>
                                        <div className="text-right">
                                          {policy.physical_street || 'N/A'}
                                          {policy.physical_county && <><br/>{policy.physical_county}</>}
                                          <br/>{policy.physical_city}, {policy.physical_state} ({policy.physical_state_abbreviation || policy.physical_state}), {policy.physical_postal_code}
                                        </div>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-semibold text-sm">
                                    {(() => {
                                      const typeMap: Record<string, string> = {
                                        'aca': 'Health Insurance ACA',
                                        'medicare': 'Medicare',
                                        'medicaid': 'Medicaid',
                                        'supplemental': 'Supplemental',
                                        'life': 'Life Insurance',
                                        'dental': 'Dental Insurance',
                                        'vision': 'Vision Insurance',
                                        'private': 'Private Insurance',
                                        'annuities': 'Annuities',
                                        'final_expense': 'Final Expense',
                                        'travel': 'Travel Insurance'
                                      };
                                      const insuranceType = typeMap[policy.productType?.toLowerCase()] || policy.productType;
                                      const carrierName = policy.selectedPlan ? (policy.selectedPlan.issuer?.name || policy.selectedPlan.issuer_name) : null;
                                      
                                      return carrierName ? `${carrierName} ${insuranceType}` : insuranceType;
                                    })()}
                                  </div>
                                  {policy.selectedPlan ? (
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                          {capitalize(policy.selectedPlan.metal_level) || 'N/A'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground font-semibold">
                                          {policy.selectedPlan.premium_w_credit !== undefined && policy.selectedPlan.premium_w_credit !== null
                                            ? formatCurrency(policy.selectedPlan.premium_w_credit)
                                            : formatCurrency(policy.selectedPlan.premium)}/mo
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic">
                                      No plan selected
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {formatDateForDisplay(policy.effectiveDate, "MMM dd, yyyy")} • {policy.id.slice(0, 8)}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {policy.isBlocked && (
                                      <Lock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />
                                    )}
                                    <StatusBadgeEditor
                                      type="policy"
                                      statusType="status"
                                      currentValue={policy.status}
                                      id={policy.id}
                                      allStatuses={{
                                        status: policy.status,
                                        documentsStatus: policy.documentsStatus,
                                        paymentStatus: policy.paymentStatus,
                                      }}
                                    />
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Documents: <span className={getDocumentsStatusColor(policy.documentsStatus || '')}>{formatStatusDisplay(policy.documentsStatus)}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Payments: <span className={getPaymentStatusColor(policy.paymentStatus || '')}>{formatPaymentStatusDisplay(policy.paymentStatus)}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex items-center justify-center border-2 border-foreground px-4 py-1.5 bg-background rounded-sm">
                                  <span className="text-2xl font-bold tracking-wide" style={{ fontFamily: 'monospace' }}>
                                    {policy.effectiveDate?.split('-')[0] || new Date().getFullYear()}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                  {/* Renewal Button - Show for eligible policies */}
                                  {(() => {
                                    const now = new Date();
                                    const currentMonth = now.getMonth();
                                    const currentDay = now.getDate();
                                    const currentYear = now.getFullYear();
                                    
                                    const isInRenewalPeriod = 
                                      (currentMonth >= 9) ||
                                      (currentMonth === 0) ||
                                      (currentMonth === 1 && currentDay === 1);
                                    
                                    if (!isInRenewalPeriod) return null;
                                    
                                    const renewalEligibleYear = currentMonth >= 9 ? currentYear : currentYear - 1;
                                    const renewalTargetYear = renewalEligibleYear + 1;
                                    
                                    const effectiveYear = policy.effectiveDate ? parseInt(policy.effectiveDate.split('-')[0]) : null;
                                    const isACA = policy.productType === 'Health Insurance ACA' || policy.productType?.toLowerCase() === 'aca';
                                    const isMedicare = policy.productType?.startsWith('Medicare') || policy.productType?.toLowerCase() === 'medicare';
                                    const isEligibleForRenewal = 
                                      (isACA || isMedicare) &&
                                      effectiveYear === renewalEligibleYear &&
                                      policy.renewalStatus !== 'completed' &&
                                      policy.status !== 'cancelled';
                                    
                                    if (!isEligibleForRenewal) return null;
                                    
                                    return (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => renewalMutation.mutate(policy.id)}
                                        disabled={renewingPolicyId === policy.id}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                                        data-testid={`button-renew-other-${policy.id}`}
                                      >
                                        {renewingPolicyId === policy.id ? (
                                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        )}
                                        Renew {renewalTargetYear}
                                      </Button>
                                    );
                                  })()}
                                  
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => navigateToPolicy(policy.id)}
                                    data-testid={`button-view-other-${policy.id}`}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                                    View
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
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
                        Are you sure you want to remove <strong>{deletingMember.name}</strong> ({deletingMember.role}) from this policy?
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
        {/* Delete Plan Confirmation Dialog */}
        <AlertDialog open={!!deletingPlan} onOpenChange={(open) => !open && setDeletingPlan(null)}>
          <AlertDialogContent data-testid="dialog-delete-plan">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Plan?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  {deletingPlan && (
                    <>
                      <p>
                        Are you sure you want to remove <strong>{deletingPlan.name}</strong> from this policy?
                      </p>
                      <p className="mt-4">
                        This will remove the plan details and pricing information. You can add a new plan later if needed.
                      </p>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-plan">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (deletingPlan) {
                    try {
                      await apiRequest("DELETE", `/api/policies/${viewingQuote.id}/plans/${deletingPlan.id}`);
                      queryClient.invalidateQueries({ queryKey: ['/api/policies', viewingQuote.id, 'detail'] });
                      setDeletingPlan(null);
                      toast({
                        title: "Success",
                        description: "Plan has been removed.",
                        duration: 3000,
                      });
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to remove plan.",
                        variant: "destructive",
                        duration: 3000,
                      });
                    }
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-plan"
              >
                Remove Plan
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
                    Are you sure you want to remove the {deletingAddress === 'mailing' ? 'mailing' : 'billing'} address from this policy?
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
        {/* Notes Sheet - Professional Corporate Design */}
        {console.log('[NOTES SHEET] Rendering in viewingQuote return, open state:', notesSheetOpen)}
        <Sheet open={notesSheetOpen} onOpenChange={setNotesSheetOpen}>
          <SheetContent className="w-full sm:max-w-3xl p-0 flex flex-col h-full z-[100]" side="left" data-testid="sheet-notes">
            {/* Header */}
            <div className="px-6 py-4 border-b">
              <SheetTitle className="text-lg font-medium">Notes & Comments</SheetTitle>
              <SheetDescription className="mt-1 text-sm">
                Internal notes for policy {viewingQuote?.id} - {quoteNotesCount} total
              </SheetDescription>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search Toolbar */}
              <div className="px-6 py-3 border-b bg-muted/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search notes..."
                    value={searchNotes}
                    onChange={(e) => setSearchNotes(e.target.value)}
                    className="pl-9 h-9"
                    data-testid="input-search-notes"
                  />
                </div>
              </div>

              {/* Notes List - Scrollable */}
              <div ref={notesListRef} className="flex-1 overflow-y-auto px-6 py-4">
                {isLoadingNotes ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium mb-1">
                      {searchNotes || filterCategory !== 'all' ? 'No notes match your filters' : 'No notes yet'}
                    </p>
                    <p className="text-xs">
                      {searchNotes || filterCategory !== 'all' ? 'Try adjusting your search or filters' : 'Create your first note to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredNotes.map((note: any) => (
                      <div
                        key={note.id}
                        className={`group relative border rounded-lg p-4 bg-card hover:border-muted-foreground/20 transition-colors ${
                          note.isImportant ? 'border-l-4 border-l-red-600' : ''
                        }`}
                        data-testid={`note-${note.id}`}
                      >
                        {/* Note Header */}
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              {note.creatorAvatar && (
                                <AvatarImage src={note.creatorAvatar} alt={note.creatorName || 'User'} />
                              )}
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(note.creatorName || 'Unknown User')
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                <span className="font-medium text-foreground">{note.creatorName || 'Unknown User'}</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="text-muted-foreground/60">
                                  {format(new Date(note.createdAt), 'MMM dd, yyyy • h:mm a')}
                                </span>
                              </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              {note.isPinned && (
                                <span className="inline-flex items-center gap-1 border border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded px-1.5 py-0.5">
                                  <Bell className="h-3 w-3" />
                                  Pinned
                                </span>
                              )}
                              {note.isImportant && (
                                <span className="inline-flex items-center gap-1 border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400 rounded px-1.5 py-0.5">
                                  <AlertCircle className="h-3 w-3" />
                                  Important
                                </span>
                              )}
                              {note.isResolved && (
                                <span className="inline-flex items-center gap-1 border border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400 rounded px-1.5 py-0.5">
                                  <Check className="h-3 w-3" />
                                  Resolved
                                </span>
                              )}
                              <span className="border rounded px-1.5 py-0.5 capitalize text-muted-foreground">
                                {note.category?.replace('_', ' ') || 'general'}
                              </span>
                            </div>
                            </div>
                          </div>

                          {/* Delete Button - Only show if current user is the creator or superadmin */}
                          {userData?.user && (note.createdBy === userData.user.id || userData.user.role === 'superadmin') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setNoteToDelete(note.id);
                                setShowDeleteDialog(true);
                              }}
                              data-testid={`button-delete-note-${note.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Note Content */}
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          note.isResolved ? 'line-through text-muted-foreground/60' : ''
                        }`}>
                          {note.note}
                        </p>
                        
                        {/* Image Attachments */}
                        {note.attachments && note.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {note.attachments.map((img: string, idx: number) => (
                              <div
                                key={idx}
                                className="relative group/img"
                                data-testid={`image-attachment-${idx}`}
                              >
                                <img
                                  src={img}
                                  alt={`Attachment ${idx + 1}`}
                                  className="h-20 w-20 object-cover rounded border"
                                />
                                {/* Eye button overlay */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingImages(note.attachments);
                                    setCurrentImageIndex(idx);
                                    setImageViewerOpen(true);
                                  }}
                                  className="absolute inset-0 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                                  data-testid={`button-view-image-${idx}`}
                                >
                                  <Eye className="h-6 w-6 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create/Edit Note Form - Fixed at bottom */}
              <div className="border-t bg-muted/5 px-6 py-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      New note
                    </label>
                    <Textarea
                      placeholder="Type your note here..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      onPaste={async (e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        
                        for (const item of Array.from(items)) {
                          if (item.type.indexOf('image') !== -1) {
                            e.preventDefault();
                            const file = item.getAsFile();
                            if (!file) continue;
                            
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                variant: "destructive",
                                title: "File too large",
                                description: "Image must be less than 5MB",
                              });
                              continue;
                            }
                            
                            setUploadingImages(true);
                            try {
                              const formData = new FormData();
                              formData.append('image', file);
                              
                              const response = await fetch(`/api/policies/${viewingQuote?.id}/notes/upload`, {
                                method: 'POST',
                                body: formData,
                              });
                              
                              if (!response.ok) throw new Error('Upload failed');
                              
                              const data = await response.json();
                              setNoteAttachments(prev => [...prev, data.url]);
                              
                              toast({
                                title: "Image attached",
                                description: "Image uploaded successfully",
                              });
                            } catch (error) {
                              toast({
                                variant: "destructive",
                                title: "Upload failed",
                                description: "Failed to upload image",
                              });
                            } finally {
                              setUploadingImages(false);
                            }
                          }
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const files = e.dataTransfer?.files;
                        if (!files || files.length === 0) return;
                        
                        setUploadingImages(true);
                        try {
                          for (const file of Array.from(files)) {
                            if (!file.type.startsWith('image/')) {
                              toast({
                                variant: "destructive",
                                title: "Invalid file type",
                                description: "Please drop only image files",
                              });
                              continue;
                            }
                            
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                variant: "destructive",
                                title: "File too large",
                                description: `${file.name} is larger than 5MB`,
                              });
                              continue;
                            }
                            
                            const formData = new FormData();
                            formData.append('image', file);
                            
                            const response = await fetch(`/api/policies/${viewingQuote?.id}/notes/upload`, {
                              method: 'POST',
                              body: formData,
                            });
                            
                            if (!response.ok) throw new Error('Upload failed');
                            
                            const data = await response.json();
                            setNoteAttachments(prev => [...prev, data.url]);
                          }
                          
                          toast({
                            title: "Images attached",
                            description: `${files.length} image(s) uploaded successfully`,
                          });
                        } catch (error) {
                          toast({
                            variant: "destructive",
                            title: "Upload failed",
                            description: "Failed to upload one or more images",
                          });
                        } finally {
                          setUploadingImages(false);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      className="min-h-[80px] resize-none text-sm"
                      data-testid="textarea-note"
                    />
                    
                    {/* Image Attachments Preview */}
                    {noteAttachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {noteAttachments.map((img, idx) => (
                          <div
                            key={idx}
                            className="relative group/preview"
                            data-testid={`preview-image-${idx}`}
                          >
                            <img
                              src={img}
                              alt={`Preview ${idx + 1}`}
                              className="h-16 w-16 object-cover rounded border"
                            />
                            {/* Eye button overlay */}
                            <button
                              type="button"
                              onClick={() => {
                                setViewingImages(noteAttachments);
                                setCurrentImageIndex(idx);
                                setImageViewerOpen(true);
                              }}
                              className="absolute inset-0 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity z-10"
                              data-testid={`button-view-preview-${idx}`}
                            >
                              <Eye className="h-5 w-5 text-white" />
                            </button>
                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNoteAttachments(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity z-20"
                              data-testid={`button-remove-image-${idx}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* File Input (Hidden) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        
                        setUploadingImages(true);
                        try {
                          for (const file of Array.from(files)) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                variant: "destructive",
                                title: "File too large",
                                description: `${file.name} is larger than 5MB`,
                              });
                              continue;
                            }
                            
                            const formData = new FormData();
                            formData.append('image', file);
                            
                            const response = await fetch(`/api/policies/${viewingQuote?.id}/notes/upload`, {
                              method: 'POST',
                              body: formData,
                            });
                            
                            if (!response.ok) throw new Error('Upload failed');
                            
                            const data = await response.json();
                            setNoteAttachments(prev => [...prev, data.url]);
                          }
                          
                          toast({
                            title: "Images attached",
                            description: `${files.length} image(s) uploaded successfully`,
                          });
                        } catch (error) {
                          toast({
                            variant: "destructive",
                            title: "Upload failed",
                            description: "Failed to upload one or more images",
                          });
                        } finally {
                          setUploadingImages(false);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }
                      }}
                      data-testid="input-file"
                    />
                    
                    {/* Attachment Button and Important Checkbox */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImages}
                          className="h-8"
                          data-testid="button-attach-image"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          {uploadingImages ? 'Uploading...' : 'Attach Image'}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          or paste/drag images directly (max 5MB each)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="important-note"
                          checked={isImportant}
                          onCheckedChange={(checked) => setIsImportant(!!checked)}
                          data-testid="checkbox-important"
                        />
                        <label
                          htmlFor="important-note"
                          className="text-xs font-medium cursor-pointer select-none"
                        >
                          Mark as Important
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => createNoteMutation.mutate()}
                      disabled={!newNoteText.trim() || createNoteMutation.isPending}
                      className="w-full h-9"
                      variant="secondary"
                      data-testid="button-send-note"
                    >
                      {createNoteMutation.isPending ? 'Creating...' : 'Create Note'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        {/* Delete Note Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="z-[9999]" data-testid="dialog-delete-note">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Note?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this note? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setNoteToDelete(null)} data-testid="button-cancel-delete-note">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!noteToDelete || !viewingQuote?.id) return;
                  try {
                    await apiRequest('DELETE', `/api/policies/${viewingQuote.id}/notes/${noteToDelete}`);
                    queryClient.invalidateQueries({ queryKey: ['/api/policies', viewingQuote.id, 'notes'] });
                    setShowDeleteDialog(false);
                    setNoteToDelete(null);
                    toast({
                      title: "Note deleted",
                      description: "The note has been removed successfully.",
                    });
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to delete note",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-note"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Image Viewer Dialog - Fullscreen */}
        <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen} modal={false}>
          <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/95 border-none z-[100] [&>button[type='button']:first-of-type]:hidden">
            <DialogTitle className="sr-only">Image Viewer</DialogTitle>
            <DialogDescription className="sr-only">Viewing attached image in fullscreen</DialogDescription>
            <button
              onClick={() => setImageViewerOpen(false)}
              className="absolute top-4 right-4 z-[60] rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
              data-testid="button-close-viewer"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            
            {viewingImages.length > 0 && (
              <>
                <div className="flex items-center justify-center h-full p-8">
                  <img
                    src={viewingImages[currentImageIndex]}
                    alt={`Image ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                    data-testid="image-fullscreen"
                  />
                </div>
                
                {viewingImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + viewingImages.length) % viewingImages.length)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 transition-colors"
                      data-testid="button-prev-image"
                    >
                      <ChevronLeftIcon className="h-8 w-8 text-white" />
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % viewingImages.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 transition-colors"
                      data-testid="button-next-image"
                    >
                      <ChevronRightIcon className="h-8 w-8 text-white" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 rounded-full px-4 py-2 text-white text-sm">
                      {currentImageIndex + 1} / {viewingImages.length}
                    </div>
                  </>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>
        {/* Documents Sheet */}
        <Sheet open={documentsSheetOpen} onOpenChange={setDocumentsSheetOpen}>
          <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SheetTitle>Documents</SheetTitle>
                  <Badge variant="secondary" className="text-xs h-5 px-2" data-testid="badge-documents-count">
                    {quoteDocumentsCount}
                  </Badge>
                </div>
              </div>
              <SheetDescription>
                Manage documents for this policy
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-6">
              {/* Upload Section */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setUploadDialogOpen(true)}
                  className="flex-shrink-0"
                  data-testid="button-upload-document"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>

              {/* Search and Category Filter */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search documents..."
                    value={searchDocuments}
                    onChange={(e) => setSearchDocuments(e.target.value)}
                    data-testid="input-search-documents"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="state_id">State ID</SelectItem>
                    <SelectItem value="birth_certificate">Birth Certificate</SelectItem>
                    <SelectItem value="parole">Parole</SelectItem>
                    <SelectItem value="permanent_residence">Permanent Residence</SelectItem>
                    <SelectItem value="work_permit">Work Permit</SelectItem>
                    <SelectItem value="i94">I-94</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Documents Table */}
              {isLoadingDocuments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No documents found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchDocuments || selectedCategory !== 'all' 
                      ? 'Try adjusting your search or filters' 
                      : 'Upload your first document to get started'}
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Document Type</TableHead>
                        <TableHead>Belongs To</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((doc: any) => {
                        const getCategoryLabel = (category: string) => {
                          switch (category) {
                            case 'passport': return 'Passport';
                            case 'drivers_license': return "Driver's License";
                            case 'state_id': return 'State ID';
                            case 'birth_certificate': return 'Birth Certificate';
                            case 'parole': return 'Parole';
                            case 'permanent_residence': return 'Permanent Residence';
                            case 'work_permit': return 'Work Permit';
                            case 'i94': return 'I-94';
                            case 'other': return 'Other';
                            default: return category;
                          }
                        };

                        return (
                          <TableRow key={doc.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button
                                onClick={() => setPreviewDocument(doc)}
                                className="text-sm font-medium hover:underline text-left"
                                data-testid={`button-preview-${doc.id}`}
                              >
                                {getCategoryLabel(doc.category)}
                              </button>
                              <div className="text-xs text-muted-foreground mt-0.5">{doc.fileName}</div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.belongsToMember ? (
                                <>
                                  {doc.belongsToMember.firstName} {doc.belongsToMember.lastName}
                                  <span className="text-xs ml-1">({doc.belongsToMember.role})</span>
                                </>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatFileSize(doc.fileSize || 0)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.uploadedBy?.firstName || 'Unknown'} {doc.uploadedBy?.lastName || ''}
                              <div className="text-xs text-muted-foreground/70">
                                {format(new Date(doc.createdAt), "MMM dd, yyyy • h:mm a")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPreviewDocument(doc)}
                                  data-testid={`button-preview-${doc.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDocumentToDelete(doc.id)}
                                  data-testid={`button-delete-${doc.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        {/* Upload Document Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-[500px]" data-testid="dialog-upload-document">
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document for this policy. Accepted formats: PDF, Images, Word, Excel, PowerPoint (max 10MB)
            </DialogDescription>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const file = formData.get('file') as File;
              const category = formData.get('category') as string;

              if (!file) {
                toast({
                  title: "Error",
                  description: "Please select a file to upload",
                  variant: "destructive",
                });
                return;
              }

              if (!category) {
                toast({
                  title: "Error",
                  description: "Please select a category",
                  variant: "destructive",
                });
                return;
              }

              // Validate file size (10MB max)
              if (file.size > 10 * 1024 * 1024) {
                toast({
                  title: "Error",
                  description: "File size must be less than 10MB",
                  variant: "destructive",
                });
                return;
              }

              // Validate file type
              const allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              ];

              if (!allowedTypes.includes(file.type)) {
                toast({
                  title: "Error",
                  description: "Invalid file type. Please upload a PDF, image, or Office document.",
                  variant: "destructive",
                });
                return;
              }

              setUploadingDocument(true);
              uploadDocumentMutation.mutate(formData, {
                onSettled: () => setUploadingDocument(false),
              });
            }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">File *</label>
                <Input
                  type="file"
                  name="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx,.pptx"
                  required
                  data-testid="input-file"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category *</label>
                <Select name="category" required>
                  <SelectTrigger data-testid="select-upload-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="state_id">State ID</SelectItem>
                    <SelectItem value="birth_certificate">Birth Certificate</SelectItem>
                    <SelectItem value="parole">Parole</SelectItem>
                    <SelectItem value="permanent_residence">Permanent Residence</SelectItem>
                    <SelectItem value="work_permit">Work Permit</SelectItem>
                    <SelectItem value="i94">I-94</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Belongs To (optional)</label>
                <Select name="belongsTo">
                  <SelectTrigger data-testid="select-belongs-to">
                    <SelectValue placeholder="Select family member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(quoteDetail?.members || []).map((item: any) => {
                      const member = item.member || item;
                      return (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName} ({member.role})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (optional)</label>
                <Textarea
                  name="description"
                  placeholder="Add a description..."
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setUploadDialogOpen(false)}
                  disabled={uploadingDocument}
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={uploadingDocument}
                  data-testid="button-confirm-upload"
                >
                  {uploadingDocument ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        {/* Delete Document Confirmation */}
        <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
          <AlertDialogContent className="z-[9999]">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this document? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-document">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (documentToDelete) {
                    deleteDocumentMutation.mutate(documentToDelete);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete-document"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Preview Document Dialog */}
        <Dialog open={!!previewDocument} onOpenChange={(open) => !open && setPreviewDocument(null)}>
          <DialogContent className="max-w-4xl w-full h-[90vh]" data-testid="dialog-preview-document">
            <DialogTitle>{previewDocument?.fileName}</DialogTitle>
            <DialogDescription>
              Document preview
            </DialogDescription>
            <div className="flex-1 overflow-auto">
              {previewDocument && (() => {
                const fileExt = previewDocument.fileName?.split('.').pop()?.toLowerCase();
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt || '');
                const isPdf = fileExt === 'pdf';

                if (isImage) {
                  return (
                    <img
                      src={`/api/policies/${viewingQuote.id}/documents/${previewDocument.id}/download`}
                      alt={previewDocument.fileName}
                      className="max-w-full h-auto"
                      data-testid="preview-image"
                    />
                  );
                } else if (isPdf) {
                  return (
                    <iframe
                      src={`/api/policies/${viewingQuote.id}/documents/${previewDocument.id}/download`}
                      className="w-full h-full border-0"
                      data-testid="preview-pdf"
                    />
                  );
                } else {
                  return (
                    <div className="text-center py-12">
                      <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Preview not available for this file type
                      </p>
                      <Button
                        onClick={() => window.open(`/api/policies/${viewingQuote.id}/documents/${previewDocument.id}/download`, '_blank')}
                        data-testid="button-download-preview"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download File
                      </Button>
                    </div>
                  );
                }
              })()}
            </div>
          </DialogContent>
        </Dialog>
        {/* Reminders Sheet - Professional Corporate Design */}
        <Sheet open={remindersSheetOpen} onOpenChange={setRemindersSheetOpen}>
          <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right" data-testid="sheet-reminders">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SheetTitle>Reminders</SheetTitle>
                  <Badge variant="secondary" className="text-xs h-5 px-2" data-testid="badge-reminders-sheet-count">
                    {quoteReminders.length}
                  </Badge>
                </div>
                <Button
                  onClick={() => {
                    setSelectedReminder(null);
                    setReminderFormOpen(true);
                  }}
                  size="sm"
                  data-testid="button-create-reminder"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Reminder
                </Button>
              </div>
              <SheetDescription>
                Manage reminders for this policy
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-6">
              {/* Filters Section */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search reminders..."
                    value={searchReminders}
                    onChange={(e) => setSearchReminders(e.target.value)}
                    data-testid="input-search-reminders"
                    className="h-9"
                  />
                </div>
                <Select value={filterReminderStatus} onValueChange={setFilterReminderStatus}>
                  <SelectTrigger className="w-full sm:w-[150px] h-9" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="snoozed">Snoozed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterReminderPriority} onValueChange={setFilterReminderPriority}>
                  <SelectTrigger className="w-full sm:w-[150px] h-9" data-testid="select-priority">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reminders Table */}
              {isLoadingReminders ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Loading reminders...</p>
                </div>
              ) : quoteReminders.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No reminders found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchReminders || filterReminderStatus !== 'all' || filterReminderPriority !== 'all'
                      ? 'Try adjusting your filters or search'
                      : 'Create your first reminder to get started'}
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteReminders.map((reminder: QuoteReminder) => {
                        const getPriorityBadgeClasses = (priority: string) => {
                          switch (priority) {
                            case 'urgent':
                              return 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400';
                            case 'high':
                              return 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400';
                            case 'medium':
                              return 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400';
                            case 'low':
                            default:
                              return 'border-gray-500/50 bg-gray-500/10 text-gray-700 dark:text-gray-400';
                          }
                        };

                        const getStatusBadgeClasses = (status: string) => {
                          switch (status) {
                            case 'completed':
                              return 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400';
                            case 'snoozed':
                              return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
                            case 'pending':
                            default:
                              return 'border-gray-500/50 bg-gray-500/10 text-gray-700 dark:text-gray-400';
                          }
                        };

                        const getTypeLabel = (type: string) => {
                          const labels: Record<string, string> = {
                            follow_up: 'Follow Up',
                            document_request: 'Document Request',
                            payment_due: 'Payment Due',
                            policy_renewal: 'Policy Renewal',
                            call_client: 'Call Client',
                            send_email: 'Send Email',
                            review_application: 'Review Application',
                            other: 'Other',
                          };
                          return labels[type] || type;
                        };

                        return (
                          <TableRow key={reminder.id} className="hover:bg-muted/50">
                            <TableCell>
                              <button
                                onClick={() => {
                                  setSelectedReminder(reminder);
                                  setReminderFormOpen(true);
                                }}
                                className="text-sm font-semibold hover:underline text-left"
                                data-testid={`button-view-reminder-${reminder.id}`}
                              >
                                {reminder.title}
                              </button>
                              {reminder.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {reminder.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {getTypeLabel(reminder.reminderType)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-xs h-5 px-2 border ${getPriorityBadgeClasses(reminder.priority)}`}>
                                {reminder.priority.charAt(0).toUpperCase() + reminder.priority.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-xs h-5 px-2 border ${getStatusBadgeClasses(reminder.status)}`}>
                                {reminder.status.charAt(0).toUpperCase() + reminder.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(reminder.dueDate), "MMM dd, yyyy")}
                              {reminder.dueTime && (
                                <div className="text-xs">{reminder.dueTime}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(reminder as any).creator?.firstName ? (
                                <>{(reminder as any).creator.firstName} {(reminder as any).creator.lastName}</>
                              ) : (
                                'Unknown'
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-actions-${reminder.id}`}
                                  >
                                    Actions
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {reminder.status === 'pending' && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => completeReminderMutation.mutate(reminder.id)}
                                        disabled={completeReminderMutation.isPending}
                                        data-testid={`menu-complete-${reminder.id}`}
                                      >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Mark Complete
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSnoozeReminderId(reminder.id);
                                          setSnoozeDialogOpen(true);
                                        }}
                                        data-testid={`menu-snooze-${reminder.id}`}
                                      >
                                        <Clock className="h-4 w-4 mr-2" />
                                        Snooze
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedReminder(reminder);
                                      setReminderFormOpen(true);
                                    }}
                                    data-testid={`menu-edit-${reminder.id}`}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setReminderToDelete(reminder.id)}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`menu-delete-${reminder.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
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
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
        {/* Consents Sheet */}
        <Sheet open={consentsSheetOpen} onOpenChange={(open) => {
          setConsentsSheetOpen(open);
          if (!open) {
            setShowConsentForm(false);
            setViewingConsent(null);
          }
        }}>
          <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right" data-testid="sheet-consents">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(showConsentForm || viewingConsent) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowConsentForm(false);
                        setViewingConsent(null);
                      }}
                      className="mr-2"
                      data-testid="button-back-to-list"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                  <SheetTitle>
                    {viewingConsent ? 'View Consent Document' : showConsentForm ? 'Send Consent Form' : 'Signature Forms'}
                  </SheetTitle>
                  {!showConsentForm && !viewingConsent && (
                    <Badge variant="secondary" className="text-xs h-5 px-2" data-testid="badge-consents-count">
                      {consents.length}
                    </Badge>
                  )}
                </div>
                {/* Action Buttons for Viewing Consent */}
                {viewingConsent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const iframe = document.getElementById('consent-preview-iframe') as HTMLIFrameElement;
                      if (iframe?.contentWindow) {
                        iframe.contentWindow.print();
                      }
                    }}
                    className="mr-8"
                    data-testid="button-print-consent"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print / Save as PDF
                  </Button>
                )}
              </div>
              <SheetDescription>
                {viewingConsent ? 'Preview of the signed consent document' : showConsentForm ? 'Review and send consent document to client' : 'Manage consent documents for this policy'}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-6">
              {viewingConsent ? (
                /* Consent Preview View */
                (<div className="space-y-4">
                  {/* Preview Iframe */}
                  <iframe
                    id="consent-preview-iframe"
                    src={`/consent/${viewingConsent.token}`}
                    className="w-full h-[calc(100vh-200px)] border rounded-lg"
                    title="Consent Document Preview"
                  />
                </div>)
              ) : !showConsentForm ? (
                <>
                  {/* Create Button */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowConsentForm(true)}
                      className="flex-shrink-0"
                      data-testid="button-create-consent"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Send Consent Form
                    </Button>
                  </div>

              {/* Consents List */}
              {isLoadingConsents ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Loading consent documents...</p>
                </div>
              ) : consents.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                  <FileSignature className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No consent documents found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first consent document to get started
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Status</TableHead>
                        <TableHead>Delivery Method</TableHead>
                        <TableHead>Sent To</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Signed</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consents.map((consent: any) => {
                        const getStatusBadgeClasses = (status: string) => {
                          switch (status) {
                            case 'signed':
                              return 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400';
                            case 'viewed':
                              return 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400';
                            case 'sent':
                              return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
                            case 'draft':
                              return 'border-gray-500/50 bg-gray-500/10 text-gray-700 dark:text-gray-400';
                            case 'void':
                              return 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400';
                            default:
                              return 'border-gray-500/50 bg-gray-500/10 text-gray-700 dark:text-gray-400';
                          }
                        };

                        const getDeliveryMethodLabel = (method: string | null) => {
                          if (!method) return '-';
                          switch (method) {
                            case 'email': return 'Email';
                            case 'sms': return 'SMS';
                            case 'link': return 'Link';
                            default: return method;
                          }
                        };

                        return (
                          <TableRow key={consent.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={`text-xs h-5 px-2 ${getStatusBadgeClasses(consent.status)}`}
                              >
                                {consent.status.charAt(0).toUpperCase() + consent.status.slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {getDeliveryMethodLabel(consent.deliveryChannel)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {consent.deliveryTarget || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {consent.createdAt ? formatDateForDisplay(new Date(consent.createdAt).toISOString().split('T')[0], "MMM dd, yyyy") : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {consent.signedAt ? format(new Date(consent.signedAt), "MMM dd, yyyy h:mm a") : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setViewingConsent(consent)}
                                  data-testid={`button-view-consent-${consent.id}`}
                                  title="View consent form"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" data-testid={`menu-consent-${consent.id}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {consent.deliveryChannel === 'link' && consent.status !== 'signed' && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        const url = `${window.location.origin}/consent/${consent.token}`;
                                        navigator.clipboard.writeText(url);
                                        toast({
                                          title: "Link copied",
                                          description: "Consent form link copied to clipboard",
                                        });
                                      }}
                                      data-testid={`menu-copy-link-${consent.id}`}
                                    >
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copy Link
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      window.open(`/consent/${consent.token}`, '_blank');
                                    }}
                                    data-testid={`menu-view-${consent.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Form
                                  </DropdownMenuItem>
                                  {consent.status === 'signed' && (
                                    <DropdownMenuItem
                                      data-testid={`menu-download-${consent.id}`}
                                    >
                                      <Download className="h-4 w-4 mr-2" />
                                      Download Signed
                                    </DropdownMenuItem>
                                  )}
                                  {consent.status !== 'signed' && consent.deliveryChannel && consent.deliveryChannel !== 'link' && (
                                    <DropdownMenuItem
                                      onClick={() => resendConsentMutation.mutate(consent.id)}
                                      disabled={resendConsentMutation.isPending}
                                      data-testid={`menu-resend-${consent.id}`}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      Resend
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => deleteConsentMutation.mutate(consent.id)}
                                    disabled={deleteConsentMutation.isPending}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`menu-delete-${consent.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              </>
              ) : (
                /* Consent Form View */
                (<SendConsentModalContent 
                  quoteId={viewingQuote?.id || ''} 
                  clientEmail={viewingQuote?.clientEmail || ''}
                  clientPhone={viewingQuote?.clientPhone || ''}
                  onClose={() => {
                    setShowConsentForm(false);
                    queryClient.invalidateQueries({ queryKey: ['/api/policies', viewingQuote?.id, 'consents'] });
                  }}
                />)
              )}
            </div>
          </SheetContent>
        </Sheet>
        {/* Create/Edit Reminder Dialog */}
        <Dialog open={reminderFormOpen} onOpenChange={setReminderFormOpen}>
          <DialogContent className="sm:max-w-[600px]" data-testid="dialog-reminder-form">
            <DialogTitle>{selectedReminder ? 'Edit Reminder' : 'Create Reminder'}</DialogTitle>
            <DialogDescription>
              {selectedReminder ? 'Update the reminder details' : 'Create a new reminder for this policy'}
            </DialogDescription>
            <ReminderForm
              reminder={selectedReminder}
              onSubmit={(data) => {
                if (selectedReminder) {
                  updateReminderMutation.mutate({
                    reminderId: selectedReminder.id,
                    data,
                  });
                } else {
                  createReminderMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setReminderFormOpen(false);
                setSelectedReminder(null);
              }}
              isPending={createReminderMutation.isPending || updateReminderMutation.isPending}
            />
          </DialogContent>
        </Dialog>
        {/* Snooze Reminder Dialog */}
        <AlertDialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
          <AlertDialogContent data-testid="dialog-snooze-reminder">
            <AlertDialogHeader>
              <AlertDialogTitle>Snooze Reminder</AlertDialogTitle>
              <AlertDialogDescription>
                Select how long you want to snooze this reminder
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Select value={snoozeDuration} onValueChange={setSnoozeDuration}>
                <SelectTrigger data-testid="select-snooze-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15min">15 minutes</SelectItem>
                  <SelectItem value="30min">30 minutes</SelectItem>
                  <SelectItem value="1hour">1 hour</SelectItem>
                  <SelectItem value="2hours">2 hours</SelectItem>
                  <SelectItem value="1day">1 day</SelectItem>
                  <SelectItem value="2days">2 days</SelectItem>
                  <SelectItem value="1week">1 week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-snooze">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (snoozeReminderId) {
                    snoozeReminderMutation.mutate({
                      reminderId: snoozeReminderId,
                      duration: snoozeDuration,
                    });
                  }
                }}
                disabled={snoozeReminderMutation.isPending}
                data-testid="button-confirm-snooze"
              >
                {snoozeReminderMutation.isPending ? 'Snoozing...' : 'Snooze'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Delete Reminder Confirmation */}
        <AlertDialog open={!!reminderToDelete} onOpenChange={(open) => !open && setReminderToDelete(null)}>
          <AlertDialogContent data-testid="dialog-delete-reminder">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this reminder? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-reminder">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (reminderToDelete) {
                    deleteReminderMutation.mutate(reminderToDelete);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete-reminder"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Manual Plan Dialog - Simplified (Manual Entry Only) */}
        <Dialog open={manualPlanDialogOpen} onOpenChange={(open) => {
          setManualPlanDialogOpen(open);
          if (!open) {
            setSimplePlanFormData({ 
              planId: '', carrier: '', planName: '', metalLevel: '', planType: '',
              monthlyPayment: '', originalPrice: '', marketplaceId: '', memberId: '',
              effectiveDate: '', expirationDate: '' 
            });
            setEditingPlanId(null);
          }
        }}>
          <DialogContent className="max-w-lg" data-testid="dialog-manual-plan">
            <DialogHeader>
              <DialogTitle>{editingPlanId ? 'Edit Plan' : 'Add Plan'}</DialogTitle>
              <DialogDescription>
                {editingPlanId ? 'Update plan information' : 'Enter plan details manually'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Plan Details Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="planId" className="text-sm">Plan ID</Label>
                  <Input
                    id="planId"
                    value={simplePlanFormData.planId}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, planId: e.target.value })}
                    placeholder="e.g., 12345XX1234567"
                    className="mt-1"
                    data-testid="input-plan-id"
                  />
                </div>
                <div>
                  <Label htmlFor="carrier" className="text-sm">Carrier <span className="text-red-500">*</span></Label>
                  <Input
                    id="carrier"
                    value={simplePlanFormData.carrier}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, carrier: e.target.value })}
                    placeholder="e.g., Blue Cross Blue Shield"
                    className="mt-1"
                    data-testid="input-carrier"
                  />
                </div>
                <div>
                  <Label htmlFor="planName" className="text-sm">Plan Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="planName"
                    value={simplePlanFormData.planName}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, planName: e.target.value })}
                    placeholder="e.g., Bronze PPO"
                    className="mt-1"
                    data-testid="input-plan-name"
                  />
                </div>
                <div>
                  <Label htmlFor="metalLevel" className="text-sm">Metal Level</Label>
                  <Select
                    value={simplePlanFormData.metalLevel}
                    onValueChange={(value) => setSimplePlanFormData({ ...simplePlanFormData, metalLevel: value })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-metal-level">
                      <SelectValue placeholder="Select metal level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bronze">Bronze</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                      <SelectItem value="Catastrophic">Catastrophic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="planType" className="text-sm">Plan Type</Label>
                  <Select
                    value={simplePlanFormData.planType}
                    onValueChange={(value) => setSimplePlanFormData({ ...simplePlanFormData, planType: value })}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-plan-type">
                      <SelectValue placeholder="Select plan type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PPO">PPO</SelectItem>
                      <SelectItem value="HMO">HMO</SelectItem>
                      <SelectItem value="EPO">EPO</SelectItem>
                      <SelectItem value="POS">POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="monthlyPayment" className="text-sm">Monthly Payment ($) <span className="text-red-500">*</span></Label>
                  <Input
                    id="monthlyPayment"
                    type="number"
                    step="0.01"
                    min="0"
                    value={simplePlanFormData.monthlyPayment}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, monthlyPayment: e.target.value })}
                    placeholder="0.00"
                    className="mt-1"
                    data-testid="input-monthly-payment"
                  />
                </div>
                <div>
                  <Label htmlFor="originalPrice" className="text-sm">Original Price ($)</Label>
                  <Input
                    id="originalPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={simplePlanFormData.originalPrice}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, originalPrice: e.target.value })}
                    placeholder="0.00"
                    className="mt-1"
                    data-testid="input-original-price"
                  />
                </div>
                <div>
                  <Label htmlFor="marketplaceId" className="text-sm">Marketplace ID</Label>
                  <Input
                    id="marketplaceId"
                    value={simplePlanFormData.marketplaceId}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, marketplaceId: e.target.value })}
                    placeholder="FFM Application ID"
                    className="mt-1"
                    data-testid="input-marketplace-id"
                  />
                </div>
                <div>
                  <Label htmlFor="memberId" className="text-sm">Member ID</Label>
                  <Input
                    id="memberId"
                    value={simplePlanFormData.memberId}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, memberId: e.target.value })}
                    placeholder="Member ID"
                    className="mt-1"
                    data-testid="input-member-id"
                  />
                </div>
                <div>
                  <Label htmlFor="effectiveDate" className="text-sm">Effective Date</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={simplePlanFormData.effectiveDate}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, effectiveDate: e.target.value })}
                    className="mt-1"
                    data-testid="input-effective-date"
                  />
                </div>
                <div>
                  <Label htmlFor="expirationDate" className="text-sm">Expiration Date</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={simplePlanFormData.expirationDate}
                    onChange={(e) => setSimplePlanFormData({ ...simplePlanFormData, expirationDate: e.target.value })}
                    className="mt-1"
                    data-testid="input-expiration-date"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setManualPlanDialogOpen(false)} data-testid="button-cancel-plan">
                Cancel
              </Button>
              <Button
                disabled={!simplePlanFormData.carrier || !simplePlanFormData.planName || !simplePlanFormData.monthlyPayment}
                onClick={async () => {
                  if (!viewingQuote?.id) return;
                  try {
                    const planData = {
                      id: simplePlanFormData.planId || `manual-${Date.now()}`,
                      name: simplePlanFormData.planName,
                      issuer: { name: simplePlanFormData.carrier },
                      metal_level: simplePlanFormData.metalLevel || undefined,
                      type: simplePlanFormData.planType || undefined,
                      premium: parseFloat(simplePlanFormData.originalPrice) || parseFloat(simplePlanFormData.monthlyPayment) || 0,
                      premium_w_credit: parseFloat(simplePlanFormData.monthlyPayment) || 0,
                      marketplaceId: simplePlanFormData.marketplaceId || undefined,
                      memberId: simplePlanFormData.memberId || undefined,
                      effectiveDate: simplePlanFormData.effectiveDate || undefined,
                      expirationDate: simplePlanFormData.expirationDate || undefined,
                    };
                    
                    if (editingPlanId) {
                      // Update existing plan
                      await apiRequest('PATCH', `/api/policies/${viewingQuote.id}/plans/${editingPlanId}`, {
                        source: 'manual',
                        planData: planData,
                      });
                      toast({ title: "Success", description: "Plan has been updated successfully.", duration: 3000 });
                    } else {
                      // Add new plan
                      await apiRequest('POST', `/api/policies/${viewingQuote.id}/plans`, {
                        source: 'manual',
                        planData: planData,
                      });
                      toast({ title: "Success", description: "Plan has been added successfully.", duration: 3000 });
                    }

                    queryClient.invalidateQueries({ queryKey: ['/api/policies'] });
                    
                    setManualPlanDialogOpen(false);
                    setSimplePlanFormData({ 
                      planId: '', carrier: '', planName: '', metalLevel: '', planType: '',
                      monthlyPayment: '', originalPrice: '', marketplaceId: '', memberId: '',
                      effectiveDate: '', expirationDate: '' 
                    });
                    setEditingPlanId(null);
                  } catch (error: any) {
                    toast({ title: "Error", description: error.message || "Failed to save plan.", variant: "destructive", duration: 3000 });
                  }
                }}
                data-testid="button-submit-plan"
              >
                {editingPlanId ? 'Update Plan' : 'Add Plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Cancel Policy Confirmation Dialog */}
        <AlertDialog open={cancelPolicyDialogOpen} onOpenChange={setCancelPolicyDialogOpen}>
          <AlertDialogContent data-testid="dialog-cancel-policy">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Policy?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this policy? This action can be undone by changing the status later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-cancel-policy">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await apiRequest("POST", `/api/policies/${viewingQuote.id}/status`, { status: "canceled" });
                    
                    queryClient.invalidateQueries({ queryKey: ['/api/policies', viewingQuote.id, 'detail'] });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies/stats"] });
                    
                    toast({
                      title: "Policy Canceled",
                      description: "The policy status has been changed to canceled.",
                      duration: 3000,
                    });
                    
                    setCancelPolicyDialogOpen(false);
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to cancel policy",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-cancel-policy"
              >
                Cancel Policy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Archive Policy Confirmation Dialog */}
        <AlertDialog open={archivePolicyDialogOpen} onOpenChange={setArchivePolicyDialogOpen}>
          <AlertDialogContent data-testid="dialog-archive-policy">
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Policy?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to archive this policy? You can unarchive it later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-archive-policy">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await apiRequest("POST", `/api/policies/${viewingQuote.id}/archive`, { isArchived: true });
                    
                    // Invalidate all policies queries (including parameterized ones)
                    queryClient.invalidateQueries({ 
                      predicate: (query) => {
                        const key = query.queryKey;
                        return Array.isArray(key) && key[0] === '/api/policies';
                      }
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies/stats"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies/oep-stats"] });
                    
                    toast({
                      title: "Policy Archived",
                      description: "The policy has been archived successfully.",
                      duration: 3000,
                    });
                    
                    setArchivePolicyDialogOpen(false);
                    
                    // Navigate back to policies list if we're viewing the archived policy
                    setLocation('/customers');
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to archive policy",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-confirm-archive-policy"
              >
                Archive Policy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Duplicate Policy Confirmation Dialog */}
        <AlertDialog open={duplicatePolicyDialogOpen} onOpenChange={setDuplicatePolicyDialogOpen}>
          <AlertDialogContent data-testid="dialog-duplicate-policy">
            <AlertDialogHeader>
              <AlertDialogTitle>Duplicate Policy?</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a new policy with all the information from the current policy, including client details, family members, and selected plan. You will be redirected to the new policy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-duplicate-policy">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    const data = await apiRequest("POST", `/api/policies/${viewingQuote.id}/duplicate`, {});
                    
                    toast({
                      title: "Policy Duplicated",
                      description: data.message || `New policy created with ID: ${data.policy.id}`,
                      duration: 3000,
                    });
                    
                    queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies/stats"] });
                    
                    setDuplicatePolicyDialogOpen(false);
                    
                    // Wait a moment for the database to fully commit before navigating
                    setTimeout(() => {
                      setLocation(`/customers/${data.policy.id}`);
                    }, 300);
                  } catch (error: any) {
                    toast({
                      title: "Duplication Failed",
                      description: error.message || "Failed to duplicate policy",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-confirm-duplicate-policy"
              >
                Duplicate Policy
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Block Policy Confirmation Dialog */}
        <AlertDialog open={blockPolicyDialogOpen} onOpenChange={setBlockPolicyDialogOpen}>
          <AlertDialogContent data-testid="dialog-block-policy">
            <AlertDialogHeader>
              <AlertDialogTitle>Do you really want to block this policy?</AlertDialogTitle>
              <AlertDialogDescription>
                Clicking 'Yes, block it!' will prevent agents to update this policy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-block-policy">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await apiRequest("POST", `/api/policies/${viewingQuote.id}/block`, {});
                    
                    toast({
                      title: "Policy Blocked",
                      description: "The policy has been blocked successfully. Agents cannot update this policy.",
                      duration: 3000,
                    });
                    
                    queryClient.invalidateQueries({ queryKey: ['/api/policies', viewingQuote.id, 'detail'] });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
                    queryClient.invalidateQueries({ queryKey: ["/api/policies/stats"] });
                    
                    setBlockPolicyDialogOpen(false);
                  } catch (error: any) {
                    toast({
                      title: "Block Failed",
                      description: error.message || "Failed to block policy",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-block-policy"
              >
                <Lock className="h-4 w-4 mr-2" />
                Yes, block it!
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Remove Plan Confirmation Dialog */}
        <AlertDialog open={removePlanDialogOpen} onOpenChange={setRemovePlanDialogOpen}>
          <AlertDialogContent data-testid="dialog-remove-plan">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove selected plan?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the currently selected plan from this policy. You can add a new plan afterwards.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-remove-plan">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await apiRequest("PATCH", `/api/policies/${viewingQuote.id}`, {
                      selectedPlan: null
                    });
                    queryClient.invalidateQueries({ queryKey: ['/api/policies', viewingQuote.id, 'detail'] });
                    toast({
                      title: "Plan Removed",
                      description: "The selected plan has been removed from this policy.",
                      duration: 3000,
                    });
                    setRemovePlanDialogOpen(false);
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to remove plan.",
                      variant: "destructive",
                      duration: 3000,
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-remove-plan"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Plan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Combined loading state - wait for both stats and policies to load
  const isLoadingPage = isLoading || isLoadingStats;

  return (
    <div className="h-full flex overflow-hidden">
      {!showWizard ? (
        <>
          {/* Show loading state while either stats or policies are loading */}
          {isLoadingPage ? (
            <div className="flex items-center justify-center h-96 flex-1">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground">Loading policies...</p>
              </div>
            </div>
          ) : (
            <>
              {/* LEFT SIDEBAR */}
              <div className="w-64 flex-shrink-0 h-fit bg-white rounded-[18px] border border-gray-200 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] m-4 mr-0">
                <div className="p-4 space-y-6">
                  {/* Views Section */}
                  <div className="space-y-1">
                    {/* Policies View */}
                    <button
                      onClick={() => {
                        setSelectedView("policies");
                        setOepFilter(null);
                        setSelectedFolderId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedView === "policies" && !selectedFolderId
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid="sidebar-policies"
                    >
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="flex-1 text-left">Policies</span>
                    </button>

                    {/* OEP 2026 ACA/Obamacare View */}
                    <button
                      onClick={() => {
                        setSelectedView("oep-aca");
                        setOepFilter("aca");
                        setSelectedFolderId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedView === "oep-aca"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid="sidebar-oep-aca"
                    >
                      <Info className="w-4 h-4 text-blue-500" />
                      <span className="flex-1 text-left">OEP 2026 ACA/Obamacare</span>
                    </button>

                    {/* OEP 2026 Medicare View */}
                    <button
                      onClick={() => {
                        setSelectedView("oep-medicare");
                        setOepFilter("medicare");
                        setSelectedFolderId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedView === "oep-medicare"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid="sidebar-oep-medicare"
                    >
                      <Info className="w-4 h-4 text-blue-500" />
                      <span className="flex-1 text-left">OEP 2026 Medicare</span>
                    </button>

                    {/* Important View */}
                    <button
                      onClick={() => {
                        setSelectedView("important");
                        setSelectedFolderId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedView === "important"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid="sidebar-important"
                    >
                      <Bell className="w-4 h-4 text-yellow-500" />
                      <span className="flex-1 text-left">Important</span>
                    </button>

                    {/* Archived View */}
                    <button
                      onClick={() => {
                        setSelectedView("archived");
                        setSelectedFolderId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedView === "archived"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid="sidebar-archived"
                    >
                      <Archive className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-left">Archived</span>
                    </button>

                    {/* Exports View */}
                    <button
                      onClick={() => {
                        setSelectedView("exports");
                        setSelectedFolderId(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedView === "exports"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                      data-testid="sidebar-exports"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-left">Exports</span>
                    </button>
                  </div>

                  {/* Agency Folders */}
                  <div className="space-y-1">
                    <button
                      onClick={() => setAgencyFoldersOpen(!agencyFoldersOpen)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${agencyFoldersOpen ? '' : '-rotate-90'}`} />
                      <Building2 className="h-4 w-4" />
                      <span>Agency Folders</span>
                    </button>
                    {agencyFoldersOpen && (
                      <div className="ml-6 space-y-1">
                        {agencyFolders.map((folder) => (
                          <div key={folder.id} className="flex items-center gap-1 group">
                            <Button
                              variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
                              className="flex-1 justify-start"
                              onClick={() => {
                                setSelectedView("policies");
                                setSelectedFolderId(folder.id);
                              }}
                              data-testid={`folder-agency-${folder.id}`}
                            >
                              <FolderIcon className="mr-2 h-4 w-4" />
                              <span>{folder.name}</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFolderToEdit(folder);
                                    setNewFolderName(folder.name);
                                    setRenameFolderDialogOpen(true);
                                  }}
                                  data-testid={`menu-rename-${folder.id}`}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFolderToEdit(folder);
                                    setDeleteFolderDialogOpen(true);
                                  }}
                                  className="text-destructive"
                                  data-testid={`menu-delete-${folder.id}`}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewFolderType('agency');
                            setCreateFolderDialogOpen(true);
                          }}
                          className="mt-1 text-xs w-full justify-start"
                          data-testid="button-create-agency-folder"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          New Agency Folder
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* My Folders */}
                  <div className="space-y-1">
                    <button
                      onClick={() => setMyFoldersOpen(!myFoldersOpen)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${myFoldersOpen ? '' : '-rotate-90'}`} />
                      <User className="h-4 w-4" />
                      <span>My Folders</span>
                    </button>
                    {myFoldersOpen && (
                      <div className="ml-6 space-y-1">
                        {myFolders.map((folder) => (
                          <div key={folder.id} className="flex items-center gap-1 group">
                            <Button
                              variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
                              className="flex-1 justify-start"
                              onClick={() => {
                                setSelectedView("policies");
                                setSelectedFolderId(folder.id);
                              }}
                              data-testid={`folder-personal-${folder.id}`}
                            >
                              <FolderIcon className="mr-2 h-4 w-4" />
                              <span>{folder.name}</span>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFolderToEdit(folder);
                                    setNewFolderName(folder.name);
                                    setRenameFolderDialogOpen(true);
                                  }}
                                  data-testid={`menu-rename-${folder.id}`}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setFolderToEdit(folder);
                                    setDeleteFolderDialogOpen(true);
                                  }}
                                  className="text-destructive"
                                  data-testid={`menu-delete-${folder.id}`}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewFolderType('personal');
                            setCreateFolderDialogOpen(true);
                          }}
                          className="mt-1 text-xs w-full justify-start"
                          data-testid="button-create-personal-folder"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          New Personal Folder
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MAIN CONTENT AREA */}
              <div className="flex-1 overflow-y-auto">
                {/* Statistics Cards - Scrollable (will hide on scroll) */}
                {stats && (
                  <div className="px-6 pt-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Total Policies Card */}
                      <div className="rounded-[18px] border border-gray-200 bg-white shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] px-6 py-5">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Policies</div>
                        <div className="text-xs text-gray-400 mb-2">Number of policies</div>
                        <div className="text-3xl font-bold text-green-600" data-testid="stat-total-policies">{stats.totalPolicies}</div>
                      </div>

                      {/* Total Applicants Card */}
                      <div className="rounded-[18px] border border-gray-200 bg-white shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] px-6 py-5">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Applicants</div>
                        <div className="text-xs text-gray-400 mb-2">Number of applicants</div>
                        <div className="text-3xl font-bold text-green-600" data-testid="stat-total-applicants">{stats.totalApplicants.toLocaleString()}</div>
                      </div>

                      {/* Canceled Policies Card */}
                      <div className="rounded-[18px] border border-gray-200 bg-white shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] px-6 py-5">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Canceled policies</div>
                        <div className="text-xs text-gray-400 mb-2">Canceled policies</div>
                        <div className="text-3xl font-bold text-gray-900" data-testid="stat-canceled-policies">{stats.canceledPolicies}</div>
                      </div>

                      {/* Canceled Applicants Card */}
                      <div className="rounded-[18px] border border-gray-200 bg-white shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] px-6 py-5">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cancelled applicants</div>
                        <div className="text-xs text-gray-400 mb-2">Cancelled applicants</div>
                        <div className="text-3xl font-bold text-gray-900" data-testid="stat-canceled-applicants">{stats.canceledApplicants}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Policies Table */}
                <div className="px-6 pb-4">
                  <div className="bg-white rounded-[18px] border border-gray-200 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] flex flex-col min-h-0" style={{ overflow: 'visible' }}>
            <div className="pt-6 flex flex-col flex-1 min-h-0" style={{ overflow: 'visible' }}>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading policies...</div>
            ) : allQuotes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No policies yet</h3>
                <p className="text-muted-foreground mb-4">Create your first policy to get started</p>
                <Button onClick={() => setLocation("/customers/new")} data-testid="button-create-first-quote">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Policy
                </Button>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                {/* HEADER SECTION - Scrolls away */}
                <div className="px-8 pt-6 pb-4 space-y-4">
                  {/* Title Row and Year Filters */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Policies</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Effective year:</span>
                      {[2026, 2025, 2024].map((year) => (
                        <div key={year} className="flex items-center gap-2">
                          <Checkbox
                            id={`year-${year}`}
                            checked={filters.effectiveYears.includes(year)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilters(prev => ({ ...prev, effectiveYears: [...prev.effectiveYears, year] }));
                              } else {
                                setFilters(prev => ({ ...prev, effectiveYears: prev.effectiveYears.filter(y => y !== year) }));
                              }
                            }}
                            className="h-4 w-4"
                            data-testid={`checkbox-year-${year}`}
                          />
                          <label
                            htmlFor={`year-${year}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {year}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Search and Filter Card */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[18px] shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] p-4 space-y-3">
                    {/* Search Input and Buttons Row */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search clients (filters as you type)..."
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="pl-10"
                          data-testid="input-search-quotes"
                        />
                      </div>
                      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                        <SheetTrigger asChild>
                          <Button 
                            variant="default"
                            size="default"
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            data-testid="button-filters"
                          >
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                            {hasActiveFilters && (
                              <Badge variant="secondary" className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center rounded-full bg-white text-purple-600 text-[10px]">
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
                    
                    {/* Family Members Checkbox */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="search-family-members"
                        checked={filters.searchFamilyMembers}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, searchFamilyMembers: !!checked }))}
                        className="h-4 w-4"
                        data-testid="checkbox-search-family-members"
                      />
                      <label
                        htmlFor="search-family-members"
                        className="text-sm leading-none cursor-pointer flex items-center gap-1.5"
                      >
                        Search by family members:
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">When enabled, search will also include family member names, emails, and phone numbers</p>
                          </TooltipContent>
                        </Tooltip>
                      </label>
                    </div>
                  </div>

                  {/* Pagination and Controls Card */}
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[18px] shadow-[0_12px_24px_-12px_rgba(15,23,42,0.12)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      {/* Show selector */}
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

                      {/* Pagination info and controls */}
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          {totalItems > 0 ? startIndex + 1 : 0}-{endIndex} of {totalItems}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
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
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setCurrentPage(page)}
                              data-testid={`button-page-${page}`}
                            >
                              {page}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRightIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* OEP Filter Buttons - Dynamic year based on renewal period */}
                      {(() => {
                        const now = new Date();
                        const currentMonth = now.getMonth();
                        const currentDay = now.getDate();
                        const currentYear = now.getFullYear();
                        
                        const isInRenewalPeriod = 
                          (currentMonth >= 9) ||
                          (currentMonth === 0) ||
                          (currentMonth === 1 && currentDay === 1);
                        
                        if (!isInRenewalPeriod) return null;
                        
                        const renewalTargetYear = currentMonth >= 9 ? currentYear + 1 : currentYear;
                        
                        return (
                          <div className="flex gap-2">
                            <Button
                              variant={oepFilter === 'aca' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setOepFilter(oepFilter === 'aca' ? null : 'aca')}
                              className={oepFilter === 'aca' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                              data-testid="button-oep-filter-aca"
                            >
                              OEP {renewalTargetYear} ACA
                              {oepStats && oepStats.aca > 0 && (
                                <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-xs">
                                  {oepStats.aca}
                                </Badge>
                              )}
                            </Button>
                            <Button
                              variant={oepFilter === 'medicare' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setOepFilter(oepFilter === 'medicare' ? null : 'medicare')}
                              className={oepFilter === 'medicare' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                              data-testid="button-oep-filter-medicare"
                            >
                              OEP {renewalTargetYear} Medicare
                              {oepStats && oepStats.medicare > 0 && (
                                <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-xs">
                                  {oepStats.medicare}
                                </Badge>
                              )}
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                {/* END HEADER SECTION */}

                {/* Filter Chips Display */}
                {oepFilter && (
                  <div className="px-8 py-3 flex items-center gap-2">
                    {oepFilter === 'aca' && (
                      <Badge 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-normal flex items-center gap-2"
                        data-testid="chip-filter-aca"
                      >
                        Filter: ACA/Obamacare Renewal 2026
                        <button
                          onClick={() => setOepFilter(null)}
                          className="hover:bg-blue-700 rounded-full p-0.5"
                          data-testid="button-remove-filter-aca"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {oepFilter === 'medicare' && (
                      <Badge 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm font-normal flex items-center gap-2"
                        data-testid="chip-filter-medicare"
                      >
                        Filter: Medicare Renewal 2026
                        <button
                          onClick={() => setOepFilter(null)}
                          className="hover:bg-blue-700 rounded-full p-0.5"
                          data-testid="button-remove-filter-medicare"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOepFilter(null)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950 h-7 text-xs"
                      data-testid="button-reset-filters"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Reset filters
                    </Button>
                  </div>
                )}

                {/* Table with Sticky Header */}
                <div className="px-8 pb-6">
                {filteredQuotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedView === 'archived' ? (
                      <div>
                        <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-1">No archived policies</p>
                        <p className="text-sm">Archived policies will appear here</p>
                      </div>
                    ) : selectedView === 'important' ? (
                      <div>
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-1">No important policies</p>
                        <p className="text-sm">Mark policies as important to see them here</p>
                      </div>
                    ) : selectedView === 'exports' ? (
                      <div>
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-1">No policies available</p>
                        <p className="text-sm">Policies ready for export will appear here</p>
                      </div>
                    ) : (
                      "No policies match your search criteria"
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky top-0 z-30 py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
                            <Checkbox 
                              checked={selectedPolicyIds.size === filteredQuotes.length && filteredQuotes.length > 0}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPolicyIds(new Set(filteredQuotes.map(q => q.id)));
                                } else {
                                  setSelectedPolicyIds(new Set());
                                }
                              }}
                              data-testid="checkbox-select-all" 
                            />
                          </TableHead>
                          <TableHead className="sticky top-0 z-30 py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">Agent</TableHead>
                          <TableHead className="sticky top-0 z-30 py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">Client</TableHead>
                          <TableHead className="sticky top-0 z-30 py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">Policy</TableHead>
                          <TableHead className="sticky top-0 z-30 py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">Status</TableHead>
                          <TableHead className="sticky top-0 z-30 text-center py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">Year</TableHead>
                          <TableHead className="sticky top-0 z-30 text-right py-3 px-4 bg-white dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {paginatedQuotes.map((quote) => {
                        const product = PRODUCT_TYPES.find(p => p.id === quote.productType);
                        const agent = agents.find(a => a.id === quote.agentId);
                        const assignedAgent = agents.find(a => a.id === quote.agentId);
                        
                        const formatCurrency = (value: any) => {
                          if (value === null || value === undefined) return 'N/A';
                          const num = typeof value === 'string' ? parseFloat(value) : value;
                          if (isNaN(num)) return 'N/A';
                          if (num === 0) return '$0';
                          return `$${num.toFixed(2)}`;
                        };
                        
                        return (
                          <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                            <TableCell className="py-3 px-4">
                              <Checkbox 
                                checked={selectedPolicyIds.has(quote.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedPolicyIds(prev => {
                                    const newSet = new Set(prev);
                                    if (checked) {
                                      newSet.add(quote.id);
                                    } else {
                                      newSet.delete(quote.id);
                                    }
                                    return newSet;
                                  });
                                }}
                                data-testid={`checkbox-policy-${quote.id}`} 
                              />
                            </TableCell>
                            <TableCell className="text-center py-3 px-4">
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
                            <TableCell className="py-3 px-4">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-pointer">
                                    <div 
                                      className="font-medium text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                      onClick={() => navigateToPolicy(quote.id)}
                                    >
                                      {quote.clientFirstName} {quote.clientMiddleName} {quote.clientLastName} {quote.clientSecondLastName}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                        {quote.clientIsApplicant ? 'Self' : 'Not Applicant'}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">•</span>
                                      <span className="text-xs text-muted-foreground">
                                        {quote.clientGender ? quote.clientGender.charAt(0).toUpperCase() + quote.clientGender.slice(1) : 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                      <MapPin className="h-3 w-3" />
                                      {quote.physical_city}, {quote.physical_state} {quote.physical_postal_code}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={8} align="start" className="p-3">
                                  <div>
                                    <div className="font-semibold text-sm mb-2 text-center">Client information</div>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                      <div className="text-left font-medium">Client:</div>
                                      <div className="text-right">
                                        {quote.clientFirstName} {quote.clientMiddleName} {quote.clientLastName} {quote.clientSecondLastName}
                                      </div>
                                      <div className="text-left font-medium">Date of birth:</div>
                                      <div className="text-right">
                                        {quote.clientDateOfBirth ? formatDateForDisplay(quote.clientDateOfBirth, "MMM dd, yyyy") : 'N/A'}
                                      </div>
                                      <div className="text-left font-medium">Address:</div>
                                      <div className="text-right">
                                        {quote.physical_street || 'N/A'}
                                        <br/>
                                        {quote.physical_city}, {quote.physical_state_abbreviation || quote.physical_state} {quote.physical_postal_code}
                                      </div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="font-semibold text-sm">
                                  {(() => {
                                    const typeMap: Record<string, string> = {
                                      'aca': 'Health Insurance ACA',
                                      'medicare': 'Medicare',
                                      'medicaid': 'Medicaid',
                                      'supplemental': 'Supplemental',
                                      'life': 'Life Insurance',
                                      'dental': 'Dental Insurance',
                                      'vision': 'Vision Insurance',
                                      'private': 'Private Insurance',
                                      'annuities': 'Annuities',
                                      'final_expense': 'Final Expense',
                                      'travel': 'Travel Insurance'
                                    };
                                    const insuranceType = typeMap[quote.productType?.toLowerCase()] || quote.productType;
                                    const carrierName = quote.selectedPlan ? (quote.selectedPlan.issuer?.name || quote.selectedPlan.issuer_name) : null;
                                    
                                    return carrierName ? `${carrierName} ${insuranceType}` : insuranceType;
                                  })()}
                                </div>
                                {quote.selectedPlan ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                        {capitalize(quote.selectedPlan.metal_level) || 'N/A'}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground font-semibold">
                                        {quote.selectedPlan.premium_w_credit !== undefined && quote.selectedPlan.premium_w_credit !== null
                                          ? formatCurrency(quote.selectedPlan.premium_w_credit)
                                          : formatCurrency(quote.selectedPlan.premium)}/mo
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground italic">
                                    No plan selected
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  {formatDateForDisplay(quote.effectiveDate, "MMM dd, yyyy")} • {quote.id.slice(0, 8)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {quote.isBlocked && (
                                    <Lock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500" />
                                  )}
                                  <StatusBadgeEditor
                                    type="policy"
                                    statusType="status"
                                    currentValue={quote.status}
                                    id={quote.id}
                                    allStatuses={{
                                      status: quote.status,
                                      documentsStatus: quote.documentsStatus,
                                      paymentStatus: quote.paymentStatus,
                                    }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Documents: <span className={getDocumentsStatusColor(quote.documentsStatus || '')}>{formatStatusDisplay(quote.documentsStatus)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Payments: <span className={getPaymentStatusColor(quote.paymentStatus || '')}>{formatPaymentStatusDisplay(quote.paymentStatus)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-3 px-4">
                              <div className="inline-flex items-center justify-center border-2 border-foreground px-4 py-1.5 bg-background rounded-sm">
                                <span className="text-2xl font-bold tracking-wide" style={{ fontFamily: 'monospace' }}>
                                  {quote.effectiveDate?.split('-')[0] || new Date().getFullYear()}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-3 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" data-testid={`button-preview-${quote.id}`}>
                                      Preview
                                      <ChevronDown className="h-4 w-4 ml-1" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => navigateToPolicy(quote.id)}>
                                      View Details
                                    </DropdownMenuItem>
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
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    </Table>
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        </div>
                </div>
              </div>
            </>
          )}
        </>
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
                  setLocation("/customers");
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
                        Add your spouse and/or dependents to the policy.
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
                              name={`spouses.${index}.isPrimaryDependent`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-spouse-${index}-dependent`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Dependent
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
                              name={`dependents.${index}.isPrimaryDependent`}
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-dependent-${index}-dependent`}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                                      Dependent
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

                {/* Step 4: Household Income */}
                {currentStep === 4 && (
                  <div className="space-y-6 px-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <DollarSign className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Household Income</h3>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        Please provide income information for each household member. This helps determine eligibility for subsidies and tax credits.
                      </p>

                      {/* Primary Applicant Income */}
                      <Card className="border-l-4 border-l-primary">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {form.watch("clientFirstName") || "Primary Applicant"} {form.watch("clientLastName") || ""}
                            <Badge variant="secondary" className="ml-2">Primary</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name="clientIncomeSource"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Income Source</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-client-income-source">
                                        <SelectValue placeholder="Select income source" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="employment">Employment (W-2)</SelectItem>
                                      <SelectItem value="self-employment">Self-Employment</SelectItem>
                                      <SelectItem value="social-security">Social Security</SelectItem>
                                      <SelectItem value="pension">Pension/Retirement</SelectItem>
                                      <SelectItem value="unemployment">Unemployment Benefits</SelectItem>
                                      <SelectItem value="alimony">Alimony/Child Support</SelectItem>
                                      <SelectItem value="investment">Investment Income</SelectItem>
                                      <SelectItem value="rental">Rental Income</SelectItem>
                                      <SelectItem value="disability">Disability Benefits</SelectItem>
                                      <SelectItem value="no-income">No Income</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="clientIncomeFrequency"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Pay Frequency</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || "annually"}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-client-income-frequency">
                                        <SelectValue placeholder="Select frequency" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="weekly">Weekly</SelectItem>
                                      <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                                      <SelectItem value="monthly">Monthly</SelectItem>
                                      <SelectItem value="annually">Annually</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="clientAnnualIncome"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {form.watch("clientIncomeFrequency") === "weekly" ? "Weekly" : 
                                     form.watch("clientIncomeFrequency") === "biweekly" ? "Bi-Weekly" :
                                     form.watch("clientIncomeFrequency") === "monthly" ? "Monthly" : "Annual"} Income
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                      <Input 
                                        {...field}
                                        type="text"
                                        placeholder="0.00"
                                        className="pl-9"
                                        data-testid="input-client-income"
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/[^0-9.]/g, '');
                                          field.onChange(value);
                                        }}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          {(form.watch("clientIncomeSource") === "employment" || form.watch("clientIncomeSource") === "self-employment") && (
                            <FormField
                              control={form.control}
                              name="clientEmployerName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{form.watch("clientIncomeSource") === "self-employment" ? "Business Name" : "Employer Name"}</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field}
                                      placeholder={form.watch("clientIncomeSource") === "self-employment" ? "Enter business name" : "Enter employer name"}
                                      data-testid="input-client-employer"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </CardContent>
                      </Card>

                      {/* Spouse Income Cards */}
                      {spouseFields.map((spouse, index) => (
                        <Card key={spouse.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Users className="h-5 w-5" />
                              {form.watch(`spouses.${index}.firstName`) || `Spouse ${index + 1}`} {form.watch(`spouses.${index}.lastName`) || ""}
                              <Badge variant="outline" className="ml-2">Spouse</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name={`spouses.${index}.incomeSource` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Income Source</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""}>
                                      <FormControl>
                                        <SelectTrigger data-testid={`select-spouse-income-source-${index}`}>
                                          <SelectValue placeholder="Select income source" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="employment">Employment (W-2)</SelectItem>
                                        <SelectItem value="self-employment">Self-Employment</SelectItem>
                                        <SelectItem value="social-security">Social Security</SelectItem>
                                        <SelectItem value="pension">Pension/Retirement</SelectItem>
                                        <SelectItem value="unemployment">Unemployment Benefits</SelectItem>
                                        <SelectItem value="alimony">Alimony/Child Support</SelectItem>
                                        <SelectItem value="investment">Investment Income</SelectItem>
                                        <SelectItem value="rental">Rental Income</SelectItem>
                                        <SelectItem value="disability">Disability Benefits</SelectItem>
                                        <SelectItem value="no-income">No Income</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`spouses.${index}.incomeFrequency` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Pay Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "annually"}>
                                      <FormControl>
                                        <SelectTrigger data-testid={`select-spouse-income-frequency-${index}`}>
                                          <SelectValue placeholder="Select frequency" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="annually">Annually</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`spouses.${index}.annualIncome` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {form.watch(`spouses.${index}.incomeFrequency`) === "weekly" ? "Weekly" : 
                                       form.watch(`spouses.${index}.incomeFrequency`) === "biweekly" ? "Bi-Weekly" :
                                       form.watch(`spouses.${index}.incomeFrequency`) === "monthly" ? "Monthly" : "Annual"} Income
                                    </FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                          {...field}
                                          type="text"
                                          placeholder="0.00"
                                          className="pl-9"
                                          data-testid={`input-spouse-income-${index}`}
                                          onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9.]/g, '');
                                            field.onChange(value);
                                          }}
                                        />
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            {(form.watch(`spouses.${index}.incomeSource`) === "employment" || form.watch(`spouses.${index}.incomeSource`) === "self-employment") && (
                              <FormField
                                control={form.control}
                                name={`spouses.${index}.employerName` as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{form.watch(`spouses.${index}.incomeSource`) === "self-employment" ? "Business Name" : "Employer Name"}</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field}
                                        placeholder={form.watch(`spouses.${index}.incomeSource`) === "self-employment" ? "Enter business name" : "Enter employer name"}
                                        data-testid={`input-spouse-employer-${index}`}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {/* Dependent Income Cards (for dependents 18+) */}
                      {dependentFields.map((dependent, index) => {
                        const dob = form.watch(`dependents.${index}.dateOfBirth`);
                        const age = dob ? Math.floor((new Date().getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
                        
                        // Only show income fields for dependents 18 or older
                        if (age < 18) return null;
                        
                        return (
                          <Card key={dependent.id} className="border-l-4 border-l-green-500">
                            <CardHeader className="pb-4">
                              <CardTitle className="text-lg flex items-center gap-2">
                                <User className="h-5 w-5" />
                                {form.watch(`dependents.${index}.firstName`) || `Dependent ${index + 1}`} {form.watch(`dependents.${index}.lastName`) || ""}
                                <Badge variant="outline" className="ml-2">Dependent (18+)</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.incomeSource` as any}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Income Source</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value || ""}>
                                        <FormControl>
                                          <SelectTrigger data-testid={`select-dependent-income-source-${index}`}>
                                            <SelectValue placeholder="Select income source" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="employment">Employment (W-2)</SelectItem>
                                          <SelectItem value="self-employment">Self-Employment</SelectItem>
                                          <SelectItem value="social-security">Social Security</SelectItem>
                                          <SelectItem value="pension">Pension/Retirement</SelectItem>
                                          <SelectItem value="unemployment">Unemployment Benefits</SelectItem>
                                          <SelectItem value="alimony">Alimony/Child Support</SelectItem>
                                          <SelectItem value="investment">Investment Income</SelectItem>
                                          <SelectItem value="rental">Rental Income</SelectItem>
                                          <SelectItem value="disability">Disability Benefits</SelectItem>
                                          <SelectItem value="no-income">No Income</SelectItem>
                                          <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.incomeFrequency` as any}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Pay Frequency</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value || "annually"}>
                                        <FormControl>
                                          <SelectTrigger data-testid={`select-dependent-income-frequency-${index}`}>
                                            <SelectValue placeholder="Select frequency" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="weekly">Weekly</SelectItem>
                                          <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                                          <SelectItem value="monthly">Monthly</SelectItem>
                                          <SelectItem value="annually">Annually</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.annualIncome` as any}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        {form.watch(`dependents.${index}.incomeFrequency`) === "weekly" ? "Weekly" : 
                                         form.watch(`dependents.${index}.incomeFrequency`) === "biweekly" ? "Bi-Weekly" :
                                         form.watch(`dependents.${index}.incomeFrequency`) === "monthly" ? "Monthly" : "Annual"} Income
                                      </FormLabel>
                                      <FormControl>
                                        <div className="relative">
                                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                          <Input 
                                            {...field}
                                            type="text"
                                            placeholder="0.00"
                                            className="pl-9"
                                            data-testid={`input-dependent-income-${index}`}
                                            onChange={(e) => {
                                              const value = e.target.value.replace(/[^0-9.]/g, '');
                                              field.onChange(value);
                                            }}
                                          />
                                        </div>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {(form.watch(`dependents.${index}.incomeSource`) === "employment" || form.watch(`dependents.${index}.incomeSource`) === "self-employment") && (
                                <FormField
                                  control={form.control}
                                  name={`dependents.${index}.employerName` as any}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{form.watch(`dependents.${index}.incomeSource`) === "self-employment" ? "Business Name" : "Employer Name"}</FormLabel>
                                      <FormControl>
                                        <Input 
                                          {...field}
                                          placeholder={form.watch(`dependents.${index}.incomeSource`) === "self-employment" ? "Enter business name" : "Enter employer name"}
                                          data-testid={`input-dependent-employer-${index}`}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}

                      {/* No family members message */}
                      {spouseFields.length === 0 && dependentFields.filter((_, index) => {
                        const dob = form.watch(`dependents.${index}.dateOfBirth`);
                        const age = dob ? Math.floor((new Date().getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
                        return age >= 18;
                      }).length === 0 && (
                        <p className="text-sm text-muted-foreground italic">
                          No additional household members with income to report. Only dependents 18 years or older are required to provide income information.
                        </p>
                      )}
                    </div>
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
                  
                  {currentStep < 4 ? (
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
                      {createQuoteMutation.isPending ? 'Creating...' : 'Create Policy'}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
      {/* Edit Member Sheet - Only render when viewingQuote exists */}
      {viewingQuote && (
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
      )}
      {/* Notes Sheet - Modern Design */}
      {console.log('[NOTES SHEET] Rendering, open state:', notesSheetOpen)}
      <Sheet open={notesSheetOpen} onOpenChange={setNotesSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col h-full z-[100]" side="left" data-testid="sheet-notes">
          {/* Header */}
          <div className="px-6 py-4 border-b">
            <SheetTitle className="text-xl font-semibold">Notes</SheetTitle>
            <SheetDescription className="mt-1">Manage internal notes for this quote</SheetDescription>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Add New Note */}
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden bg-card">
                <Textarea
                  placeholder="Type your note here..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="min-h-[150px] resize-none border-0 focus-visible:ring-0 text-sm"
                  data-testid="textarea-note"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="urgent-note"
                  checked={isImportant}
                  onCheckedChange={(checked) => setIsImportant(!!checked)}
                  data-testid="checkbox-urgent"
                />
                <label
                  htmlFor="urgent-note"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Mark as Important
                </label>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Previous Notes ({quoteNotesCount})
                </h3>
              </div>

              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : quoteNotes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                  <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No notes yet</p>
                  <p className="text-xs mt-1">Create your first note above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quoteNotes.map((note: any) => (
                    <div
                      key={note.id}
                      className={`group relative border rounded-lg p-4 hover-elevate transition-all ${
                        note.isImportant ? "border-destructive/50 bg-destructive/5" : "bg-card"
                      }`}
                      data-testid={`note-${note.id}`}
                    >
                      {note.isImportant && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-destructive rounded-l-lg" />
                      )}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {note.isImportant && (
                              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                Important
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.note}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setNoteToDelete(note.id);
                            setShowDeleteDialog(true);
                          }}
                          disabled={deleteNoteMutation.isPending}
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer - Fixed Bottom */}
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNotesSheetOpen(false);
                setNewNoteText("");
                setIsUrgent(false);
              }}
              data-testid="button-close-notes"
            >
              Close
            </Button>
            <Button
              onClick={() => createNoteMutation.mutate()}
              disabled={!newNoteText.trim() || createNoteMutation.isPending}
              data-testid="button-send-note"
            >
              {createNoteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <StickyNote className="h-4 w-4 mr-2" />
                  Send Note
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Delete Note Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        console.log('[ALERT DIALOG] onOpenChange called with:', open);
        setShowDeleteDialog(open);
        if (!open) {
          setNoteToDelete(null);
        }
      }}>
        <AlertDialogContent className="z-[9999]" data-testid="dialog-delete-note">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this note? This action cannot be undone and the note will be lost forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-note">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                console.log('[CONFIRM DELETE] Clicked, noteToDelete:', noteToDelete);
                if (noteToDelete) {
                  console.log('[CONFIRM DELETE] Calling mutation with:', noteToDelete);
                  deleteNoteMutation.mutate(noteToDelete);
                } else {
                  console.error('[CONFIRM DELETE] noteToDelete is null/undefined!');
                }
              }}
              disabled={deleteNoteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-note"
            >
              {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      {/* Image Viewer Modal */}
      <Dialog modal={false} open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-5xl w-full p-0 bg-black/95 border-0" data-testid="dialog-image-viewer">
          <div className="relative flex items-center justify-center min-h-[500px] max-h-[90vh]">
            {/* Close Button */}
            <button
              onClick={() => setImageViewerOpen(false)}
              className="absolute top-4 right-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
              data-testid="button-close-viewer"
            >
              <X className="h-5 w-5" />
            </button>
            
            {/* Image */}
            {viewingImages.length > 0 && (
              <img
                src={viewingImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                className="max-w-full max-h-[85vh] object-contain"
                data-testid="viewer-image"
              />
            )}
            
            {/* Navigation Buttons - Only show if multiple images */}
            {viewingImages.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : viewingImages.length - 1))}
                  className="absolute left-4 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 transition-colors disabled:opacity-30"
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex(prev => (prev < viewingImages.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 transition-colors disabled:opacity-30"
                  data-testid="button-next-image"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                
                {/* Image Counter */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                  {currentImageIndex + 1} / {viewingImages.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Send Consent Modal */}
      <Dialog open={consentModalOpen} onOpenChange={setConsentModalOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-send-consent">
          <DialogHeader>
            <DialogTitle>Send Consent Form</DialogTitle>
            <DialogDescription>
              Choose how to send the consent form to {viewingQuote?.clientFirstName}
            </DialogDescription>
          </DialogHeader>
          
          <SendConsentModalContent 
            quoteId={viewingQuote?.id || ''} 
            clientEmail={viewingQuote?.clientEmail || ''}
            clientPhone={viewingQuote?.clientPhone || ''}
            onClose={() => setConsentModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
      {/* OEP 2026 Renewal Comparison Modal */}
      {renewalData && (
        <PolicyRenewalComparison
          open={showComparisonModal}
          onOpenChange={setShowComparisonModal}
          originalPolicy={renewalData.originalPolicy}
          renewedPolicy={renewalData.renewedPolicy}
          plan2025={renewalData.plan2025}
          plans2026={renewalData.plans2026 || []}
          onRenewalComplete={(renewedPolicyId) => {
            setLocation(`/customers/${renewedPolicyId}`);
          }}
        />
      )}
      {/* Bulk Actions Toolbar */}
      {selectedPolicyIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg border-2">
            <CardContent className="p-4 flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedPolicyIds.size} {selectedPolicyIds.size === 1 ? 'policy' : 'policies'} selected
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" data-testid="button-move-to-folder">
                    <FolderIcon className="mr-2 h-4 w-4" />
                    Move to Folder
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  <div className="p-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Agency Folders</div>
                    {agencyFolders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => handleBulkMove(folder.id, folder.name)}
                        data-testid={`menu-move-to-agency-${folder.id}`}
                      >
                        <FolderIcon className="mr-2 h-4 w-4" />
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <div className="text-xs font-medium text-muted-foreground mb-2">My Folders</div>
                    {myFolders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => handleBulkMove(folder.id, folder.name)}
                        data-testid={`menu-move-to-personal-${folder.id}`}
                      >
                        <FolderIcon className="mr-2 h-4 w-4" />
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkMove(null)}
                data-testid="button-clear-folder"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Folder
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPolicyIds(new Set())}
                data-testid="button-cancel-selection"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Create Folder Dialog */}
      <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
        <DialogContent data-testid="dialog-create-folder">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder to organize your policies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name..."
                data-testid="input-folder-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Folder Type</Label>
              <RadioGroup value={newFolderType} onValueChange={(v: 'agency' | 'personal') => setNewFolderType(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="agency" id="type-agency" data-testid="radio-agency" />
                  <Label htmlFor="type-agency" className="font-normal">Agency Folder (Shared with all team members)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="type-personal" data-testid="radio-personal" />
                  <Label htmlFor="type-personal" className="font-normal">Personal Folder (Private to you)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderDialogOpen(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate()}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent data-testid="dialog-rename-folder">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for "{folderToEdit?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="new-folder-name">New Folder Name</Label>
              <Input
                id="new-folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter new folder name..."
                data-testid="input-new-folder-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)} data-testid="button-cancel-rename">
              Cancel
            </Button>
            <Button
              onClick={() => renameFolderMutation.mutate()}
              disabled={!newFolderName.trim() || renameFolderMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Folder Dialog */}
      <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-folder">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{folderToEdit?.name}"? Policies in this folder will be moved to "Unassigned". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFolderMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteFolderMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// StatusBadgeEditor Component - Inline clickable badge editor
function StatusBadgeEditor({
  type,
  statusType,
  currentValue,
  id,
  allStatuses,
}: {
  type: "quote" | "policy";
  statusType: "status" | "documentsStatus" | "paymentStatus";
  currentValue: string;
  id: string;
  allStatuses: {
    status: string;
    documentsStatus: string;
    paymentStatus: string;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const endpoint = type === "quote" 
        ? `/api/quotes/${id}/statuses` 
        : `/api/policies/${id}/statuses`;
      
      // Only send the field being edited, not all fields
      const data: any = {};
      if (statusType === "status") {
        data.status = newValue;
      } else if (statusType === "documentsStatus") {
        data.documentsStatus = newValue;
      } else if (statusType === "paymentStatus") {
        data.paymentStatus = newValue;
      }
      
      return await apiRequest("PATCH", endpoint, data);
    },
    onMutate: async (newValue) => {
      // OPTIMISTIC UPDATE: Change UI immediately before server responds
      const listQueryKey = type === "quote" ? ["/api/quotes"] : ["/api/policies"];
      const detailQueryKey = type === "quote" 
        ? ["/api/quotes", id]
        : ["/api/policies", id, "detail"];
      
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: detailQueryKey });
      
      // Snapshot previous values for rollback
      const previousList = queryClient.getQueryData(listQueryKey);
      const previousDetail = queryClient.getQueryData(detailQueryKey);
      
      // 1. Optimistically update the LIST query (main table/cards)
      queryClient.setQueryData(listQueryKey, (old: any) => {
        if (!old) return old;
        
        const itemsKey = type === "quote" ? "quotes" : "policies";
        const items = old[itemsKey];
        if (!Array.isArray(items)) return old;
        
        return {
          ...old,
          [itemsKey]: items.map((item: any) => 
            item.id === id 
              ? { ...item, [statusType]: newValue }
              : item
          )
        };
      });
      
      // 2. Optimistically update the DETAIL query (sidebar/detail view)
      queryClient.setQueryData(detailQueryKey, (old: any) => {
        if (!old) return old;
        
        const target = type === "quote" ? old.quote : old.policy;
        if (!target) return old;
        
        return {
          ...old,
          [type === "quote" ? "quote" : "policy"]: {
            ...target,
            [statusType]: newValue
          }
        };
      });
      
      // Close dropdown immediately for instant UX
      setIsOpen(false);
      
      return { previousList, previousDetail };
    },
    onSuccess: () => {
      // Background refresh (no blocking wait)
      if (type === "quote") {
        queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/policies"], exact: false });
      }
      
      toast({
        title: "Success",
        description: "Status updated successfully",
        duration: 3000,
      });
    },
    onError: (error: Error, newValue, context: any) => {
      // Rollback BOTH queries on error
      const listQueryKey = type === "quote" ? ["/api/quotes"] : ["/api/policies"];
      const detailQueryKey = type === "quote" 
        ? ["/api/quotes", id]
        : ["/api/policies", id, "detail"];
      
      if (context?.previousList) {
        queryClient.setQueryData(listQueryKey, context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(detailQueryKey, context.previousDetail);
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
        duration: 3000,
      });
    },
    onSettled: () => {
      // After mutation completes (success or error), resync with server to catch derived fields
      const detailQueryKey = type === "quote" 
        ? ["/api/quotes", id]
        : ["/api/policies", id, "detail"];
      
      queryClient.invalidateQueries({ queryKey: detailQueryKey });
    },
  });

  let options: { value: string; label: string }[] = [];
  let getVariant: (value: string) => any;
  let formatDisplay: (value: string) => string;

  if (statusType === "status") {
    options = type === "quote" ? quoteStatusOptions : policyStatusOptions;
    getVariant = getStatusVariant;
    formatDisplay = formatStatusDisplay;
  } else if (statusType === "documentsStatus") {
    options = documentsStatusOptions;
    getVariant = getDocumentsStatusVariant;
    formatDisplay = formatStatusDisplay;
  } else {
    options = paymentStatusOptions;
    getVariant = getPaymentStatusVariant;
    formatDisplay = formatPaymentStatusDisplay;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="cursor-pointer"
          data-testid={`badge-editor-${statusType}-${currentValue}`}
        >
          <Badge variant={getVariant(currentValue)}>
            {formatDisplay(currentValue)}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              if (option.value !== currentValue) {
                updateMutation.mutate(option.value);
              } else {
                setIsOpen(false);
              }
            }}
            disabled={updateMutation.isPending}
            className={option.value === currentValue ? "bg-muted" : ""}
            data-testid={`option-${statusType}-${option.value}`}
          >
            <Badge variant={getVariant(option.value)} className="mr-2">
              {option.label}
            </Badge>
            {option.value === currentValue && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Legacy component (not used anymore but keeping for compatibility)
function StatusEditorDialogContent({ 
  type, 
  id, 
  currentStatus, 
  currentDocumentsStatus, 
  currentPaymentStatus, 
  onClose 
}: {
  type: "quote" | "policy";
  id: string;
  currentStatus: string;
  currentDocumentsStatus: string;
  currentPaymentStatus: string;
  onClose: () => void;
}) {
  const form = useForm<StatusFormValues>({
    resolver: zodResolver(statusFormSchema),
    defaultValues: {
      status: currentStatus || "",
      documentsStatus: currentDocumentsStatus || "",
      paymentStatus: currentPaymentStatus || "",
    },
  });

  const updateMutation = useUpdateStatuses(type, id);

  const onSubmit = (data: StatusFormValues) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const statusOptions = type === "quote" ? quoteStatusOptions : policyStatusOptions;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Status Field */}
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{type === "quote" ? "Quote" : "Policy"} status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Documents Status Field */}
        <FormField
          control={form.control}
          name="documentsStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Documents status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-documents-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {documentsStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Payment Status Field */}
        <FormField
          control={form.control}
          name="paymentStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-payment-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {paymentStatusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="button-cancel-status"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-submit-status"
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// SendConsentModal Component
function SendConsentModalContent({ quoteId, clientEmail, clientPhone, onClose }: { 
  quoteId: string; 
  clientEmail: string;
  clientPhone: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<'email' | 'sms' | 'link'>('email');
  const [target, setTarget] = useState(clientEmail || '');
  const [sending, setSending] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Fetch user data for agent info
  const { data: userData } = useQuery<{ user: UserType }>({
    queryKey: ["/api/session"],
  });

  // Fetch company data
  const { data: companyData } = useQuery<{ company: any }>({
    ...getCompanyQueryOptions(userData?.user?.companyId),
  });

  // Fetch quote data
  const { data: quoteData } = useQuery<{ quote: any }>({
    queryKey: ["/api/policies", quoteId, "detail"],
    enabled: !!quoteId,
  });

  const user = userData?.user;
  const company = companyData?.company;
  const quote = quoteData?.quote;

  useEffect(() => {
    if (channel === 'email') {
      setTarget(clientEmail || '');
    } else if (channel === 'sms') {
      setTarget(clientPhone || '');
    } else {
      setTarget('');
    }
  }, [channel, clientEmail, clientPhone]);

  const handleSend = async () => {
    try {
      setSending(true);
      
      // First generate the consent document
      const generateResponse = await fetch(`/api/policies/${quoteId}/consents/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!generateResponse.ok) {
        throw new Error('Failed to generate consent document');
      }
      
      const { consent } = await generateResponse.json();
      
      // Then send it via the selected channel
      const sendResponse = await fetch(`/api/policy-consents/${consent.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          channel,
          target: channel === 'link' ? undefined : target,
        }),
      });
      
      if (!sendResponse.ok) {
        throw new Error('Failed to send consent');
      }
      
      const result = await sendResponse.json();
      
      if (channel === 'link') {
        setGeneratedUrl(result.url);
        toast({
          title: "Link Generated",
          description: "Copy the link below to share with the client",
        });
      } else {
        toast({
          title: "Consent Sent",
          description: `Consent form sent successfully via ${channel}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/policies', quoteId, 'consents'] });
        setTimeout(() => onClose(), 1500);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send consent",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // If link was generated, show it
  if (generatedUrl) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Consent Link:</p>
          <div className="flex items-center gap-2">
            <Input 
              value={generatedUrl} 
              readOnly 
              className="flex-1"
              data-testid="input-consent-url"
            />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(generatedUrl);
                toast({ description: "Link copied to clipboard" });
                setTimeout(() => toast({ description: "" }), 3000);
              }}
              variant="outline"
              size="sm"
              data-testid="button-copy-url"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button onClick={onClose} className="w-full" data-testid="button-close-consent">
          Close
        </Button>
      </div>
    );
  }

  // Client name
  const clientName = quote ? `${quote.clientFirstName || ''} ${quote.clientLastName || ''}`.trim() : 'Client';

  return (
    <div className="space-y-4">
      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
        </TabsList>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <div className="border rounded-lg p-6 bg-white dark:bg-gray-900 max-h-[calc(100vh-250px)] overflow-y-auto">
            {/* Company Header */}
            <div className="text-center mb-8 pb-6 border-b">
              {company?.logo ? (
                <img 
                  src={company.logo} 
                  alt={company.name} 
                  className="h-16 mx-auto mb-4 object-contain"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {company?.name || 'Insurance Company'}
                </h2>
              )}
              
              {/* Full Address */}
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-3 space-y-1">
                {company?.address && (
                  <p>
                    {company.address}
                    {company.addressLine2 && `, ${company.addressLine2}`}
                  </p>
                )}
                {(company?.city || company?.state || company?.postalCode) && (
                  <p>
                    {[company.city, company.state, company.postalCode].filter(Boolean).join(', ')}
                    {company?.country && company.country !== 'United States' && `, ${company.country}`}
                  </p>
                )}
                
                {/* Contact Information */}
                <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                  {company?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {company.phone}
                    </span>
                  )}
                  {company?.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {company.email}
                    </span>
                  )}
                  {company?.website && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {company.website}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Document Title */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
                {user?.preferredLanguage === 'es' 
                  ? 'CONSENTIMIENTO LEGAL EN PLENO USO DE MIS FACULTADES'
                  : 'LEGAL CONSENT IN FULL USE OF MY FACULTIES'
                }
              </h3>
            </div>

            {/* Consent Text - Spanish Version */}
            {user?.preferredLanguage === 'es' ? (
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  Yo, <strong className="text-gray-900 dark:text-gray-100">{clientName}</strong>, en la fecha de hoy <strong className="text-gray-900 dark:text-gray-100">{new Date().toLocaleDateString()}</strong>, doy mi permiso a
                </p>

                <p className="text-center font-semibold text-gray-900 dark:text-gray-100">
                  {user ? `${user.firstName} ${user.lastName}` : 'Agent Name'} NPN: {user?.nationalProducerNumber || 'N/A'}
                </p>

                <p>
                  Agentes(s) de <strong className="text-gray-900 dark:text-gray-100">{company?.name || 'Company Name'}</strong> que van hacer las licencias reponsable por este cliente y actuar como agente o corredor de seguros médicos para mí y para todo mi hogar, si corresponde, para fines de inscripción en un Plan de salud calificado ofrecido en el Mercado facilitado a nivel federal.
                </p>

                <p>
                  Al dar mi consentimiento a este acuerdo, autorizo al Agente mencionado anteriormente a ver y utilizar la información confidencial proporcionada por mí por escrito, electrónicamente o por teléfono solo para los fines de uno o más de los siguientes:
                </p>

                <ul className="list-disc pl-6 space-y-2">
                  <li>Buscar una aplicación de Marketplace existente;</li>
                  <li>Completar una solicitud de elegibilidad e inscripción en un Plan de Salud Calificado del Mercado u otro programas gubernamentales de asequibilidad de seguros, como Medicaid y CHIP; o</li>
                  <li>Créditos fiscales anticipados para ayudar pagar las primas del Mercado;</li>
                  <li>Proporcionar mantenimiento continuo de la cuenta y asistencia para la inscripción, según sea necesario; o</li>
                  <li>Responder a consultas del Mercado sobre mi solicitud del Mercado.</li>
                </ul>

                <p>
                  Confirmo que la información que proporciono para ingresar en mi solicitud de inscripción y elegibilidad del Mercado será verdadera a mi leal saber y entender.
                </p>

                <p>
                  Entiendo que no tengo que compartir información personal adicional sobre mí o mi salud con mi Agente más allá de lo requerido en la solicitud para fines de elegibilidad e inscripción.
                </p>

                <p>
                  Entiendo que mi consentimiento permanece vigente hasta que lo revoque, y puedo revocar o modificar mi consentimiento en cualquier momento comunicandoselo a <strong className="text-gray-900 dark:text-gray-100">{company?.name || 'Company Name'}</strong> o cualquiera de sus agentes.
                </p>

                <div className="mt-6 pt-4">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{clientName}</p>
                  <p className="text-gray-600 dark:text-gray-400">{quote?.clientPhone || ''}</p>
                </div>
              </div>
            ) : (
              /* Consent Text - English Version */
              (<div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  I, <strong className="text-gray-900 dark:text-gray-100">{clientName}</strong>, on this day <strong className="text-gray-900 dark:text-gray-100">{new Date().toLocaleDateString()}</strong>, give my permission to
                </p>
                <p className="text-center font-semibold text-gray-900 dark:text-gray-100">
                  {user ? `${user.firstName} ${user.lastName}` : 'Agent Name'} NPN: {user?.nationalProducerNumber || 'N/A'}
                </p>
                <p>
                  Agent(s) of <strong className="text-gray-900 dark:text-gray-100">{company?.name || 'Company Name'}</strong> who will be the licensed responsible agent for this client and act as an agent or health insurance broker for me and my entire household, if applicable, for purposes of enrollment in a Qualified Health Plan offered on the Federally-facilitated Marketplace.
                </p>
                <p>
                  By giving my consent to this agreement, I authorize the Agent mentioned above to view and use confidential information provided by me in writing, electronically, or by phone only for the purposes of one or more of the following:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Search for an existing Marketplace application;</li>
                  <li>Complete an eligibility and enrollment application for a Marketplace Qualified Health Plan or other government insurance affordability programs, such as Medicaid and CHIP; or</li>
                  <li>Advance premium tax credits to help pay for Marketplace premiums;</li>
                  <li>Provide ongoing account maintenance and enrollment assistance, as needed; or</li>
                  <li>Respond to Marketplace inquiries about my Marketplace application.</li>
                </ul>
                <p>
                  I confirm that the information I provide to enter into my Marketplace enrollment and eligibility application will be true to the best of my knowledge and belief.
                </p>
                <p>
                  I understand that I do not have to share additional personal information about myself or my health with my Agent beyond what is required in the application for eligibility and enrollment purposes.
                </p>
                <p>
                  I understand that my consent remains in effect until I revoke it, and I can revoke or modify my consent at any time by communicating it to <strong className="text-gray-900 dark:text-gray-100">{company?.name || 'Company Name'}</strong> or any of its agents.
                </p>
                <div className="mt-6 pt-4">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{clientName}</p>
                  <p className="text-gray-600 dark:text-gray-400">{quote?.clientPhone || ''}</p>
                </div>
              </div>)
            )}

            {/* Signature Line (Preview) */}
            <div className="mt-8 pt-6 border-t">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="border-b border-gray-400 pb-1 mb-2 h-8"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Beneficiary Signature</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 pb-1 mb-2 h-8"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send" className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold mb-3 block">Delivery Method</Label>
              <RadioGroup value={channel} onValueChange={(v) => setChannel(v as any)}>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="email" id="email" data-testid="radio-email" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="email" className="font-medium cursor-pointer">Email</Label>
                      <p className="text-sm text-muted-foreground">Send consent form via email for electronic signature</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="sms" id="sms" data-testid="radio-sms" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="sms" className="font-medium cursor-pointer">SMS</Label>
                      <p className="text-sm text-muted-foreground">Send consent link via text message</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="link" id="link" data-testid="radio-link" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="link" className="font-medium cursor-pointer">Generate Link</Label>
                      <p className="text-sm text-muted-foreground">Create a shareable link to send manually</p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {(channel === 'email' || channel === 'sms') && (
              <div>
                <Label htmlFor="target" className="text-base font-semibold mb-2 block">
                  {channel === 'email' ? 'Email Address' : 'Phone Number'}
                </Label>
                <Input
                  id="target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={channel === 'email' ? 'client@example.com' : '(555) 123-4567'}
                  data-testid="input-target"
                  className="text-base"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {channel === 'email' 
                    ? 'Client will receive an email with a link to sign the consent form'
                    : 'Client will receive a text message with a link to sign the consent form'
                  }
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={onClose} 
                variant="outline" 
                className="flex-1"
                data-testid="button-cancel-consent"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSend} 
                disabled={sending || (channel !== 'link' && !target.trim())}
                className="flex-1"
                data-testid="button-send-consent"
              >
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {channel === 'link' ? 'Generate Link' : `Send via ${channel === 'email' ? 'Email' : 'SMS'}`}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
