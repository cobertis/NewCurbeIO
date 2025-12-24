import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Building2, Bell, Shield, Mail, Pencil, Phone as PhoneIcon, AtSign, Briefcase, MapPin, Globe, ChevronsUpDown, Check, Search, Filter, Trash2, Eye, EyeOff, MessageSquare, LogIn, CheckCircle, AlertTriangle, AlertCircle, Info, X, Upload, Power, Calendar, Users, Settings as SettingsIcon, Plus, Activity, ChevronLeft, ChevronRight, Zap, Smile, MessageCircle, Copy, Phone, Wifi, WifiOff, RefreshCw } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { insertUserSchema, type User, type CompanySettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmailTemplatesManager } from "@/components/email-templates-manager";
import { formatForDisplay, formatE164, formatPhoneInput } from "@shared/phone";
import { GooglePlacesAddressAutocomplete } from "@/components/google-places-address-autocomplete";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { useTabsState } from "@/hooks/use-tabs-state";
import { useMemo } from "react";
import { webPhone, useWebPhoneStore } from "@/services/webphone";

// Business categories
const categories = [
  "Arts & Recreation",
  "Automotive",
  "Beauty & Fashion",
  "Business Coaching and Consulting",
  "Creative",
  "Financial",
  "Government & Public Services",
  "Health & Wellness",
  "Home Services",
  "Legal & Insurance",
  "Marketing Agency",
  "Medical",
  "Real Estate",
  "Restaurant and Bar",
  "Retail & Manufacturing",
  "Travel & Hospitality",
  "Other",
];

