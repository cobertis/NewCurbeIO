import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Building2, Bell, Shield, Mail, Pencil, Phone as PhoneIcon, AtSign, Briefcase, MapPin, Globe, ChevronsUpDown, Check } from "lucide-react";
import type { User, CompanySettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmailTemplatesManager } from "@/components/email-templates-manager";
import { formatPhoneDisplay, formatPhoneE164, formatPhoneInput } from "@/lib/phone-formatter";
import { cn } from "@/lib/utils";

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

export default function Settings() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: preferencesData, isLoading: isLoadingPreferences } = useQuery<{ preferences: any }>({
    queryKey: ["/api/settings/preferences"],
  });

  const { data: companySettingsData, isLoading: isLoadingCompanySettings } = useQuery<{ settings: CompanySettings }>({
    queryKey: ["/api/settings/company"],
    enabled: userData?.user?.role === "admin" || userData?.user?.role === "superadmin",
  });

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery<{ subscription: any }>({
    queryKey: ["/api/billing/subscription"],
  });

  const { data: plansData, isLoading: isLoadingPlans } = useQuery<{ plans: any[] }>({
    queryKey: ["/api/plans"],
  });

  const [emailTestAddress, setEmailTestAddress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Company Information refs
  const companyNameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const businessCategoryRef = useRef<HTMLInputElement>(null);
  const businessNicheRef = useRef<HTMLInputElement>(null);
  const companyEmailRef = useRef<HTMLInputElement>(null);
  const companyPhoneRef = useRef<HTMLInputElement>(null);
  const websiteRef = useRef<HTMLInputElement>(null);
  const timezoneRef = useRef<HTMLInputElement>(null);
  const platformLanguageRef = useRef<HTMLInputElement>(null);
  
  // Physical Address refs
  const addressRef = useRef<HTMLInputElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const postalCodeRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  
  // Branding refs
  const logoRef = useRef<HTMLInputElement>(null);
  const domainRef = useRef<HTMLInputElement>(null);
  
  // Combobox state
  const [openCategory, setOpenCategory] = useState(false);
  const [openNiche, setOpenNiche] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedNiche, setSelectedNiche] = useState("");
  
  const user = userData?.user;

  // Fetch company data if user has a companyId
  const { data: companyData, isLoading: isLoadingCompany } = useQuery<{ company: any }>({
    queryKey: ["/api/companies", user?.companyId],
    enabled: !!user?.companyId,
  });
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Check if critical data is still loading
  const isLoadingCriticalData = isLoadingUser || isLoadingPreferences || isLoadingSubscription || isLoadingPlans || (user?.companyId && isLoadingCompany);

  // Get current plan name
  const getCurrentPlanName = () => {
    if (!subscriptionData?.subscription) return "Free";
    const subscription = subscriptionData.subscription;
    
    // If subscription has plan object
    if (subscription.plan?.name) {
      return subscription.plan.name;
    }
    
    // Otherwise find plan by ID
    if (subscription.planId && plansData?.plans) {
      const plan = plansData.plans.find((p: any) => p.id === subscription.planId);
      return plan?.name || "Free";
    }
    
    return "Free";
  };

  // Determine active tab from URL
  const getCurrentTab = () => {
    if (location === "/settings" || location === "/settings/profile") return "profile";
    if (location === "/settings/preferences") return "preferences";
    if (location === "/settings/company") return "company";
    if (location === "/settings/system") return "system";
    if (location === "/settings/security") return "security";
    return "profile"; // default
  };

  const activeTab = getCurrentTab();

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
        phone: user.phone ? formatPhoneDisplay(user.phone) : "",
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
    }
  }, [companyData]);

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
        dataToSend.phone = formatPhoneE164(data.phone);
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

  // Handler for Profile Information form
  const handleProfileInfoSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateProfileInfoMutation.mutate(profileForm);
  };

  // Handler for Insurance Profile Information form
  const handleInsuranceProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateInsuranceProfileMutation.mutate(insuranceForm);
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
      const response = await apiRequest("PATCH", "/api/settings/profile", { avatar });
      return response.json();
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
  });

  // Handler for Company Information Save
  const handleSaveCompanyInformation = () => {
    const data: any = {};
    
    if (companyNameRef.current?.value) data.name = companyNameRef.current.value;
    if (slugRef.current?.value) data.slug = slugRef.current.value;
    if (businessCategoryRef.current?.value) data.businessCategory = businessCategoryRef.current.value;
    if (businessNicheRef.current?.value) data.businessNiche = businessNicheRef.current.value;
    if (companyEmailRef.current?.value) data.email = companyEmailRef.current.value;
    if (companyPhoneRef.current?.value) data.phone = companyPhoneRef.current.value;
    if (websiteRef.current?.value) data.website = websiteRef.current.value;
    if (timezoneRef.current?.value) data.timezone = timezoneRef.current.value;
    if (platformLanguageRef.current?.value) data.platformLanguage = platformLanguageRef.current.value;
    
    updateCompanyMutation.mutate(data);
  };

  // Handler for Physical Address Save
  const handleSavePhysicalAddress = () => {
    const data: any = {};
    
    if (addressRef.current?.value) data.address = addressRef.current.value;
    if (addressLine2Ref.current?.value) data.addressLine2 = addressLine2Ref.current.value;
    if (cityRef.current?.value) data.city = cityRef.current.value;
    if (stateRef.current?.value) data.state = stateRef.current.value;
    if (postalCodeRef.current?.value) data.postalCode = postalCodeRef.current.value;
    if (countryRef.current?.value) data.country = countryRef.current.value;
    
    updateCompanyMutation.mutate(data);
  };

  // Handler for Branding Save
  const handleSaveBranding = () => {
    const data: any = {};
    
    if (logoRef.current?.value) data.logo = logoRef.current.value;
    if (domainRef.current?.value) data.domain = domainRef.current.value;
    
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
    return (
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Profile Card Skeleton */}
          <div className="lg:col-span-4 xl:col-span-3">
            <Card className="sticky top-6">
              <CardHeader className="text-center pb-4">
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="text-center w-full space-y-2">
                    <Skeleton className="h-6 w-32 mx-auto" />
                    <Skeleton className="h-5 w-24 mx-auto" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 border-t">
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-4 w-4 mt-1" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Settings Tabs Skeleton */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="space-y-6">
              <Skeleton className="h-10 w-full" />
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
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
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Profile Card */}
        <div className="lg:col-span-4 xl:col-span-3">
          <Card className="sticky top-6">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* Top Section - Avatar and Name */}
                <div className="flex gap-4 items-start">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div 
                      className="relative group cursor-pointer"
                      onClick={handleAvatarClick}
                      data-testid="button-change-avatar"
                    >
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={user?.avatar || ""} alt={user?.firstName || ""} />
                        <AvatarFallback className="text-2xl">{getUserInitials()}</AvatarFallback>
                      </Avatar>
                      {/* Overlay with pencil icon that appears on hover */}
                      <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Pencil className="h-6 w-6 text-white" />
                      </div>
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>

                  {/* Name, Email, Phone, and Role */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold mb-2">
                      {user?.firstName} {user?.lastName}
                    </h2>

                    {/* Email and Phone - Compact */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm truncate">{user?.email}</p>
                      </div>

                      {user?.phone && (
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <p className="text-sm">{formatPhoneDisplay(user.phone)}</p>
                        </div>
                      )}
                    </div>

                    {/* Role Badge */}
                    <Badge variant="secondary" className="mt-3">
                      {getRoleDisplay()}
                    </Badge>
                  </div>
                </div>

                {/* Business Profile and Status Section */}
                <div className="space-y-4">
                  {/* Business Profile Section */}
                  {(user?.companyId || companyData?.company?.phone || companyData?.company?.website || companyData?.company?.address) && (
                    <div className="pt-6 border-t">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Business Profile</h3>
                      <div className="space-y-3">
                        {/* Company */}
                        {user?.companyId && (
                          <div className="flex items-start gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Company</p>
                              <p className="text-sm font-medium">{companyData?.company?.name || user.companyId}</p>
                            </div>
                          </div>
                        )}

                        {/* Company Phone */}
                        {companyData?.company?.phone && (
                          <div className="flex items-start gap-3">
                            <PhoneIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Phone</p>
                              <p className="text-sm font-medium">{formatPhoneDisplay(companyData.company.phone)}</p>
                            </div>
                          </div>
                        )}

                        {/* Website */}
                        {companyData?.company?.website && (
                          <div className="flex items-start gap-3">
                            <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Website</p>
                              <a 
                                href={companyData.company.website.startsWith('http') ? companyData.company.website : `https://${companyData.company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-primary hover:underline truncate block"
                                data-testid="link-company-website"
                              >
                                {companyData.company.website}
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Address */}
                        {companyData?.company?.address && (
                          <div className="flex items-start gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Address</p>
                              <div className="text-sm font-medium space-y-0.5">
                                <p>{companyData.company.address}</p>
                                {companyData.company.addressLine2 && (
                                  <p>{companyData.company.addressLine2}</p>
                                )}
                                <p>
                                  {companyData.company.city}
                                  {companyData.company.state && `, ${companyData.company.state}`}
                                  {companyData.company.postalCode && ` ${companyData.company.postalCode}`}
                                </p>
                                {companyData.company.country && (
                                  <p>{companyData.company.country}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status and Plan */}
                  <div className="pt-4 border-t">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className={`text-sm font-semibold ${getStatusColor()}`}>{getStatusDisplay()}</p>
                      </div>
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="text-sm font-semibold">{getCurrentPlanName()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Settings Tabs */}
        <div className="lg:col-span-8 xl:col-span-9">
          <Tabs value={activeTab} onValueChange={(value) => setLocation(`/settings/${value}`)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 lg:w-auto">
              <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
                <UserIcon className="h-4 w-4" />
                Profile
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="company" className="gap-2" data-testid="tab-company">
                  <Building2 className="h-4 w-4" />
                  Company
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="preferences" className="gap-2" data-testid="tab-preferences">
                <Bell className="h-4 w-4" />
                Preferences
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="system" className="gap-2" data-testid="tab-system">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
              )}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Profile Information Card */}
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                    <div className="space-y-1.5">
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>
                        Update your personal information and contact details.
                      </CardDescription>
                    </div>
                    <Button
                      type="submit"
                      form="profile-info-form"
                      disabled={updateProfileInfoMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      {updateProfileInfoMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <form id="profile-info-form" onSubmit={handleProfileInfoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
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
                        <Label htmlFor="lastName">Last Name</Label>
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
                        <Label htmlFor="email">Email</Label>
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
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+1 (415) 555-2671"
                          value={profileForm.phone || ""}
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            setProfileForm({ ...profileForm, phone: formatted });
                          }}
                          data-testid="input-phone-settings"
                        />
                        <p className="text-xs text-muted-foreground">Format: +1 (415) 555-2671. Required for SMS two-factor authentication</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          name="dateOfBirth"
                          type="date"
                          value={profileForm.dateOfBirth}
                          onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                          data-testid="input-date-of-birth"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preferredLanguage">Preferred Language</Label>
                        <select
                          id="preferredLanguage"
                          name="preferredLanguage"
                          value={profileForm.preferredLanguage}
                          onChange={(e) => setProfileForm({ ...profileForm, preferredLanguage: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-preferred-language"
                        >
                          <option value="en">English</option>
                          <option value="es">Spanish</option>
                          <option value="fr">French</option>
                          <option value="de">German</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          name="company"
                          value={companyData?.company?.name || ""}
                          disabled
                          className="bg-muted"
                          data-testid="input-company"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Input
                          id="role"
                          name="role"
                          value={getRoleDisplay()}
                          disabled
                          className="bg-muted"
                          data-testid="input-role"
                        />
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Insurance Profile Information Card */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="space-y-1.5">
                    <CardTitle>Insurance Profile Information</CardTitle>
                    <CardDescription>
                      This is a code assigned by your agency
                    </CardDescription>
                  </div>
                  <Button
                    type="submit"
                    form="insurance-profile-form"
                    disabled={updateInsuranceProfileMutation.isPending}
                    data-testid="button-save-insurance"
                  >
                    {updateInsuranceProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </CardHeader>
                <CardContent>
                  <form id="insurance-profile-form" onSubmit={handleInsuranceProfileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="agentInternalCode">
                          Agent internal code
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="ml-2 text-muted-foreground cursor-help">ⓘ</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>This is a code assigned by your agency</p>
                            </TooltipContent>
                          </Tooltip>
                        </Label>
                        <Input
                          id="agentInternalCode"
                          name="agentInternalCode"
                          placeholder="Enter an internal code"
                          value={insuranceForm.agentInternalCode || ""}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, agentInternalCode: e.target.value })}
                          data-testid="input-agent-internal-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="instructionLevel">Instruction level</Label>
                        <select
                          id="instructionLevel"
                          name="instructionLevel"
                          value={insuranceForm.instructionLevel || ""}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, instructionLevel: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid="select-instruction-level"
                        >
                          <option value="">Select instruction level</option>
                          <option value="Licensed insurance agent">Licensed insurance agent</option>
                          <option value="Broker">Broker</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nationalProducerNumber">National Producer Number (NPN)</Label>
                        <Input
                          id="nationalProducerNumber"
                          name="nationalProducerNumber"
                          type="text"
                          placeholder="17925766"
                          value={insuranceForm.nationalProducerNumber || ""}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                              setInsuranceForm({ ...insuranceForm, nationalProducerNumber: value });
                            }
                          }}
                          maxLength={10}
                          data-testid="input-national-producer-number"
                        />
                        <p className="text-xs text-muted-foreground">6-10 digits only</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="federallyFacilitatedMarketplace">Federally Facilitated Marketplace (FFM)</Label>
                        <Input
                          id="federallyFacilitatedMarketplace"
                          name="federallyFacilitatedMarketplace"
                          placeholder="Enter an FFM"
                          value={insuranceForm.federallyFacilitatedMarketplace || ""}
                          onChange={(e) => setInsuranceForm({ ...insuranceForm, federallyFacilitatedMarketplace: e.target.value })}
                          data-testid="input-ffm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="referredBy">Referred by</Label>
                      <Input
                        id="referredBy"
                        name="referredBy"
                        placeholder="Enter a referred"
                        value={insuranceForm.referredBy || ""}
                        onChange={(e) => setInsuranceForm({ ...insuranceForm, referredBy: e.target.value })}
                        data-testid="input-referred-by"
                      />
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
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

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account with SMS verification.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="twoFactorEnabled" className="text-base">
                        Enable 2FA
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {user?.twoFactorEnabled 
                          ? "Two-factor authentication is currently enabled on your account"
                          : "Secure your account with SMS-based two-factor authentication"}
                      </p>
                    </div>
                    <Switch
                      id="twoFactorEnabled"
                      checked={user?.twoFactorEnabled || false}
                      disabled={!user?.phone}
                      data-testid="switch-two-factor"
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
                            Phone number required
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage your active sessions and devices.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium">Current Session</p>
                        <p className="text-sm text-muted-foreground">
                          This device • Active now
                        </p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <Button variant="outline" className="w-full" data-testid="button-sign-out-all">
                      Sign Out of All Other Sessions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>
                    Choose which notifications you want to receive.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                      <Label htmlFor="marketingEmails" className="text-base">
                        Marketing Emails
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive emails about new features and updates.
                      </p>
                    </div>
                    <Switch
                      id="marketingEmails"
                      checked={preferencesData?.preferences?.marketingEmails || false}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          marketingEmails: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-marketing-emails"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="invoiceAlerts" className="text-base">
                        Invoice Alerts
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications when new invoices are generated.
                      </p>
                    </div>
                    <Switch
                      id="invoiceAlerts"
                      checked={preferencesData?.preferences?.invoiceAlerts ?? true}
                      onCheckedChange={(checked) => {
                        updatePreferencesMutation.mutate({
                          ...preferencesData?.preferences,
                          invoiceAlerts: checked,
                        });
                      }}
                      disabled={updatePreferencesMutation.isPending}
                      data-testid="switch-invoice-alerts"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Company Settings Tab */}
            {isAdmin && (
              <TabsContent value="company" className="space-y-4">
                {/* Company Information */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Company Information</CardTitle>
                      <CardDescription>
                        Basic company details and contact information
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSaveCompanyInformation}
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-company-information"
                    >
                      {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name</Label>
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
                        <Label htmlFor="businessCategory">Business Category</Label>
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
                                      // Find the original category value (CommandItem lowercases it)
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
                        <Label htmlFor="businessNiche">Business Niche</Label>
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
                                        // Find the original niche value (CommandItem lowercases it)
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
                        <Label htmlFor="companyEmail">Company Email</Label>
                        <Input
                          id="companyEmail"
                          ref={companyEmailRef}
                          type="email"
                          defaultValue={companyData?.company?.email || ""}
                          data-testid="input-company-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyPhone">Company Phone</Label>
                        <Input
                          id="companyPhone"
                          ref={companyPhoneRef}
                          type="tel"
                          defaultValue={companyData?.company?.phone || ""}
                          data-testid="input-company-phone"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        ref={websiteRef}
                        type="url"
                        placeholder="https://example.com"
                        defaultValue={companyData?.company?.website || ""}
                        data-testid="input-website"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input
                        id="timezone"
                        ref={timezoneRef}
                        defaultValue={companyData?.company?.timezone || "UTC"}
                        data-testid="input-timezone"
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
                  </CardContent>
                </Card>

                {/* Physical Address */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Physical Address</CardTitle>
                      <CardDescription>
                        Company address and location details
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSavePhysicalAddress}
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-physical-address"
                    >
                      {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input
                        id="address"
                        ref={addressRef}
                        defaultValue={companyData?.company?.address || ""}
                        data-testid="input-address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="addressLine2">Address Line 2</Label>
                      <Input
                        id="addressLine2"
                        ref={addressLine2Ref}
                        placeholder="Suite, Apt, Unit, etc."
                        defaultValue={companyData?.company?.addressLine2 || ""}
                        data-testid="input-address-line-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          ref={cityRef}
                          defaultValue={companyData?.company?.city || ""}
                          data-testid="input-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State / Province</Label>
                        <Input
                          id="state"
                          ref={stateRef}
                          defaultValue={companyData?.company?.state || ""}
                          data-testid="input-state"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          ref={postalCodeRef}
                          defaultValue={companyData?.company?.postalCode || ""}
                          data-testid="input-postal-code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          ref={countryRef}
                          defaultValue={companyData?.company?.country || "United States"}
                          data-testid="input-country"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Branding */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div className="space-y-1">
                      <CardTitle>Branding</CardTitle>
                      <CardDescription>
                        Company logo and visual identity
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleSaveBranding}
                      disabled={updateCompanyMutation.isPending}
                      data-testid="button-save-branding"
                    >
                      {updateCompanyMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo">Logo URL</Label>
                        <Input
                          id="logo"
                          ref={logoRef}
                          type="url"
                          placeholder="https://example.com/logo.png"
                          defaultValue={companyData?.company?.logo || ""}
                          data-testid="input-logo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="domain">Custom Domain</Label>
                        <Input
                          id="domain"
                          ref={domainRef}
                          placeholder="app.example.com"
                          defaultValue={companyData?.company?.domain || ""}
                          data-testid="input-domain"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* System Settings Tab (Superadmin only) */}
            {isSuperAdmin && (
              <TabsContent value="system" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Email and SMTP Configuration</CardTitle>
                      <CardDescription>
                        Configure system email notification settings.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Email and SMTP configuration settings will be displayed here.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