// Business niches
const niches = [
  // Arts & Recreation
  { value: "Sports Training", label: "Sports Training", category: "Arts & Recreation" },
  { value: "Golf Course", label: "Golf Course", category: "Arts & Recreation" },
  { value: "Bowling Alley", label: "Bowling Alley", category: "Arts & Recreation" },
  { value: "Skating Rink", label: "Skating Rink", category: "Arts & Recreation" },
  { value: "Climbing Gym", label: "Climbing Gym", category: "Arts & Recreation" },
  { value: "Trampoline Park", label: "Trampoline Park", category: "Arts & Recreation" },
  { value: "Escape Room", label: "Escape Room", category: "Arts & Recreation" },
  { value: "Arcade", label: "Arcade", category: "Arts & Recreation" },
  { value: "Paintball", label: "Paintball", category: "Arts & Recreation" },
  { value: "Laser Tag", label: "Laser Tag", category: "Arts & Recreation" },
  { value: "Music Education", label: "Music Education", category: "Arts & Recreation" },
  { value: "Art Education", label: "Art Education", category: "Arts & Recreation" },
  { value: "Dance Studio", label: "Dance Studio", category: "Arts & Recreation" },
  { value: "Martial Arts", label: "Martial Arts", category: "Arts & Recreation" },
  { value: "Fine Arts", label: "Fine Arts", category: "Arts & Recreation" },
  { value: "Pottery & Ceramics", label: "Pottery & Ceramics", category: "Arts & Recreation" },
  { value: "Woodworking", label: "Woodworking", category: "Arts & Recreation" },
  { value: "Metalworking", label: "Metalworking", category: "Arts & Recreation" },
  
  // Automotive
  { value: "Auto Repair", label: "Auto Repair", category: "Automotive" },
  { value: "Auto Body Shop", label: "Auto Body Shop", category: "Automotive" },
  { value: "Auto Detailing", label: "Auto Detailing", category: "Automotive" },
  { value: "Car Dealership", label: "Car Dealership", category: "Automotive" },
  { value: "Car Rental", label: "Car Rental", category: "Automotive" },
  { value: "Tire Shop", label: "Tire Shop", category: "Automotive" },
  { value: "Oil Change", label: "Oil Change", category: "Automotive" },
  { value: "Car Wash", label: "Car Wash", category: "Automotive" },
  { value: "Towing Services", label: "Towing Services", category: "Automotive" },
  { value: "Auto Parts Sales", label: "Auto Parts Sales", category: "Automotive" },
  { value: "Automotive Parts Manufacturing", label: "Automotive Parts Manufacturing", category: "Automotive" },
  
  // Beauty & Fashion
  { value: "Hair Salon", label: "Hair Salon", category: "Beauty & Fashion" },
  { value: "Barbershop", label: "Barbershop", category: "Beauty & Fashion" },
  { value: "Nail Salon", label: "Nail Salon", category: "Beauty & Fashion" },
  { value: "Spa Services", label: "Spa Services", category: "Beauty & Fashion" },
  { value: "Massage Therapy", label: "Massage Therapy", category: "Beauty & Fashion" },
  { value: "Skincare Services", label: "Skincare Services", category: "Beauty & Fashion" },
  { value: "Makeup Artist", label: "Makeup Artist", category: "Beauty & Fashion" },
  { value: "Cosmetics Retail", label: "Cosmetics Retail", category: "Beauty & Fashion" },
  { value: "Tattoo & Piercing", label: "Tattoo & Piercing", category: "Beauty & Fashion" },
  { value: "Tanning Salon", label: "Tanning Salon", category: "Beauty & Fashion" },
  { value: "Fashion & Apparel", label: "Fashion & Apparel", category: "Beauty & Fashion" },
  { value: "Jewelry & Accessories", label: "Jewelry & Accessories", category: "Beauty & Fashion" },
  
  // Business Coaching and Consulting
  { value: "Business Coaching", label: "Business Coaching", category: "Business Coaching and Consulting" },
  { value: "Life Coaching", label: "Life Coaching", category: "Business Coaching and Consulting" },
  { value: "Career Counseling", label: "Career Counseling", category: "Business Coaching and Consulting" },
  { value: "Consulting", label: "Consulting", category: "Business Coaching and Consulting" },
  { value: "IT Consulting", label: "IT Consulting", category: "Business Coaching and Consulting" },
  { value: "HR Consulting", label: "HR Consulting", category: "Business Coaching and Consulting" },
  { value: "Compliance Consulting", label: "Compliance Consulting", category: "Business Coaching and Consulting" },
  { value: "Energy Consulting", label: "Energy Consulting", category: "Business Coaching and Consulting" },
  { value: "Environmental Consulting", label: "Environmental Consulting", category: "Business Coaching and Consulting" },
  { value: "Farm Consulting", label: "Farm Consulting", category: "Business Coaching and Consulting" },
  
  // Creative
  { value: "Graphic Design", label: "Graphic Design", category: "Creative" },
  { value: "UI/UX Design", label: "UI/UX Design", category: "Creative" },
  { value: "Photography", label: "Photography", category: "Creative" },
  { value: "Video Production", label: "Video Production", category: "Creative" },
  { value: "Music Production", label: "Music Production", category: "Creative" },
  { value: "Film Production", label: "Film Production", category: "Creative" },
  { value: "Animation Studio", label: "Animation Studio", category: "Creative" },
  { value: "Publishing", label: "Publishing", category: "Creative" },
  { value: "Copywriting", label: "Copywriting", category: "Creative" },
  { value: "Content Marketing", label: "Content Marketing", category: "Creative" },
  { value: "Podcasting", label: "Podcasting", category: "Creative" },
  { value: "Web Development", label: "Web Development", category: "Creative" },
  { value: "Mobile App Development", label: "Mobile App Development", category: "Creative" },
  { value: "Game Development", label: "Game Development", category: "Creative" },
  
  // Financial
  { value: "Investment Banking", label: "Investment Banking", category: "Financial" },
  { value: "Wealth Management", label: "Wealth Management", category: "Financial" },
  { value: "Financial Planning", label: "Financial Planning", category: "Financial" },
  { value: "Accounting Services", label: "Accounting Services", category: "Financial" },
  { value: "Tax Preparation", label: "Tax Preparation", category: "Financial" },
  { value: "Bookkeeping", label: "Bookkeeping", category: "Financial" },
  { value: "Payroll Services", label: "Payroll Services", category: "Financial" },
  { value: "Mortgage Lending", label: "Mortgage Lending", category: "Financial" },
  { value: "Credit Unions", label: "Credit Unions", category: "Financial" },
  { value: "Payment Processing", label: "Payment Processing", category: "Financial" },
  { value: "Cryptocurrency Exchange", label: "Cryptocurrency Exchange", category: "Financial" },
  
  // Government & Public Services
  { value: "Municipal Services", label: "Municipal Services", category: "Government & Public Services" },
  { value: "Public Safety", label: "Public Safety", category: "Government & Public Services" },
  { value: "Education Administration", label: "Education Administration", category: "Government & Public Services" },
  { value: "Public Health", label: "Public Health", category: "Government & Public Services" },
  { value: "Social Services", label: "Social Services", category: "Government & Public Services" },
  { value: "Community Development", label: "Community Development", category: "Government & Public Services" },
  
  // Health & Wellness
  { value: "Gym & Fitness Center", label: "Gym & Fitness Center", category: "Health & Wellness" },
  { value: "Yoga Studio", label: "Yoga Studio", category: "Health & Wellness" },
  { value: "Pilates Studio", label: "Pilates Studio", category: "Health & Wellness" },
  { value: "Personal Training", label: "Personal Training", category: "Health & Wellness" },
  { value: "CrossFit", label: "CrossFit", category: "Health & Wellness" },
  { value: "Nutrition Coaching", label: "Nutrition Coaching", category: "Health & Wellness" },
  { value: "Wellness Coaching", label: "Wellness Coaching", category: "Health & Wellness" },
  { value: "Meditation Center", label: "Meditation Center", category: "Health & Wellness" },
  { value: "Alternative Medicine", label: "Alternative Medicine", category: "Health & Wellness" },
  { value: "Mental Health Counseling", label: "Mental Health Counseling", category: "Health & Wellness" },
  
  // Home Services
  { value: "General Contracting", label: "General Contracting", category: "Home Services" },
  { value: "Electrical", label: "Electrical", category: "Home Services" },
  { value: "Plumbing", label: "Plumbing", category: "Home Services" },
  { value: "HVAC", label: "HVAC", category: "Home Services" },
  { value: "Roofing", label: "Roofing", category: "Home Services" },
  { value: "Carpentry", label: "Carpentry", category: "Home Services" },
  { value: "Painting", label: "Painting", category: "Home Services" },
  { value: "Flooring", label: "Flooring", category: "Home Services" },
  { value: "Landscaping", label: "Landscaping", category: "Home Services" },
  { value: "Lawn Care", label: "Lawn Care", category: "Home Services" },
  { value: "Tree Services", label: "Tree Services", category: "Home Services" },
  { value: "Pest Control", label: "Pest Control", category: "Home Services" },
  { value: "Cleaning Services", label: "Cleaning Services", category: "Home Services" },
  { value: "Window Cleaning", label: "Window Cleaning", category: "Home Services" },
  { value: "Pool Installation", label: "Pool Installation", category: "Home Services" },
  { value: "Interior Design", label: "Interior Design", category: "Home Services" },
  { value: "Home Staging", label: "Home Staging", category: "Home Services" },
  
  // Legal & Insurance
  { value: "Law Firm", label: "Law Firm", category: "Legal & Insurance" },
  { value: "Corporate Law", label: "Corporate Law", category: "Legal & Insurance" },
  { value: "Family Law", label: "Family Law", category: "Legal & Insurance" },
  { value: "Criminal Defense", label: "Criminal Defense", category: "Legal & Insurance" },
  { value: "Immigration Law", label: "Immigration Law", category: "Legal & Insurance" },
  { value: "Intellectual Property", label: "Intellectual Property", category: "Legal & Insurance" },
  { value: "Real Estate Law", label: "Real Estate Law", category: "Legal & Insurance" },
  { value: "Tax Law", label: "Tax Law", category: "Legal & Insurance" },
  { value: "Employment Law", label: "Employment Law", category: "Legal & Insurance" },
  { value: "Notary Services", label: "Notary Services", category: "Legal & Insurance" },
  { value: "Mediation Services", label: "Mediation Services", category: "Legal & Insurance" },
  { value: "Life Insurance", label: "Life Insurance", category: "Legal & Insurance" },
  { value: "Health Insurance", label: "Health Insurance", category: "Legal & Insurance" },
  { value: "Auto Insurance", label: "Auto Insurance", category: "Legal & Insurance" },
  { value: "Home Insurance", label: "Home Insurance", category: "Legal & Insurance" },
  { value: "Business Insurance", label: "Business Insurance", category: "Legal & Insurance" },
  { value: "Disability Insurance", label: "Disability Insurance", category: "Legal & Insurance" },
  { value: "Long-term Care Insurance", label: "Long-term Care Insurance", category: "Legal & Insurance" },
  { value: "Medicare/Medicaid", label: "Medicare/Medicaid", category: "Legal & Insurance" },
  { value: "ACA Marketplace Plans", label: "ACA Marketplace Plans", category: "Legal & Insurance" },
  
  // Marketing Agency
  { value: "Digital Marketing", label: "Digital Marketing", category: "Marketing Agency" },
  { value: "SEO Services", label: "SEO Services", category: "Marketing Agency" },
  { value: "Social Media Marketing", label: "Social Media Marketing", category: "Marketing Agency" },
  { value: "Email Marketing", label: "Email Marketing", category: "Marketing Agency" },
  { value: "PPC Advertising", label: "PPC Advertising", category: "Marketing Agency" },
  { value: "Brand Strategy", label: "Brand Strategy", category: "Marketing Agency" },
  { value: "Video Marketing", label: "Video Marketing", category: "Marketing Agency" },
  { value: "Influencer Marketing", label: "Influencer Marketing", category: "Marketing Agency" },
  { value: "Market Research", label: "Market Research", category: "Marketing Agency" },
  { value: "Public Relations", label: "Public Relations", category: "Marketing Agency" },
  
  // Medical
  { value: "General Practice", label: "General Practice", category: "Medical" },
  { value: "Dentistry", label: "Dentistry", category: "Medical" },
  { value: "Cardiology", label: "Cardiology", category: "Medical" },
  { value: "Dermatology", label: "Dermatology", category: "Medical" },
  { value: "Pediatrics", label: "Pediatrics", category: "Medical" },
  { value: "Orthopedics", label: "Orthopedics", category: "Medical" },
  { value: "Physical Therapy", label: "Physical Therapy", category: "Medical" },
  { value: "Chiropractic Care", label: "Chiropractic Care", category: "Medical" },
  { value: "Nursing Services", label: "Nursing Services", category: "Medical" },
  { value: "Home Healthcare", label: "Home Healthcare", category: "Medical" },
  { value: "Medical Imaging", label: "Medical Imaging", category: "Medical" },
  { value: "Laboratory Services", label: "Laboratory Services", category: "Medical" },
  { value: "Pharmacy", label: "Pharmacy", category: "Medical" },
  { value: "Optometry", label: "Optometry", category: "Medical" },
  { value: "Audiology", label: "Audiology", category: "Medical" },
  { value: "Urgent Care", label: "Urgent Care", category: "Medical" },
  { value: "Hospice Care", label: "Hospice Care", category: "Medical" },
  { value: "Veterinary Clinic", label: "Veterinary Clinic", category: "Medical" },
  { value: "Pet Grooming", label: "Pet Grooming", category: "Medical" },
  
  // Real Estate
  { value: "Residential Real Estate", label: "Residential Real Estate", category: "Real Estate" },
  { value: "Commercial Real Estate", label: "Commercial Real Estate", category: "Real Estate" },
  { value: "Property Management", label: "Property Management", category: "Real Estate" },
  { value: "Real Estate Investment", label: "Real Estate Investment", category: "Real Estate" },
  { value: "Real Estate Development", label: "Real Estate Development", category: "Real Estate" },
  { value: "Vacation Rentals", label: "Vacation Rentals", category: "Real Estate" },
  { value: "Property Appraisal", label: "Property Appraisal", category: "Real Estate" },
  { value: "Title Services", label: "Title Services", category: "Real Estate" },
  { value: "Home Inspection", label: "Home Inspection", category: "Real Estate" },
  { value: "Real Estate Photography", label: "Real Estate Photography", category: "Real Estate" },
  { value: "REITs", label: "REITs", category: "Real Estate" },
  
  // Restaurant and Bar
  { value: "Restaurant", label: "Restaurant", category: "Restaurant and Bar" },
  { value: "Fast Food", label: "Fast Food", category: "Restaurant and Bar" },
  { value: "Cafe & Coffee Shop", label: "Cafe & Coffee Shop", category: "Restaurant and Bar" },
  { value: "Bakery", label: "Bakery", category: "Restaurant and Bar" },
  { value: "Catering", label: "Catering", category: "Restaurant and Bar" },
  { value: "Food Truck", label: "Food Truck", category: "Restaurant and Bar" },
  { value: "Bar & Nightclub", label: "Bar & Nightclub", category: "Restaurant and Bar" },
  { value: "Brewery & Distillery", label: "Brewery & Distillery", category: "Restaurant and Bar" },
  { value: "Wine Production", label: "Wine Production", category: "Restaurant and Bar" },
  { value: "Meal Prep Services", label: "Meal Prep Services", category: "Restaurant and Bar" },
  { value: "Ghost Kitchen", label: "Ghost Kitchen", category: "Restaurant and Bar" },
  { value: "Ice Cream Shop", label: "Ice Cream Shop", category: "Restaurant and Bar" },
  { value: "Juice Bar", label: "Juice Bar", category: "Restaurant and Bar" },
  
  // Retail & Manufacturing
  { value: "Online Marketplace", label: "Online Marketplace", category: "Retail & Manufacturing" },
  { value: "Electronics Retail", label: "Electronics Retail", category: "Retail & Manufacturing" },
  { value: "Furniture & Home Decor", label: "Furniture & Home Decor", category: "Retail & Manufacturing" },
  { value: "Sporting Goods", label: "Sporting Goods", category: "Retail & Manufacturing" },
  { value: "Books & Media", label: "Books & Media", category: "Retail & Manufacturing" },
  { value: "Toys & Games", label: "Toys & Games", category: "Retail & Manufacturing" },
  { value: "Health & Beauty Products", label: "Health & Beauty Products", category: "Retail & Manufacturing" },
  { value: "Grocery & Food Delivery", label: "Grocery & Food Delivery", category: "Retail & Manufacturing" },
  { value: "Subscription Boxes", label: "Subscription Boxes", category: "Retail & Manufacturing" },
  { value: "Dropshipping", label: "Dropshipping", category: "Retail & Manufacturing" },
  { value: "Print on Demand", label: "Print on Demand", category: "Retail & Manufacturing" },
  { value: "Handmade & Crafts", label: "Handmade & Crafts", category: "Retail & Manufacturing" },
  { value: "Electronics Manufacturing", label: "Electronics Manufacturing", category: "Retail & Manufacturing" },
  { value: "Textile Manufacturing", label: "Textile Manufacturing", category: "Retail & Manufacturing" },
  { value: "Pharmaceutical Manufacturing", label: "Pharmaceutical Manufacturing", category: "Retail & Manufacturing" },
  { value: "Chemical Manufacturing", label: "Chemical Manufacturing", category: "Retail & Manufacturing" },
  { value: "Plastics Manufacturing", label: "Plastics Manufacturing", category: "Retail & Manufacturing" },
  { value: "Metal Fabrication", label: "Metal Fabrication", category: "Retail & Manufacturing" },
  { value: "3D Printing", label: "3D Printing", category: "Retail & Manufacturing" },
  { value: "Packaging Production", label: "Packaging Production", category: "Retail & Manufacturing" },
  { value: "Custom Manufacturing", label: "Custom Manufacturing", category: "Retail & Manufacturing" },
  
  // Travel & Hospitality
  { value: "Hotel", label: "Hotel", category: "Travel & Hospitality" },
  { value: "Motel", label: "Motel", category: "Travel & Hospitality" },
  { value: "Bed & Breakfast", label: "Bed & Breakfast", category: "Travel & Hospitality" },
  { value: "Resort", label: "Resort", category: "Travel & Hospitality" },
  { value: "Travel Agency", label: "Travel Agency", category: "Travel & Hospitality" },
  { value: "Tour Operator", label: "Tour Operator", category: "Travel & Hospitality" },
  { value: "Cruise Line", label: "Cruise Line", category: "Travel & Hospitality" },
  { value: "Event Venue", label: "Event Venue", category: "Travel & Hospitality" },
  { value: "Wedding Venue", label: "Wedding Venue", category: "Travel & Hospitality" },
  { value: "Conference Center", label: "Conference Center", category: "Travel & Hospitality" },
  
  // Other
  { value: "Virtual Assistant", label: "Virtual Assistant", category: "Other" },
  { value: "Transcription Services", label: "Transcription Services", category: "Other" },
  { value: "Translation Services", label: "Translation Services", category: "Other" },
  { value: "Grant Writing", label: "Grant Writing", category: "Other" },
  { value: "Resume Writing", label: "Resume Writing", category: "Other" },
  { value: "Business Plan Writing", label: "Business Plan Writing", category: "Other" },
  { value: "Recruitment Agency", label: "Recruitment Agency", category: "Other" },
  { value: "Staffing Services", label: "Staffing Services", category: "Other" },
  { value: "Payroll Management", label: "Payroll Management", category: "Other" },
  { value: "Employee Training", label: "Employee Training", category: "Other" },
  { value: "SaaS Development", label: "SaaS Development", category: "Other" },
  { value: "Cloud Computing", label: "Cloud Computing", category: "Other" },
  { value: "Data Analytics", label: "Data Analytics", category: "Other" },
  { value: "Cybersecurity", label: "Cybersecurity", category: "Other" },
  { value: "Blockchain Development", label: "Blockchain Development", category: "Other" },
  { value: "Online Learning Platforms", label: "Online Learning Platforms", category: "Other" },
  { value: "Corporate Training", label: "Corporate Training", category: "Other" },
  { value: "Tutoring Services", label: "Tutoring Services", category: "Other" },
  { value: "Freight Shipping", label: "Freight Shipping", category: "Other" },
  { value: "Warehousing", label: "Warehousing", category: "Other" },
  { value: "Moving Services", label: "Moving Services", category: "Other" },
  { value: "Courier Services", label: "Courier Services", category: "Other" },
  { value: "Charity Organization", label: "Charity Organization", category: "Other" },
  { value: "Religious Organization", label: "Religious Organization", category: "Other" },
  { value: "Homeless Services", label: "Homeless Services", category: "Other" },
  { value: "Youth Programs", label: "Youth Programs", category: "Other" },
  { value: "Telecommunications", label: "Telecommunications", category: "Other" },
  { value: "Security Services", label: "Security Services", category: "Other" },
  { value: "Event Planning", label: "Event Planning", category: "Other" },
  { value: "Other Service", label: "Other Service", category: "Other" },
];

interface SettingsProps {
  view?: 'profile' | 'company' | 'all';
}

export default function Settings({ view = 'all' }: SettingsProps) {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // OPTIMIZATION: Determine active tab from URL FIRST (before queries)
  // This allows us to guard queries with `enabled` based on which tab is active
  const getCurrentTab = () => {
    if (location === "/settings/automations") return "automations";
    if (location === "/settings" || location === "/settings/profile" || location === "/settings/overview" || location === "/settings/company") return "overview";
    if (location === "/settings/security") return "security";
    if (location === "/settings/notifications") return "notifications";
    if (location === "/settings/team") return "team";
    if (location === "/settings/webphone") return "webphone";
    return "overview"; // default
  };
  const currentTab = getCurrentTab();
  
  // ESSENTIAL: Always fetch session and preferences (needed for initial render)
  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: preferencesData, isLoading: isLoadingPreferences } = useQuery<{ preferences: any }>({
    queryKey: ["/api/settings/preferences"],
  });

  // OPTIMIZATION: Only fetch company settings when on overview tab
  const { data: companySettingsData, isLoading: isLoadingCompanySettings } = useQuery<{ settings: CompanySettings }>({
    queryKey: ["/api/settings/company"],
    enabled: (userData?.user?.role === "admin" || userData?.user?.role === "superadmin") && currentTab === "overview",
  });

  // OPTIMIZATION: Only fetch notifications when on notifications tab
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/notifications"],
    enabled: currentTab === "notifications",
  });

  // OPTIMIZATION: Only fetch sessions when on security tab, with conditional polling
  const { data: sessionsData, isLoading: isLoadingSessions } = useQuery<{ sessions: Array<{
    id: string;
    isCurrent: boolean;
    lastActive: string;
    expiresAt: string;
    deviceInfo: string;
    ipAddress: string;
  }> }>({
    queryKey: ["/api/user/sessions"],
    enabled: currentTab === "security",
    refetchInterval: currentTab === "security" ? 30000 : false,
  });

  const [emailTestAddress, setEmailTestAddress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  
  // Company Information refs
  const companyNameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const businessCategoryRef = useRef<HTMLInputElement>(null);
  const businessNicheRef = useRef<HTMLInputElement>(null);
  const companyEmailRef = useRef<HTMLInputElement>(null);
  const companyPhoneRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const platformLanguageRef = useRef<HTMLInputElement>(null);
  
  // Physical Address refs
  const addressRef = useRef<HTMLInputElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const postalCodeRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  
  
  // Combobox state
  const [openCategory, setOpenCategory] = useState(false);
  const [openNiche, setOpenNiche] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedNiche, setSelectedNiche] = useState("");
  
  // Timezone state
  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Notifications state
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<string>("all");
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);
  
  // Track which company section is currently saving
  const [savingSection, setSavingSection] = useState<string | null>(null);
  
  // iMessage webhook settings state
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  
  // Address autocomplete state
  const [addressValue, setAddressValue] = useState("");
  const [companyPhoneValue, setCompanyPhoneValue] = useState("");
  const [cityValue, setCityValue] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [postalCodeValue, setPostalCodeValue] = useState("");
  const [websiteValue, setWebsiteValue] = useState("");
  
  const user = userData?.user;

  // OPTIMIZATION: Only fetch company data when on overview tab
  const { data: companyData, isLoading: isLoadingCompany, isError: isCompanyError } = useQuery<{ company: any }>({
    queryKey: ["/api/companies", user?.companyId],
    queryFn: async () => {
      if (!user?.companyId) throw new Error("No company ID");
      const response = await fetch(`/api/companies/${user.companyId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch company: ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }
      return response.json();
    },
    enabled: !!user?.companyId && currentTab === "overview",
    retry: false,
  });

  // OPTIMIZATION: Only fetch subscription data when on overview tab (admin only)
  const { data: subscriptionData } = useQuery<{ subscription: any }>({
    queryKey: ['/api/billing/subscription'],
    enabled: !!user?.companyId && (user?.role === "admin" || user?.role === "superadmin") && currentTab === "overview",
  });

  // OPTIMIZATION: Only fetch user limits when on team or overview tab
  const { data: userLimitsData } = useQuery<{ 
    maxUsers: number | null;
    currentUsers: number;
    canAddUsers: boolean;
    planName: string | null;
  }>({
    queryKey: ["/api/users/limits"],
    enabled: !!user?.companyId && (currentTab === "team" || currentTab === "overview"),
  });

  // Get plan name from either subscription (admin) or limits (agents)
  const planName = subscriptionData?.subscription?.plan?.name || userLimitsData?.planName || null;
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  

  // OPTIMIZATION: Only fetch custom domain status when on overview tab (admin only)
  const { data: customDomainData, isLoading: isLoadingCustomDomain, refetch: refetchCustomDomain } = useQuery<{
    configured: boolean;
    domain: string | null;
    status: string | null;
    sslStatus?: string;
    error?: string;
    cnameInstructions?: {
      host: string;
      value: string;
      type: string;
    };
  }>({
    queryKey: ['/api/organization/domain'],
    enabled: isAdmin && !!user?.companyId && currentTab === "overview",
  });

  // Custom domain state
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [showDomainInstructions, setShowDomainInstructions] = useState(false);

  // Connect custom domain mutation
  const connectDomainMutation = useMutation({
    mutationFn: async (hostname: string) => {
      return await apiRequest('POST', '/api/organization/domain', { hostname });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Domain Connected",
        description: data.message || "Please add the CNAME record to your DNS.",
      });
      setCustomDomainInput("");
      setShowDomainInstructions(true);
      queryClient.invalidateQueries({ queryKey: ['/api/organization/domain'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Disconnect custom domain mutation
  const disconnectDomainMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/organization/domain');
    },
    onSuccess: () => {
      toast({
        title: "Domain Disconnected",
        description: "Custom domain has been removed.",
      });
      setShowDomainInstructions(false);
      queryClient.invalidateQueries({ queryKey: ['/api/organization/domain'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Refresh domain status mutation
  const refreshDomainMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/organization/domain/refresh');
    },
    onSuccess: () => {
      toast({
        title: "Status Refreshed",
        description: "Domain validation status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/organization/domain'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // OPTIMIZATION: Only poll domain status when on overview tab AND domain needs validation
  useEffect(() => {
    // Only poll if we're on overview tab
    if (currentTab !== "overview") return;
    // Only poll if domain is configured but not yet active
    if (!customDomainData?.configured) return;
    if (customDomainData.status === "active") return;
    
    const intervalId = setInterval(() => {
      refetchCustomDomain();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [currentTab, customDomainData?.configured, customDomainData?.status, refetchCustomDomain]);

  // SIMPLIFIED: Only block on truly critical data (user session and preferences)
  // Company data loads asynchronously and sections show their own loading states
  const isLoadingCriticalData = isLoadingUser || isLoadingPreferences;

  // Calculate available tabs based on user role
  const availableTabs = useMemo(() => {
    const baseTabs = ["overview", "security", "notifications", "automations", "webphone"];
    if (isAdmin) {
      return ["overview", "team", "security", "notifications", "automations", "webphone"];
    }
    return baseTabs;
  }, [isAdmin]);

  const [activeTab, setActiveTab] = useTabsState(availableTabs, getCurrentTab());

  // Profile form state (personal information only)
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    preferredLanguage: "",
  });

  // Insurance profile form state (separate from personal info)
  const [insuranceForm, setInsuranceForm] = useState({
    agentInternalCode: "",
    instructionLevel: "",
    nationalProducerNumber: "",
    federallyFacilitatedMarketplace: "",
    referredBy: "",
  });

  // Update forms when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone ? formatForDisplay(user.phone) : "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
        preferredLanguage: user.preferredLanguage || "en",
      });
      setInsuranceForm({
        agentInternalCode: (user as any).agentInternalCode || "",
        instructionLevel: (user as any).instructionLevel || "",
        nationalProducerNumber: (user as any).nationalProducerNumber || "",
        federallyFacilitatedMarketplace: (user as any).federallyFacilitatedMarketplace || "",
        referredBy: (user as any).referredBy || "",
      });
    }
  }, [user]);

  // Initialize combobox values from company data
  useEffect(() => {
    if (companyData?.company) {
      setSelectedCategory((companyData.company as any).businessCategory || "");
      setSelectedNiche((companyData.company as any).businessNiche || "");
      setAddressValue(companyData.company.address || "");
      setCompanyPhoneValue(companyData.company.phone ? formatPhoneInput(companyData.company.phone) : "");
      setCityValue(companyData.company.city || "");
      setStateValue(companyData.company.state || "");
      setPostalCodeValue(companyData.company.postalCode || "");
      setWebsiteValue(companyData.company.website || "");
    }
  }, [companyData]);

  // Initialize timezone from user data (not company data)
  useEffect(() => {
    setSelectedTimezone(user?.timezone || "");
  }, [user?.timezone]);

  // Update current time every second for timezone display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update profile info mutation (personal information)
  const updateProfileInfoMutation = useMutation({
    mutationFn: async (data: { 
      firstName?: string; 
      lastName?: string; 
      email?: string; 
      phone?: string; 
      dateOfBirth?: string; 
      preferredLanguage?: string;
    }) => {
      // Only send fields that have actual values
      const dataToSend: any = {};
      
      if (data.firstName && data.firstName !== "") {
        dataToSend.firstName = data.firstName;
      }
      if (data.lastName && data.lastName !== "") {
        dataToSend.lastName = data.lastName;
      }
      if (data.email && data.email !== "") {
        dataToSend.email = data.email;
      }
      if (data.phone && data.phone !== "") {
        dataToSend.phone = formatE164(data.phone);
      }
      if (data.dateOfBirth && data.dateOfBirth !== "") {
        dataToSend.dateOfBirth = new Date(data.dateOfBirth).toISOString();
      }
      if (data.preferredLanguage && data.preferredLanguage !== "") {
        dataToSend.preferredLanguage = data.preferredLanguage;
      }
      
      // Ensure at least one field has a value
      if (Object.keys(dataToSend).length === 0) {
        throw new Error("Please fill in at least one field before saving");
      }
      
      return apiRequest("PATCH", "/api/settings/profile", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile information.",
        variant: "destructive",
      });
    },
  });

  // Update insurance profile mutation
  const updateInsuranceProfileMutation = useMutation({
    mutationFn: async (data: { 
      agentInternalCode?: string;
      instructionLevel?: string;
      nationalProducerNumber?: string;
      federallyFacilitatedMarketplace?: string;
      referredBy?: string;
    }) => {
      // Only send fields that have actual values (not empty strings)
      const dataToSend: any = {};
      if (data.agentInternalCode !== undefined && data.agentInternalCode !== "") {
        dataToSend.agentInternalCode = data.agentInternalCode;
      }
      if (data.instructionLevel !== undefined && data.instructionLevel !== "") {
        dataToSend.instructionLevel = data.instructionLevel;
      }
      if (data.nationalProducerNumber !== undefined && data.nationalProducerNumber !== "") {
        dataToSend.nationalProducerNumber = data.nationalProducerNumber;
      }
      if (data.federallyFacilitatedMarketplace !== undefined && data.federallyFacilitatedMarketplace !== "") {
        dataToSend.federallyFacilitatedMarketplace = data.federallyFacilitatedMarketplace;
      }
      if (data.referredBy !== undefined && data.referredBy !== "") {
        dataToSend.referredBy = data.referredBy;
      }
      
      // Ensure at least one field has a value
      if (Object.keys(dataToSend).length === 0) {
        throw new Error("Please fill in at least one field before saving");
      }
      
      return apiRequest("PATCH", "/api/settings/profile", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Insurance Profile Updated",
        description: "Your insurance profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update insurance profile.",
        variant: "destructive",
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/settings/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Preferences Updated",
        description: "Your preferences have been saved.",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/email/send-test", { to: email });
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Check your inbox.",
      });
      setEmailTestAddress("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test email. Check SMTP configuration.",
        variant: "destructive",
      });
    },
  });

  // Handler for Profile Information form (also saves physical address)
  const handleProfileInfoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Save profile info
    updateProfileInfoMutation.mutate(profileForm);
    
    // Also save physical address to company
    const addressData: any = {
      address: addressValue || addressRef.current?.value || "",
      addressLine2: addressLine2Ref.current?.value ?? "",
      city: cityRef.current?.value ?? "",
      state: stateRef.current?.value ?? "",
      postalCode: postalCodeRef.current?.value ?? "",
      country: countryRef.current?.value || "United States",
    };
    updateCompanyMutation.mutate(addressData);
  };

  // Handler for Insurance Profile Information form
  const handleInsuranceProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateInsuranceProfileMutation.mutate(insuranceForm);
  };

  // Combined save handler for Overview tab - saves profile, address, and company info
  const handleSaveOverview = () => {
    // Save profile info
    updateProfileInfoMutation.mutate(profileForm);
    
    // Save physical address to company - use state variables for controlled inputs
    const addressData: any = {
      address: addressValue || "",
      addressLine2: addressLine2Ref.current?.value ?? "",
      city: cityValue || "",
      state: stateValue || "",
      postalCode: postalCodeValue || "",
      country: countryRef.current?.value || "United States",
    };
    
    // If admin, also save company information
    if (isAdmin) {
      const companyData: any = {
        ...addressData,
        name: companyNameRef.current?.value ?? "",
        slug: slugRef.current?.value ?? "",
        businessCategory: selectedCategory ?? "",
        businessNiche: selectedNiche ?? "",
        email: companyEmailRef.current?.value ?? "",
        phone: companyPhoneValue ? formatE164(companyPhoneValue) : "",
        website: websiteValue ?? "",
        platformLanguage: platformLanguageRef.current?.value ?? "",
      };
      updateCompanyMutation.mutate(companyData);
    } else {
      updateCompanyMutation.mutate(addressData);
    }
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailTestAddress) {
      sendTestEmailMutation.mutate(emailTestAddress);
    }
  };

  // Update avatar mutation
  const updateAvatarMutation = useMutation({
    mutationFn: async (avatar: string) => {
      return await apiRequest("PATCH", "/api/settings/profile", { avatar });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Success",
        description: "Profile picture updated successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile picture",
      });
    },
  });

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user?.companyId) {
        throw new Error("No company ID found");
      }
      return apiRequest("PATCH", `/api/companies/${user.companyId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies", user?.companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Company Updated",
        description: "Company information has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update company information.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Clear the saving section state after mutation completes
      setSavingSection(null);
    },
  });

  // Mark notification as read mutation
  const markNotificationAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Success",
        description: "Notification marked as read",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark notification as read",
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("DELETE", `/api/notifications/${notificationId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete notification",
      });
    },
  });

  // Mark all notifications as read mutation
  const markAllNotificationsAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/notifications/read-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark all notifications as read",
      });
    },
  });

  // Sign out all sessions and clear all security data
  const logoutAllSessionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/logout-all-sessions", {});
    },
    onSuccess: () => {
      toast({
        title: "Security Cleared",
        description: "All sessions and trusted devices have been removed",
      });
      // Redirect to login after successful logout
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear security data",
      });
    },
  });

  // Toggle Email 2FA mutation
  const toggleEmailTwoFactorMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", "/api/settings/2fa/email", { enabled });
    },
    onMutate: async (enabled: boolean) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["/api/session"] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(["/api/session"]);
      
      // Optimistically update ONLY the email 2FA field
      queryClient.setQueryData(["/api/session"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          user: {
            ...oldData.user,
            twoFactorEmailEnabled: enabled
          }
        };
      });
      
      return { previousData };
    },
    onError: (err, newValue, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["/api/session"], context.previousData);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update Email 2FA settings",
      });
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Email 2FA settings updated successfully",
      });
    },
  });

  // Toggle SMS 2FA mutation
  const toggleSmsTwoFactorMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("PATCH", "/api/settings/2fa/sms", { enabled });
    },
    onMutate: async (enabled: boolean) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["/api/session"] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(["/api/session"]);
      
      // Optimistically update ONLY the SMS 2FA field
      queryClient.setQueryData(["/api/session"], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          user: {
            ...oldData.user,
            twoFactorSmsEnabled: enabled
          }
        };
      });
      
      return { previousData };
    },
    onError: (error: any, newValue, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["/api/session"], context.previousData);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update SMS 2FA settings",
      });
    },
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "SMS 2FA settings updated successfully",
      });
    },
  });

  // Handler for Company Information Save
  const handleSaveCompanyInformation = async () => {
    setSavingSection("companyInfo");
    
    // Collect all current values from inputs - send all fields to allow clearing
    const data: any = {
      name: companyNameRef.current?.value ?? "",
      slug: slugRef.current?.value ?? "",
      businessCategory: selectedCategory ?? "",
      businessNiche: selectedNiche ?? "",
      email: companyEmailRef.current?.value ?? "",
      phone: companyPhoneValue ? formatE164(companyPhoneValue) : "",
      website: websiteRef.current?.value ?? "",
      platformLanguage: platformLanguageRef.current?.value ?? "",
    };
    
    updateCompanyMutation.mutate(data);
  };

  // Handler for Timezone Save
  const handleTimezoneUpdate = async (timezone?: string) => {
    const timezoneToSave = timezone || selectedTimezone;
    if (!timezoneToSave) return;
    
    try {
      const response = await fetch("/api/users/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: timezoneToSave }),
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/session"] });
        await queryClient.refetchQueries({ queryKey: ["/api/session"] });
        toast({
          title: "Timezone updated",
          description: "Your timezone preference has been saved.",
        });
      } else {
        throw new Error("Failed to update timezone");
      }
    } catch (error) {
      console.error("Error updating timezone:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update timezone. Please try again.",
      });
    }
  };

  // Handler for Physical Address Save
  const handleSavePhysicalAddress = () => {
    setSavingSection("physicalAddress");
    
    // Collect all current values - send all fields to allow clearing
    const data: any = {
      address: addressValue || addressRef.current?.value || "",
      addressLine2: addressLine2Ref.current?.value ?? "",
      city: cityRef.current?.value ?? "",
      state: stateRef.current?.value ?? "",
      postalCode: postalCodeRef.current?.value ?? "",
      country: countryRef.current?.value || "United States",
    };
    
    updateCompanyMutation.mutate(data);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
      });
      return;
    }

    // Validate size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    // Read file and convert to data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      updateAvatarMutation.mutate(result);
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read image file",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleLogoClick = () => {
    logoFileInputRef.current?.click();
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
      });
      return;
    }

    // Validate size (max 2.5MB)
    const maxSize = 2.5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 2.5MB",
      });
      return;
    }

    // Read file and convert to data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Update company logo
      setSavingSection("branding");
      updateCompanyMutation.mutate({ logo: result });
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read image file",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteLogo = () => {
    if (!companyData?.company?.id) return;
    setSavingSection("branding");
    
    // Clear the logo from localStorage cache immediately
    localStorage.removeItem('company_logo');
    
    updateCompanyMutation.mutate({ logo: null });
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "U";
    const firstInitial = user.firstName?.[0] || "";
    const lastInitial = user.lastName?.[0] || "";
    return (firstInitial + lastInitial).toUpperCase() || "U";
  };

  // Get role display text
  const getRoleDisplay = () => {
    if (!user?.role) return "User";
    const roleMap: { [key: string]: string } = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      user: "User",
    };
    return roleMap[user.role] || user.role;
  };

  // Get status display text
  const getStatusDisplay = () => {
    if (!user?.status) return "Unknown";
    const statusMap: { [key: string]: string } = {
      active: "Active",
      pending_activation: "Pending Activation",
      deactivated: "Deactivated",
    };
    return statusMap[user.status] || user.status;
  };

  // Get status color
  const getStatusColor = () => {
    if (!user?.status) return "text-gray-600 dark:text-gray-400";
    const colorMap: { [key: string]: string } = {
      active: "text-green-600 dark:text-green-400",
      pending_activation: "text-yellow-600 dark:text-yellow-400",
      deactivated: "text-red-600 dark:text-red-400",
    };
    return colorMap[user.status] || "text-gray-600 dark:text-gray-400";
  };

  // Show skeleton loader while critical data is loading
  if (isLoadingCriticalData) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        {/* Settings Content */}
        <div>
          <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setLocation(`/settings/${value}`); }} className="space-y-4">
            {/* Hidden TabsList - tabs are navigated via sidebar */}
            <TabsList className="hidden">
              <TabsTrigger value="overview">Profile</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>

            {/* Overview Tab - Profile + Company */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              {/* Save Button - positioned absolutely to align with breadcrumb */}
              <div className="absolute top-0 right-0">
                <Button
                  onClick={handleSaveOverview}
                  disabled={updateProfileInfoMutation.isPending || updateCompanyMutation.isPending}
                  data-testid="button-save-overview"
                >
                  {(updateProfileInfoMutation.isPending || updateCompanyMutation.isPending) ? "Saving..." : "Save Changes"}
                </Button>
              </div>

              {/* Profile + Company Cards */}
              <div className={view === 'all' || view === 'profile' ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : ""}>
                {/* Profile Information Card */}
                {(view === 'profile' || view === 'all') && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information and contact details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form id="profile-info-form" onSubmit={handleProfileInfoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          First Name
                          {!profileForm.firstName && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="firstName"
                          name="firstName"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                          data-testid="input-firstname"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">
                          Last Name
                          {!profileForm.lastName && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="lastName"
                          name="lastName"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                          data-testid="input-lastname"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">
                          Email
                          {!profileForm.email && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          data-testid="input-email-settings"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">
                          Phone Number
                          {!profileForm.phone && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="(415) 555-2671"
                          value={profileForm.phone || ""}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            setProfileForm({ ...profileForm, phone: formatted });
                          }}
                          data-testid="input-phone-settings"
                        />
                      </div>
                    </div>

                    {/* Physical Address Fields */}
                    <div className="mb-2">
                      <Label className="text-base font-medium">
                        Physical Address
                        {!addressValue && <span className="required-field-dot" title="Required field" />}
                      </Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <GooglePlacesAddressAutocomplete
                          value={addressValue}
                          onChange={(value) => {
                            setAddressValue(value);
                            if (addressRef.current) {
                              addressRef.current.value = value;
                            }
                          }}
                          onAddressSelect={(address) => {
                            setAddressValue(address.street);
                            setCityValue(address.city);
                            setStateValue(address.state);
                            setPostalCodeValue(address.postalCode);
                            if (addressRef.current) addressRef.current.value = address.street;
                            if (cityRef.current) cityRef.current.value = address.city;
                            if (stateRef.current) stateRef.current.value = address.state;
                            if (postalCodeRef.current) postalCodeRef.current.value = address.postalCode;
                            if (countryRef.current) countryRef.current.value = address.country;
                          }}
                          label="Street Address"
                          placeholder="Start typing your address..."
                          testId="input-address"
                        />
                        <input
                          ref={addressRef}
                          type="hidden"
                          value={addressValue}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="addressLine2">Address Line 2</Label>
                        <Input
                          id="addressLine2"
                          ref={addressLine2Ref}
                          placeholder="Apt, Suite, etc."
                          defaultValue={companyData?.company?.addressLine2 || ""}
                          data-testid="input-address-line-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">
                          City
                          {!cityValue && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="city"
                          ref={cityRef}
                          value={cityValue}
                          onChange={(e) => setCityValue(e.target.value)}
                          data-testid="input-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">
                          State / Province
                          {!stateValue && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="state"
                          ref={stateRef}
                          value={stateValue}
                          onChange={(e) => setStateValue(e.target.value)}
                          data-testid="input-state"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">
                          Postal Code
                          {!postalCodeValue && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="postalCode"
                          ref={postalCodeRef}
                          value={postalCodeValue}
                          onChange={(e) => setPostalCodeValue(e.target.value)}
                          data-testid="input-postal-code"
                        />
                      </div>
                    </div>

                    <input
                      ref={countryRef}
                      type="hidden"
                      defaultValue={companyData?.company?.country || "United States"}
                    />
                  </form>
                </CardContent>
              </Card>
              )}

              {/* Change Password Card - Profile view */}
              {(view === 'profile' || view === 'all') && (
                <Card>
                  <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        placeholder="Enter your current password"
                        data-testid="input-current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        placeholder="Enter your new password"
                        data-testid="input-new-password"
                      />
                      <p className="text-xs text-muted-foreground">
                        Password must be at least 8 characters long
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm your new password"
                        data-testid="input-confirm-password"
                      />
                    </div>
                    <Button data-testid="button-change-password">
                      Update Password
                    </Button>
                  </CardContent>
                </Card>
              )}
              </div>

              {/* Company Information - Admin Only */}
              {isAdmin && (view === 'company' || view === 'all') && (
              <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Company Information</CardTitle>
                    <CardDescription>
                      Basic company details and contact information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">
                          Company Name
                          {!companyData?.company?.name && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="companyName"
                          ref={companyNameRef}
                          defaultValue={companyData?.company?.name || ""}
                          data-testid="input-company-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="slug">Company Slug</Label>
                        <Input
                          id="slug"
                          ref={slugRef}
                          defaultValue={companyData?.company?.slug || ""}
                          data-testid="input-slug"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessCategory">
                          Business Category
                          {!selectedCategory && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Popover open={openCategory} onOpenChange={setOpenCategory}>
                          <PopoverTrigger asChild>
                            <Button
                              id="businessCategory"
                              variant="outline"
                              role="combobox"
                              aria-expanded={openCategory}
                              className="w-full justify-between"
                              data-testid="select-business-category"
                            >
                              {selectedCategory || "Select a category"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search category..." />
                              <CommandEmpty>No category found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {categories.map((category) => (
                                  <CommandItem
                                    key={category}
                                    value={category}
                                    onSelect={(currentValue) => {
                                      const originalCategory = categories.find(
                                        cat => cat.toLowerCase() === currentValue.toLowerCase()
                                      ) || "";
                                      const newValue = originalCategory === selectedCategory ? "" : originalCategory;
                                      setSelectedCategory(newValue);
                                      setSelectedNiche("");
                                      if (businessCategoryRef.current) {
                                        businessCategoryRef.current.value = newValue;
                                      }
                                      if (businessNicheRef.current) {
                                        businessNicheRef.current.value = "";
                                      }
                                      setOpenCategory(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedCategory === category ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {category}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <input
                          ref={businessCategoryRef}
                          type="hidden"
                          value={selectedCategory}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessNiche">
                          Business Niche
                          {!selectedNiche && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Popover open={openNiche} onOpenChange={setOpenNiche}>
                          <PopoverTrigger asChild>
                            <Button
                              id="businessNiche"
                              variant="outline"
                              role="combobox"
                              aria-expanded={openNiche}
                              className="w-full justify-between"
                              data-testid="select-business-niche"
                            >
                              {selectedNiche || "Select a niche"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search niche..." />
                              <CommandEmpty>No niche found.</CommandEmpty>
                              <CommandGroup className="max-h-64 overflow-auto">
                                {niches
                                  .filter((niche) => !selectedCategory || niche.category === selectedCategory)
                                  .map((niche) => (
                                    <CommandItem
                                      key={niche.value}
                                      value={niche.value}
                                      onSelect={(currentValue) => {
                                        const originalNiche = niches.find(
                                          n => n.value.toLowerCase() === currentValue.toLowerCase()
                                        );
                                        const newValue = originalNiche && originalNiche.value === selectedNiche ? "" : (originalNiche?.value || "");
                                        setSelectedNiche(newValue);
                                        if (businessNicheRef.current) {
                                          businessNicheRef.current.value = newValue;
                                        }
                                        setOpenNiche(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedNiche === niche.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {niche.label}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <input
                          ref={businessNicheRef}
                          type="hidden"
                          value={selectedNiche}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyEmail">
                          Company Email
                          {!companyData?.company?.email && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="companyEmail"
                          ref={companyEmailRef}
                          type="email"
                          defaultValue={companyData?.company?.email || ""}
                          data-testid="input-company-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyPhone">
                          Company Phone
                          {!companyPhoneValue && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="companyPhone"
                          type="tel"
                          value={companyPhoneValue}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            setCompanyPhoneValue(formatted);
                          }}
                          placeholder="(555) 555-5555"
                          data-testid="input-company-phone"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="website">
                          Website
                          {!websiteValue && <span className="required-field-dot" title="Required field" />}
                        </Label>
                        <Input
                          id="website"
                          ref={websiteRef}
                          type="url"
                          placeholder="https://example.com"
                          value={websiteValue}
                          onChange={(e) => setWebsiteValue(e.target.value)}
                          data-testid="input-website"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="platformLanguage">Platform Language</Label>
                        <Input
                          id="platformLanguage"
                          ref={platformLanguageRef}
                          defaultValue={companyData?.company?.platformLanguage || "English (United States)"}
                          data-testid="input-platform-language"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="timezone">Your Timezone</Label>
                          {selectedTimezone && (
                            <span className="text-sm font-medium text-muted-foreground">
                              {currentTime.toLocaleTimeString('en-US', {
                                timeZone: selectedTimezone,
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })}
                              {' '}
                              {selectedTimezone.includes('New_York') ? 'EST'
                                : selectedTimezone.includes('Chicago') ? 'CST'
                                : selectedTimezone.includes('Denver') ? 'MST'
                                : selectedTimezone.includes('Los_Angeles') ? 'PST'
                                : selectedTimezone.includes('London') ? 'GMT'
                                : selectedTimezone.includes('Paris') ? 'CET'
                                : selectedTimezone.includes('Tokyo') ? 'JST'
                                : selectedTimezone.includes('Sydney') ? 'AEST'
                                : selectedTimezone.includes('Dubai') ? 'GST'
                                : selectedTimezone.includes('Singapore') ? 'SGT'
                                : selectedTimezone.includes('Hong_Kong') ? 'HKT'
                                : selectedTimezone.split('/')[1]?.replace('_', ' ') || 'UTC'}
                            </span>
                          )}
                        </div>
                        <Select
                          value={selectedTimezone}
                          onValueChange={(value) => {
                            setSelectedTimezone(value);
                            handleTimezoneUpdate(value);
                          }}
                        >
                          <SelectTrigger id="timezone" data-testid="select-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">America - USA</div>
                            <SelectItem value="America/New_York">(UTC-05:00) EST, New York, Toronto</SelectItem>
                            <SelectItem value="America/Chicago">(UTC-06:00) CST, Chicago, Mexico City</SelectItem>
                            <SelectItem value="America/Denver">(UTC-07:00) MST, Denver, Phoenix</SelectItem>
                            <SelectItem value="America/Los_Angeles">(UTC-08:00) PST, Los Angeles, Vancouver</SelectItem>
                            <SelectItem value="America/Anchorage">(UTC-09:00) AKST, Anchorage</SelectItem>
                            <SelectItem value="Pacific/Honolulu">(UTC-10:00) HST, Honolulu</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Central and South America</div>
                            <SelectItem value="America/Argentina/Buenos_Aires">(UTC-03:00) ART, Buenos Aires</SelectItem>
                            <SelectItem value="America/Sao_Paulo">(UTC-03:00) BRT, São Paulo, Rio de Janeiro</SelectItem>
                            <SelectItem value="America/Santiago">(UTC-03:00) CLT, Santiago</SelectItem>
                            <SelectItem value="America/Bogota">(UTC-05:00) COT, Bogotá</SelectItem>
                            <SelectItem value="America/Lima">(UTC-05:00) PET, Lima</SelectItem>
                            <SelectItem value="America/Caracas">(UTC-04:00) AST, Caracas</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Europe</div>
                            <SelectItem value="Europe/London">(UTC+00:00) GMT, London, Dublin</SelectItem>
                            <SelectItem value="Europe/Paris">(UTC+01:00) CET, Paris, Madrid, Berlin</SelectItem>
                            <SelectItem value="Europe/Istanbul">(UTC+02:00) EET, Istanbul, Athens, Cairo</SelectItem>
                            <SelectItem value="Europe/Moscow">(UTC+03:00) MSK, Moscow, Saint Petersburg</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Africa</div>
                            <SelectItem value="Africa/Lagos">(UTC+01:00) WAT, Lagos, Kinshasa</SelectItem>
                            <SelectItem value="Africa/Johannesburg">(UTC+02:00) SAST, Johannesburg, Cape Town</SelectItem>
                            <SelectItem value="Africa/Nairobi">(UTC+03:00) EAT, Nairobi, Addis Ababa</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Asia</div>
                            <SelectItem value="Asia/Kolkata">(UTC+05:30) IST, Kolkata, New Delhi, Mumbai</SelectItem>
                            <SelectItem value="Asia/Jakarta">(UTC+07:00) WIB, Jakarta, Bangkok</SelectItem>
                            <SelectItem value="Asia/Shanghai">(UTC+08:00) CST, Shanghai, Beijing, Hong Kong</SelectItem>
                            <SelectItem value="Asia/Hong_Kong">(UTC+08:00) HKT, Hong Kong</SelectItem>
                            <SelectItem value="Asia/Singapore">(UTC+08:00) SGT, Singapore</SelectItem>
                            <SelectItem value="Asia/Tokyo">(UTC+09:00) JST, Tokyo, Osaka</SelectItem>
                            <SelectItem value="Asia/Seoul">(UTC+09:00) KST, Seoul</SelectItem>
                            <SelectItem value="Asia/Manila">(UTC+08:00) PHT, Manila</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Australia and Pacific</div>
                            <SelectItem value="Australia/Adelaide">(UTC+09:30) ACST, Adelaide, Darwin</SelectItem>
                            <SelectItem value="Australia/Sydney">(UTC+10:00) AEST, Sydney, Melbourne</SelectItem>
                            <SelectItem value="Pacific/Auckland">(UTC+12:00) NZST, Auckland, Wellington</SelectItem>
                            <SelectItem value="Pacific/Chatham">(UTC+12:45) Chatham Islands</SelectItem>
                            <SelectItem value="Pacific/Apia">(UTC+13:00) Samoa, Apia</SelectItem>
                            <SelectItem value="Pacific/Kiritimati">(UTC+14:00) Line Islands, Kiritimati</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Middle East</div>
                            <SelectItem value="Asia/Riyadh">(UTC+03:00) AST, Riyadh, Kuwait, Baghdad</SelectItem>
                            <SelectItem value="Asia/Dubai">(UTC+04:00) GST, Dubai, Abu Dhabi</SelectItem>
                            
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">UTC (Coordinated Universal Time)</div>
                            <SelectItem value="UTC">(UTC+00:00) UTC, Greenwich</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

          </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Security & Preferences</CardTitle>
                    <CardDescription>
                      Manage two-factor authentication and notification preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Two-Factor Authentication Section */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Two-Factor Authentication</h4>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="twoFactorEmailEnabled" className="text-base">
                            Email 2FA
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {user?.twoFactorEmailEnabled 
                              ? "Email two-factor authentication is enabled on your account"
                              : "Secure your account with email-based two-factor authentication"}
                          </p>
                        </div>
                        <Switch
                          id="twoFactorEmailEnabled"
                          checked={user?.twoFactorEmailEnabled || false}
                          onCheckedChange={(checked) => toggleEmailTwoFactorMutation.mutate(checked)}
                          disabled={toggleEmailTwoFactorMutation.isPending}
                          data-testid="switch-two-factor-email"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="twoFactorSmsEnabled" className="text-base">
                            SMS 2FA
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {user?.twoFactorSmsEnabled 
                              ? "SMS two-factor authentication is enabled on your account"
                              : "Secure your account with SMS-based two-factor authentication"}
                          </p>
                        </div>
                        <Switch
                          id="twoFactorSmsEnabled"
                          checked={user?.twoFactorSmsEnabled || false}
                          onCheckedChange={(checked) => toggleSmsTwoFactorMutation.mutate(checked)}
                          disabled={!user?.phone || toggleSmsTwoFactorMutation.isPending}
                          data-testid="switch-two-factor-sms"
                        />
                      </div>
                      
                      {!user?.phone && (
                        <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <Shield className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Phone number required for SMS 2FA
                              </h3>
                              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                                <p>
                                  Add a phone number to your profile to enable two-factor authentication via SMS.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notification Preferences Section */}
                    <div className="space-y-4 pt-2 border-t">
                      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pt-4">Notification Preferences</h4>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="emailNotifications" className="text-base">
                            Email Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Receive email updates about your account activity.
                          </p>
                        </div>
                        <Switch
                          id="emailNotifications"
                          checked={preferencesData?.preferences?.emailNotifications ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              ...preferencesData?.preferences,
                              emailNotifications: checked,
                            });
                          }}
                          disabled={updatePreferencesMutation.isPending}
                          data-testid="switch-email-notifications"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="smsNotifications" className="text-base">
                            SMS Notifications
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Receive SMS updates about your account activity.
                          </p>
                        </div>
                        <Switch
                          id="smsNotifications"
                          checked={preferencesData?.preferences?.smsNotifications ?? true}
                          onCheckedChange={(checked) => {
                            updatePreferencesMutation.mutate({
                              ...preferencesData?.preferences,
                              smsNotifications: checked,
                            });
                          }}
                          disabled={updatePreferencesMutation.isPending}
                          data-testid="switch-sms-notifications"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>
                      Manage your active sessions and devices. Sign out from all sessions to clear all security data.
                    </CardDescription>
                  </div>
                  {!isLoadingSessions && sessionsData?.sessions && sessionsData.sessions.length >= 1 && (
                    <Button 
                      variant="destructive"
                      onClick={() => logoutAllSessionsMutation.mutate()}
                      disabled={logoutAllSessionsMutation.isPending}
                      data-testid="button-sign-out-all-sessions"
                    >
                      {logoutAllSessionsMutation.isPending ? "Clearing..." : "Sign Out All Sessions"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isLoadingSessions ? (
                      <LoadingSpinner message="Loading sessions..." fullScreen={false} />
                    ) : sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
                      <>
                        {sessionsData.sessions.map((session) => (
                          <div 
                            key={session.id} 
                            className="flex items-center gap-3 p-3 rounded-md border bg-card"
                            data-testid={`session-${session.isCurrent ? 'current' : 'other'}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {session.isCurrent ? "Current Session" : "Other Device"}
                                </p>
                                {session.isCurrent && (
                                  <Badge variant="default" className="text-xs px-1.5 py-0">
                                    Active
                                  </Badge>
                                )}
                              </div>
                              {session.lastActive && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Last active: {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground truncate" data-testid="text-device-info">
                                {session.deviceInfo}
                              </p>
                              <p className="text-xs text-muted-foreground" data-testid="text-ip-address">
                                IP: {session.ipAddress}
                              </p>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No active sessions found
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Session Activity - moved from separate tab */}
              <SessionActivityTab />
            </TabsContent>

            {/* Automations Tab */}
            <TabsContent value="automations" className="space-y-4">
              <AutomationsTab />
            </TabsContent>

            {/* Team Tab */}
            <TabsContent value="team" className="space-y-4">
              <TeamMembersSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// Team Members Section with user count display
function TeamMembersSection() {
  const { data: limitsData, isLoading: isLoadingLimits } = useQuery<{ 
    maxUsers: number | null;
    currentUsers: number;
    canAddUsers: boolean;
    planName: string | null;
  }>({
    queryKey: ["/api/users/limits"],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            View and manage users in your company
          </CardDescription>
        </div>
        {!isLoadingLimits && limitsData && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium">
                {limitsData.currentUsers} / {limitsData.maxUsers ?? "∞"} users
              </p>
              {limitsData.planName && (
                <p className="text-xs text-muted-foreground">{limitsData.planName} Plan</p>
              )}
            </div>
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <TeamMembersTable />
      </CardContent>
    </Card>
  );
}

function TeamMembersTable() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: usersData, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  const { data: limitsData } = useQuery<{ 
    maxUsers: number | null;
    currentUsers: number;
    canAddUsers: boolean;
    planName: string | null;
  }>({
    queryKey: ["/api/users/limits"],
  });

  const currentUser = sessionData?.user;
  const currentUserCompanyId = currentUser?.companyId;
  const canAddUsers = limitsData?.canAddUsers !== false;

  // User creation form schema - matches superadmin form exactly
  const userFormSchema = insertUserSchema.omit({ password: true }).extend({
    role: z.enum(["admin", "agent"]),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional().or(z.literal("")),
    dateOfBirth: z.string().optional().or(z.literal("")),
    preferredLanguage: z.string().optional(),
  });

  type UserForm = z.infer<typeof userFormSchema>;

  const createForm = useForm<UserForm>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      preferredLanguage: "en",
      role: "agent",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      console.log("[CREATE USER] Form data:", data);
      console.log("[CREATE USER] Current company ID:", currentUserCompanyId);
      
      const dataToSend = {
        ...data,
        companyId: currentUserCompanyId, // Automatically set to current user's company
        phone: data.phone && data.phone.trim() ? formatE164(data.phone) : null,
      };
      
      console.log("[CREATE USER] Data to send:", dataToSend);
      return apiRequest("POST", "/api/users", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreateOpen(false);
      createForm.reset();
      toast({
        title: "Team Member Added",
        description: "The new team member has been added successfully.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Failed to add team member.";
      try {
        if (error?.message) {
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
          } else {
            errorMessage = error.message;
          }
        }
      } catch (e) {
        console.error("Error parsing error message:", e);
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/users/${id}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Status Updated",
        description: "The user status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: UserForm) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading team members...</p>
        </div>
      </div>
    );
  }

  if (!usersData || usersData.users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <UserIcon className="h-12 w-12 text-muted-foreground/50 mb-3 mx-auto" />
          <p className="text-sm font-medium">No team members found</p>
        </div>
      </div>
    );
  }

  // Filter users based on search and filters
  const filteredUsers = usersData.users.filter((user) => {
    const matchesSearch = searchTerm === "" || 
      (user.firstName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false) ||
      (user.lastName?.toLowerCase()?.includes(searchTerm.toLowerCase()) ?? false) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'user':
      case 'member':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'viewer':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending_activation':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'deactivated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Team Members</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button 
                  onClick={() => setCreateOpen(true)} 
                  size="sm"
                  disabled={!canAddUsers}
                  data-testid="button-add-team-member"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team Member
                </Button>
              </span>
            </TooltipTrigger>
            {!canAddUsers && (
              <TooltipContent>
                <p>You have reached the maximum number of users allowed on your plan ({limitsData?.maxUsers} users). Upgrade your plan to add more team members.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-role-filter">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_activation">Pending</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {usersData.users.length} team members
      </div>

      {/* Users Table */}
      <div className="rounded-md border">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <UserIcon className="h-12 w-12 text-muted-foreground/50 mb-3 mx-auto" />
                  <p className="text-sm font-medium">No users found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover-elevate" data-testid={`row-user-${user.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || undefined} alt={`${user.firstName} ${user.lastName}`} />
                        <AvatarFallback className="text-xs">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium" data-testid={`text-username-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs">
                        <AtSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2 text-xs">
                          <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatForDisplay(user.phone)}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      className={cn("text-xs", getRoleBadgeColor(user.role))}
                      data-testid={`badge-role-${user.id}`}
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge 
                      className={cn("text-xs", getStatusBadgeColor(user.status))}
                      data-testid={`badge-status-${user.id}`}
                    >
                      {user.status === 'pending_activation' ? 'Pending' : user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(user)}
                        data-testid={`button-view-details-${user.id}`}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStatusMutation.mutate(user.id)}
                        disabled={toggleStatusMutation.isPending}
                        data-testid={`button-toggle-status-${user.id}`}
                        title={user.isActive ? "Deactivate User" : "Activate User"}
                      >
                        <Power className={cn("h-4 w-4", user.isActive ? "text-green-600" : "text-gray-400")} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Details Dialog */}
      <UserDetailsDialog
        user={selectedUser}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      {/* Create Team Member Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Create a new user account for your team. They will receive an email to set up their password.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-create-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-create-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-create-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="tel"
                        placeholder="(415) 555-2671"
                        data-testid="input-create-phone"
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          type="date"
                          data-testid="input-create-dob"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="preferredLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Language</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-create-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCreateOpen(false)}
                  disabled={createMutation.isPending}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create"
                >
                  {createMutation.isPending ? "Creating..." : "Add Team Member"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// User Details Dialog Component
interface UserDetailsDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UserDetailsDialog({ user, open, onOpenChange }: UserDetailsDialogProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({});

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "agent",
        timezone: user.timezone || "",
        agentInternalCode: user.agentInternalCode || "",
        instructionLevel: user.instructionLevel || "",
        nationalProducerNumber: user.nationalProducerNumber || "",
        federallyFacilitatedMarketplace: user.federallyFacilitatedMarketplace || "",
        referredBy: user.referredBy || "",
        viewAllCompanyData: user.viewAllCompanyData || false,
      });
      setIsEditing(false);
    }
  }, [user]);

  const updateUserMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      if (!user) return;
      const updateData: any = {};
      
      // Only include changed fields
      if (data.firstName !== user.firstName) updateData.firstName = data.firstName;
      if (data.lastName !== user.lastName) updateData.lastName = data.lastName;
      if (data.phone !== user.phone && data.phone) {
        updateData.phone = formatE164(data.phone);
      }
      if (data.role !== user.role) updateData.role = data.role;
      if (data.timezone !== user.timezone) updateData.timezone = data.timezone;
      if (data.agentInternalCode !== user.agentInternalCode) updateData.agentInternalCode = data.agentInternalCode;
      if (data.instructionLevel !== user.instructionLevel) updateData.instructionLevel = data.instructionLevel;
      if (data.nationalProducerNumber !== user.nationalProducerNumber) updateData.nationalProducerNumber = data.nationalProducerNumber;
      if (data.federallyFacilitatedMarketplace !== user.federallyFacilitatedMarketplace) updateData.federallyFacilitatedMarketplace = data.federallyFacilitatedMarketplace;
      if (data.referredBy !== user.referredBy) updateData.referredBy = data.referredBy;
      if (data.viewAllCompanyData !== user.viewAllCompanyData) updateData.viewAllCompanyData = data.viewAllCompanyData;

      return apiRequest("PATCH", `/api/users/${user.id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateUserMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "agent",
        timezone: user.timezone || "",
        agentInternalCode: user.agentInternalCode || "",
        instructionLevel: user.instructionLevel || "",
        nationalProducerNumber: user.nationalProducerNumber || "",
        federallyFacilitatedMarketplace: user.federallyFacilitatedMarketplace || "",
        referredBy: user.referredBy || "",
      });
    }
    setIsEditing(false);
  };

  if (!user) return null;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'user':
      case 'member':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'viewer':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending_activation':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'deactivated':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatar || undefined} alt={`${user.firstName} ${user.lastName}`} />
                <AvatarFallback>
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>{user.firstName} {user.lastName}</DialogTitle>
                <DialogDescription>{user.email}</DialogDescription>
              </div>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-user">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Role */}
          <div className="flex items-center gap-3">
            <Badge className={cn("text-xs", getStatusBadgeColor(user.status))}>
              {user.status === 'pending_activation' ? 'Pending' : user.status}
            </Badge>
            <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>
              {user.role}
            </Badge>
            {user.emailVerified && (
              <Badge variant="outline" className="text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Email Verified
              </Badge>
            )}
          </div>

          {/* Personal Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName || ""}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-first-name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName || ""}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-last-name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={isEditing ? formatPhoneInput(formData.phone || "") : formatForDisplay(user.phone || "")}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!isEditing}
                  data-testid="input-phone"
                />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={user.dateOfBirth ? format(new Date(user.dateOfBirth), "yyyy-MM-dd") : ""}
                  disabled
                  className="bg-muted"
                  data-testid="input-date-of-birth"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role || "agent"}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  disabled={!isEditing}
                >
                  <SelectTrigger data-testid="select-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superadmin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Data Visibility Controls */}
          {isEditing && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Data Visibility
              </h3>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">
                    Share Full Company Data
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this user to view all policies, quotes, contacts, tasks, and calendar events from the entire company (not just their own data)
                  </p>
                </div>
                <Switch
                  checked={formData.viewAllCompanyData || false}
                  onCheckedChange={(checked) => setFormData({ ...formData, viewAllCompanyData: checked })}
                  data-testid="switch-view-all-company-data"
                />
              </div>
            </div>
          )}

          {/* Timezone */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Timezone
            </h3>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone || ""}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                disabled={!isEditing}
              >
                <SelectTrigger id="timezone" data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">America - USA</div>
                  <SelectItem value="America/New_York">(UTC-05:00) EST, New York, Toronto</SelectItem>
                  <SelectItem value="America/Chicago">(UTC-06:00) CST, Chicago, Mexico City</SelectItem>
                  <SelectItem value="America/Denver">(UTC-07:00) MST, Denver, Phoenix</SelectItem>
                  <SelectItem value="America/Los_Angeles">(UTC-08:00) PST, Los Angeles, Vancouver</SelectItem>
                  <SelectItem value="America/Anchorage">(UTC-09:00) AKST, Anchorage</SelectItem>
                  <SelectItem value="Pacific/Honolulu">(UTC-10:00) HST, Honolulu</SelectItem>
                  
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Central and South America</div>
                  <SelectItem value="America/Argentina/Buenos_Aires">(UTC-03:00) ART, Buenos Aires</SelectItem>
                  <SelectItem value="America/Sao_Paulo">(UTC-03:00) BRT, São Paulo, Rio de Janeiro</SelectItem>
                  <SelectItem value="America/Santiago">(UTC-03:00) CLT, Santiago</SelectItem>
                  <SelectItem value="America/Bogota">(UTC-05:00) COT, Bogotá</SelectItem>
                  <SelectItem value="America/Lima">(UTC-05:00) PET, Lima</SelectItem>
                  <SelectItem value="America/Caracas">(UTC-04:00) AST, Caracas</SelectItem>
                  
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Europe</div>
                  <SelectItem value="Europe/London">(UTC+00:00) GMT, London, Dublin</SelectItem>
                  <SelectItem value="Europe/Paris">(UTC+01:00) CET, Paris, Madrid, Berlin</SelectItem>
                  <SelectItem value="Europe/Istanbul">(UTC+02:00) EET, Istanbul, Athens, Cairo</SelectItem>
                  <SelectItem value="Europe/Moscow">(UTC+03:00) MSK, Moscow, Saint Petersburg</SelectItem>
                  
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Africa</div>
                  <SelectItem value="Africa/Lagos">(UTC+01:00) WAT, Lagos, Kinshasa</SelectItem>
                  <SelectItem value="Africa/Johannesburg">(UTC+02:00) SAST, Johannesburg, Cape Town</SelectItem>
                  <SelectItem value="Africa/Nairobi">(UTC+03:00) EAT, Nairobi, Addis Ababa</SelectItem>
                  
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Asia</div>
                  <SelectItem value="Asia/Kolkata">(UTC+05:30) IST, Kolkata, New Delhi, Mumbai</SelectItem>
                  <SelectItem value="Asia/Jakarta">(UTC+07:00) WIB, Jakarta, Bangkok</SelectItem>
                  <SelectItem value="Asia/Shanghai">(UTC+08:00) CST, Shanghai, Beijing, Hong Kong</SelectItem>
                  <SelectItem value="Asia/Hong_Kong">(UTC+08:00) HKT, Hong Kong</SelectItem>
                  <SelectItem value="Asia/Singapore">(UTC+08:00) SGT, Singapore</SelectItem>
                  <SelectItem value="Asia/Tokyo">(UTC+09:00) JST, Tokyo, Seoul</SelectItem>
                  
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Australia and Pacific</div>
                  <SelectItem value="Australia/Sydney">(UTC+11:00) AEDT, Sydney, Melbourne</SelectItem>
                  <SelectItem value="Australia/Perth">(UTC+08:00) AWST, Perth</SelectItem>
                  <SelectItem value="Pacific/Auckland">(UTC+13:00) NZDT, Auckland</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Insurance Profile (if applicable) */}
          {(user.agentInternalCode || user.instructionLevel || user.nationalProducerNumber || user.federallyFacilitatedMarketplace || user.referredBy || isEditing) && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Insurance Profile
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="agentInternalCode">Agent Internal Code</Label>
                  <Input
                    id="agentInternalCode"
                    value={formData.agentInternalCode || ""}
                    onChange={(e) => setFormData({ ...formData, agentInternalCode: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-agent-code"
                  />
                </div>
                <div>
                  <Label htmlFor="instructionLevel">Instruction Level</Label>
                  <Input
                    id="instructionLevel"
                    value={formData.instructionLevel || ""}
                    onChange={(e) => setFormData({ ...formData, instructionLevel: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-instruction-level"
                  />
                </div>
                <div>
                  <Label htmlFor="nationalProducerNumber">National Producer Number</Label>
                  <Input
                    id="nationalProducerNumber"
                    value={formData.nationalProducerNumber || ""}
                    onChange={(e) => setFormData({ ...formData, nationalProducerNumber: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-npn"
                  />
                </div>
                <div>
                  <Label htmlFor="federallyFacilitatedMarketplace">FFM</Label>
                  <Input
                    id="federallyFacilitatedMarketplace"
                    value={formData.federallyFacilitatedMarketplace || ""}
                    onChange={(e) => setFormData({ ...formData, federallyFacilitatedMarketplace: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-ffm"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="referredBy">Referred By</Label>
                  <Input
                    id="referredBy"
                    value={formData.referredBy || ""}
                    onChange={(e) => setFormData({ ...formData, referredBy: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-referred-by"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Account Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Account Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "N/A"}</span>
              </div>
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Login:</span>
                <span>{user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : "Never"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span>{user.twoFactorEmailEnabled ? "Active" : "Inactive"}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">SMS:</span>
                <span>{user.twoFactorSmsEnabled ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>
        </div>

        {isEditing && (
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={updateUserMutation.isPending} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateUserMutation.isPending} data-testid="button-save">
              {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Session Activity Tab Component
function SessionActivityTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "failed">("all");

  // Build query URL with parameters
  const queryUrl = `/api/session-activity?page=${currentPage}&pageSize=${pageSize}&searchQuery=${encodeURIComponent(searchQuery)}&resultFilter=${resultFilter}`;
  
  // Fetch session activity logs
  const { data: activityData, isLoading } = useQuery<{
    logs: Array<{
      id: number;
      timestamp: string;
      action: string;
      ipAddress: string | null;
      userAgent: string | null;
      metadata: any;
      success: boolean;
    }>;
    total: number;
  }>({
    queryKey: [queryUrl],
  });

  const logs = activityData?.logs || [];
  const total = activityData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Parse user agent to extract browser and OS
  const parseUserAgent = (userAgent: string | null) => {
    if (!userAgent) return "Unknown";
    
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    // Detect browser
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
      browser = "Google Chrome";
    } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      browser = "Safari";
    } else if (userAgent.includes("Firefox")) {
      browser = "Firefox";
    } else if (userAgent.includes("Edg")) {
      browser = "Microsoft Edge";
    }

    // Detect OS
    if (userAgent.includes("Windows")) {
      os = "Windows";
    } else if (userAgent.includes("Mac")) {
      os = "MacOS";
    } else if (userAgent.includes("Linux")) {
      os = "Linux";
    } else if (userAgent.includes("Android")) {
      os = "Android";
    } else if (userAgent.includes("iOS") || userAgent.includes("iPhone")) {
      os = "iOS";
    }

    return `${browser}\n${os}`;
  };

  // Get full location info from metadata
  const getLocationInfo = (metadata: any) => {
    if (!metadata) return { country: "Unknown", details: "" };
    
    const parts = [];
    
    // City, Region/State
    if (metadata.city) parts.push(metadata.city);
    if (metadata.regionName) parts.push(metadata.regionName);
    if (metadata.country) parts.push(metadata.country);
    
    const location = parts.join(", ") || "Unknown Location";
    
    // Additional details (ISP, ZIP, Coordinates)
    const details = [];
    if (metadata.zip && metadata.zip !== 'N/A') details.push(`ZIP: ${metadata.zip}`);
    if (metadata.isp && metadata.isp !== 'N/A') details.push(`ISP: ${metadata.isp}`);
    if (metadata.timezone && metadata.timezone !== 'UTC') details.push(`TZ: ${metadata.timezone}`);
    if (metadata.lat && metadata.lon) details.push(`${metadata.lat.toFixed(4)}, ${metadata.lon.toFixed(4)}`);
    
    return {
      location,
      details: details.join(" • ")
    };
  };

  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setResultFilter("all");
    setCurrentPage(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Activity</CardTitle>
        <CardDescription>
          View all login attempts including successful and failed authentication events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Search by IP"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              data-testid="input-search-ip"
              className="max-w-sm"
            />
            <Button onClick={handleSearch} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
          <div className="flex gap-2">
            <Select value={resultFilter} onValueChange={(value: any) => { setResultFilter(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]" data-testid="select-result-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Success Only</SelectItem>
                <SelectItem value="failed">Failed Only</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || resultFilter !== "all") && (
              <Button variant="outline" onClick={handleResetFilters} data-testid="button-reset-filters">
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2 text-sm">
          <span>Show</span>
          <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setCurrentPage(1); }}>
            <SelectTrigger className="w-[80px]" data-testid="select-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">
            Showing {logs.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} to {Math.min(currentPage * pageSize, total)} of {total} Entries
          </span>
        </div>

        {/* Table */}
        {isLoading ? (
          <LoadingSpinner message="Loading session activity..." fullScreen={false} />
        ) : logs.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Datetime</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">IP</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Browser</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const locationInfo = getLocationInfo(log.metadata);
                    return (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-activity-${log.id}`}>
                        <td className="px-4 py-3 text-sm" data-testid="text-datetime">
                          {format(parseISO(log.timestamp), "MMM dd, yyyy h:mm a")}
                        </td>
                        <td className="px-4 py-3 text-sm" data-testid="text-ip">
                          {log.ipAddress || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-pre-line" data-testid="text-browser">
                          {parseUserAgent(log.userAgent)}
                        </td>
                        <td className="px-4 py-3 text-sm" data-testid="text-country">
                          <div className="font-medium">{locationInfo.location}</div>
                          {locationInfo.details && (
                            <div className="text-muted-foreground text-xs mt-1">{locationInfo.details}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" data-testid="text-result">
                          {log.action === "auth_login" || log.action === "auth_login_with_otp" || log.action === "auth_login_trusted_device" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                              Successfully signed in.
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                              User password invalid.
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No session activity found
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
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
                    onClick={() => setCurrentPage(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-2 py-2">...</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(totalPages)}
                    data-testid={`button-page-${totalPages}`}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationsTab() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const currentUser = sessionData?.user;

  // Fetch birthday settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery<{
    id: string;
    userId: string;
    isEnabled: boolean;
    selectedImageId: string | null;
    customMessage: string;
  }>({
    queryKey: ["/api/user/birthday-settings"],
    enabled: !!currentUser,
  });

  // Fetch active birthday images
  const { data: imagesData, isLoading: imagesLoading } = useQuery<{
    images: Array<{
      id: string;
      name: string;
      imageUrl: string;
      isActive: boolean;
    }>;
  }>({
    queryKey: ["/api/birthday-images/active"],
    enabled: !!currentUser,
  });

  // Fetch birthday greeting history
  const { data: historyData, isLoading: historyLoading } = useQuery<{
    history: Array<{
      id: string;
      recipientName: string;
      recipientPhone: string;
      recipientDateOfBirth: string;
      message: string;
      imageUrl: string | null;
      status: string;
      sentAt: Date;
      deliveredAt: Date | null;
      errorMessage: string | null;
    }>;
  }>({
    queryKey: ["/api/birthday-greetings/history"],
    enabled: !!currentUser,
  });

  const settings = settingsData;
  const images = imagesData?.images || [];
  const history = historyData?.history || [];

  // Form for editing settings
  const [formData, setFormData] = useState({
    isEnabled: true,
    selectedImageId: null as string | null,
    customMessage: "🎉 ¡Feliz Cumpleaños {CLIENT_NAME}! 🎂\n\nTe deseamos el mejor de los éxitos en este nuevo año de vida.\n\nTe saluda {AGENT_NAME}, tu agente de seguros. 🎊",
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        isEnabled: settings.isEnabled,
        selectedImageId: settings.selectedImageId || (images.length > 0 ? images[0].id : null),
        customMessage: settings.customMessage,
      });
    } else if (images.length > 0 && !formData.selectedImageId) {
      setFormData(prev => ({
        ...prev,
        selectedImageId: images[0].id,
      }));
    }
  }, [settings, images]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/user/birthday-settings", data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your birthday automation settings have been updated successfully.",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/birthday-settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Manual birthday greetings mutation
  const processManualBirthdaysMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/test/run-birthday-scheduler", {});
    },
    onSuccess: (data: any) => {
      const count = data.results?.length || 0;
      const successful = data.results?.filter((r: any) => r.status === "sent").length || 0;
      
      toast({
        title: "Birthday Greetings Processed",
        description: `Processed ${count} birthday(s). ${successful} sent successfully.`,
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/birthday-greetings/history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process birthday greetings",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        isEnabled: settings.isEnabled,
        selectedImageId: settings.selectedImageId,
        customMessage: settings.customMessage,
      });
    }
    setIsEditing(false);
  };

  const isLoading = settingsLoading || imagesLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Birthday Settings Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-3">
            {/* Left: Configuration */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold mb-2">Birthday Automation</h3>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">Enable</label>
                <Switch
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, isEnabled: checked });
                    if (!isEditing) setIsEditing(true);
                  }}
                  data-testid="switch-birthday-enabled"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Birthday Image</label>
                <div className="flex gap-1.5">
                  {images.length > 0 && (
                    <Select
                      value={formData.selectedImageId || "none"}
                      onValueChange={(value) => {
                        setFormData({ ...formData, selectedImageId: value === "none" ? null : value });
                        if (!isEditing) setIsEditing(true);
                      }}
                    >
                      <SelectTrigger data-testid="select-birthday-image" className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Choose from gallery" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Image</SelectItem>
                        {images.map((image) => (
                          <SelectItem key={image.id} value={image.id}>
                            {image.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs flex-1"
                    onClick={() => document.getElementById('birthday-image-upload')?.click()}
                    disabled={uploadingImage}
                    data-testid="button-upload-custom-image"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {uploadingImage ? "Uploading..." : "Upload Custom"}
                  </Button>
                  <input
                    id="birthday-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadingImage(true);
                        try {
                          const formDataUpload = new FormData();
                          formDataUpload.append('image', file);
                          
                          const response = await fetch('/api/birthday-images/upload', {
                            method: 'POST',
                            body: formDataUpload,
                            credentials: 'include',
                          });
                          
                          if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.message || 'Upload failed');
                          }
                          
                          const data = await response.json();
                          setFormData({ ...formData, selectedImageId: data.imageUrl });
                          if (!isEditing) setIsEditing(true);
                          
                          toast({
                            title: "Image Uploaded",
                            description: "Your custom birthday image has been uploaded successfully.",
                            duration: 3000,
                          });
                        } catch (error: any) {
                          toast({
                            title: "Upload Failed",
                            description: error.message || "Failed to upload image",
                            variant: "destructive",
                            duration: 3000,
                          });
                        } finally {
                          setUploadingImage(false);
                          e.target.value = '';
                        }
                      }
                    }}
                    className="hidden"
                    data-testid="input-custom-image"
                    disabled={uploadingImage}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="custom-message" className="text-xs font-medium">
                    Message <span className="text-muted-foreground">({"{CLIENT_NAME}"}, {"{AGENT_NAME}"})</span>
                  </label>
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid="button-emoji-picker">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Picker
                        data={data}
                        onEmojiSelect={(emoji: any) => {
                          const textarea = textareaRef.current;
                          if (textarea) {
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const text = formData.customMessage;
                            const newText = text.substring(0, start) + emoji.native + text.substring(end);
                            setFormData({ ...formData, customMessage: newText });
                            if (!isEditing) setIsEditing(true);
                            setTimeout(() => {
                              textarea.focus();
                              textarea.setSelectionRange(start + emoji.native.length, start + emoji.native.length);
                            }, 0);
                          }
                          setShowEmojiPicker(false);
                        }}
                        theme="light"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Textarea
                  ref={textareaRef}
                  id="custom-message"
                  value={formData.customMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setFormData({ ...formData, customMessage: e.target.value });
                    if (!isEditing) setIsEditing(true);
                  }}
                  placeholder="🎉 ¡Feliz Cumpleaños {CLIENT_NAME}! 🎂&#10;&#10;Te deseamos el mejor de los éxitos en este nuevo año de vida.&#10;&#10;Te saluda {AGENT_NAME}, tu agente de seguros. 🎊"
                  rows={5}
                  className="resize-none text-xs"
                  data-testid="textarea-birthday-message"
                />
              </div>

              {/* Manual Process Button */}
              <div className="pt-2">
                <Button
                  onClick={() => processManualBirthdaysMutation.mutate()}
                  disabled={processManualBirthdaysMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="w-full"
                  data-testid="button-process-birthdays-manual"
                >
                  {processManualBirthdaysMutation.isPending ? "Processing..." : "Process Today's Birthdays Now"}
                </Button>
              </div>

              {isEditing && (
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saveSettingsMutation.isPending} size="sm" data-testid="button-save-birthday-settings">
                    {saveSettingsMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={saveSettingsMutation.isPending} size="sm" data-testid="button-cancel-birthday-settings">
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Right: Preview */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Preview</label>
              <div className="border rounded p-2 bg-muted/20">
                <div className="bg-white dark:bg-gray-800 rounded shadow-sm p-2 space-y-1.5">
                  {formData.selectedImageId && (() => {
                    if (formData.selectedImageId.startsWith('data:image') || formData.selectedImageId.startsWith('/uploads/')) {
                      return <img src={formData.selectedImageId} alt="Birthday" className="w-full rounded" data-testid="img-preview-birthday" />;
                    } else {
                      const selectedImage = images.find(img => img.id === formData.selectedImageId);
                      if (selectedImage) {
                        return <img src={selectedImage.imageUrl} alt={selectedImage.name} className="w-full rounded" data-testid="img-preview-birthday" />;
                      }
                    }
                    return null;
                  })()}
                  
                  <div className="text-xs text-foreground whitespace-pre-wrap break-words">
                    {(formData.customMessage || "🎉 ¡Feliz Cumpleaños {CLIENT_NAME}! 🎂\n\nTe deseamos el mejor de los éxitos en este nuevo año de vida.\n\nTe saluda {AGENT_NAME}, tu agente de seguros. 🎊")
                      .replace('{CLIENT_NAME}', 'Juan')
                      .replace('{AGENT_NAME}', currentUser?.firstName || 'María')
                    }
                  </div>
                  
                  <div className="text-[10px] text-muted-foreground text-right">
                    {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Birthday Greeting History */}
      <Card>
        <CardHeader>
          <CardTitle>Birthday Greeting History</CardTitle>
          <CardDescription>
            View all birthday greetings sent automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No birthday greetings have been sent yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Recipient</th>
                      <th className="text-left p-2 font-medium">Phone</th>
                      <th className="text-left p-2 font-medium">Date Sent</th>
                      <th className="text-left p-2 font-medium">Status</th>
                      <th className="text-left p-2 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((greeting) => (
                      <tr key={greeting.id} className="border-b hover:bg-muted/50">
                        <td className="p-2" data-testid={`text-recipient-${greeting.id}`}>
                          {greeting.recipientName}
                        </td>
                        <td className="p-2" data-testid={`text-phone-${greeting.id}`}>
                          {greeting.recipientPhone}
                        </td>
                        <td className="p-2" data-testid={`text-sent-${greeting.id}`}>
                          {new Date(greeting.sentAt).toLocaleString()}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={
                              greeting.status === "delivered" || greeting.status === "sent"
                                ? "default"
                                : greeting.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            data-testid={`badge-status-${greeting.id}`}
                          >
                            {greeting.status}
                          </Badge>
                          {greeting.errorMessage && (
                            <p className="text-xs text-destructive mt-1">
                              {greeting.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className="p-2 max-w-md truncate" data-testid={`text-message-${greeting.id}`}>
                          {greeting.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
