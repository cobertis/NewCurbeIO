import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { 
  Phone, 
  AlertTriangle,
  Plus,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Info,
  Trash2,
  Edit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { 
  formatPhoneNumber, 
  getComplianceStatusBadge, 
  type SmsVoiceNumber, 
  type TelnyxVerificationRequest 
} from "@/pages/sms-voice";

const entityTypeLabels: Record<string, string> = {
  "PRIVATE_PROFIT": "Private Company",
  "PUBLIC_PROFIT": "Publicly Traded Company",
  "NON_PROFIT": "Charity/ Non-Profit Organization",
  "SOLE_PROPRIETOR": "Sole Proprietor",
  "GOVERNMENT": "Government",
};

const verticalLabels: Record<string, string> = {
  "PROFESSIONAL": "Professional Services",
  "REAL_ESTATE": "Real Estate",
  "HEALTHCARE": "Healthcare",
  "HUMAN_RESOURCES": "Human Resources",
  "ENERGY": "Energy",
  "ENTERTAINMENT": "Entertainment",
  "RETAIL": "Retail",
  "TRANSPORTATION": "Transportation",
  "AGRICULTURE": "Agriculture",
  "INSURANCE": "Insurance",
  "POSTAL": "Postal",
  "EDUCATION": "Education",
  "HOSPITALITY": "Hospitality",
  "FINANCIAL": "Financial",
  "POLITICAL": "Political",
  "GAMBLING": "Gambling",
  "LEGAL": "Legal",
  "CONSTRUCTION": "Construction",
  "NGO": "NGO",
  "MANUFACTURING": "Manufacturing",
  "GOVERNMENT": "Government",
  "TECHNOLOGY": "Technology",
  "COMMUNICATION": "Communication",
};

function formatEntityType(value: string | undefined | null): string {
  if (!value) return '-';
  return entityTypeLabels[value] || value;
}

function formatVertical(value: string | undefined | null): string {
  if (!value) return '-';
  return verticalLabels[value] || value;
}

function USFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="18" fill="#B22234"/>
      <rect y="1.38" width="24" height="1.38" fill="white"/>
      <rect y="4.15" width="24" height="1.38" fill="white"/>
      <rect y="6.92" width="24" height="1.38" fill="white"/>
      <rect y="9.69" width="24" height="1.38" fill="white"/>
      <rect y="12.46" width="24" height="1.38" fill="white"/>
      <rect y="15.23" width="24" height="1.38" fill="white"/>
      <rect width="9.6" height="9.69" fill="#3C3B6E"/>
    </svg>
  );
}

export default function SmsVoiceTollFree() {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [, setLocation] = useLocation();

  const { data: numbersData, isLoading } = useQuery<{ numbers: SmsVoiceNumber[] }>({
    queryKey: ["/api/sms-voice/numbers"],
  });

  const { data: verificationData, isLoading: isLoadingVerification } = useQuery<{ verification: TelnyxVerificationRequest }>({
    queryKey: [`/api/telnyx/verification-request/by-phone/${encodeURIComponent(selectedPhoneNumber || '')}`],
    enabled: !!selectedPhoneNumber,
  });

  const { data: complianceAppsData } = useQuery<{ applications: Array<{ id: string; selectedPhoneNumber: string; status: string }> }>({
    queryKey: ["/api/compliance/applications/list"],
  });

  const numbers = numbersData?.numbers || [];
  const tollFreeNumbers = numbers.filter(n => {
    const areaCode = n.phoneNumber.replace(/^\+1/, '').slice(0, 3);
    return ['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
  });

  const filteredNumbers = useMemo(() => {
    if (!searchQuery.trim()) return tollFreeNumbers;
    const query = searchQuery.toLowerCase();
    return tollFreeNumbers.filter(n => 
      n.phoneNumber.toLowerCase().includes(query) ||
      n.ownerName?.toLowerCase().includes(query) ||
      formatPhoneNumber(n.phoneNumber).toLowerCase().includes(query)
    );
  }, [tollFreeNumbers, searchQuery]);

  const totalNumbers = filteredNumbers.length;
  const totalPages = Math.ceil(totalNumbers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalNumbers);
  const paginatedNumbers = filteredNumbers.slice(startIndex, endIndex);

  const verification = verificationData?.verification;
  const complianceApps = complianceAppsData?.applications || [];

  const getComplianceAppByPhone = (phone: string) => {
    return complianceApps.find(app => app.selectedPhoneNumber === phone);
  };

  const handleEditVerification = (phone: string) => {
    const app = getComplianceAppByPhone(phone);
    if (app) {
      setLocation(`/compliance/campaign/${app.id}`);
    }
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading toll-free numbers..." />;
  }

  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-toll-free">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-sms-toll-free">
          <Link href="/settings/sms-voice" className="text-muted-foreground hover:text-foreground transition-colors">SMS & Voice</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Toll-Free Verification</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Link href="/getting-started">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-buy-number">
              <Plus className="h-4 w-4" />
              Buy a new number
            </Button>
          </Link>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search numbers"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 w-64"
              data-testid="input-search-numbers"
            />
          </div>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {paginatedNumbers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                  {searchQuery ? "No matching toll-free numbers" : "No toll-free numbers"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery 
                    ? "Try adjusting your search terms." 
                    : "You don't have any toll-free numbers yet. Purchase a toll-free number to get started."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-xs font-medium text-slate-500">Toll-free number</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Account</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Status</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Next renewal</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNumbers.map((number) => (
                    <TableRow 
                      key={number.id} 
                      className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      data-testid={`row-number-${number.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <USFlagIcon className="h-4 w-5 rounded-sm shadow-sm" />
                          <span 
                            className={cn(
                              "text-blue-600 dark:text-blue-400",
                              number.complianceStatus === "in_review" && "flex items-center gap-1"
                            )}
                            data-testid={`text-phone-${number.id}`}
                          >
                            {formatPhoneNumber(number.phoneNumber)}
                            {number.complianceStatus === "in_review" && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                            {(number.ownerName || "U").charAt(0).toUpperCase()}
                          </div>
                          <span>{number.ownerName || "Unassigned"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getComplianceStatusBadge(number.complianceStatus)}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-renewal-${number.id}`}>
                        {number.purchasedAt 
                          ? format(addMonths(new Date(number.purchasedAt), 12), "d MMM yyyy")
                          : format(addMonths(new Date(), 12), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {number.complianceStatus && number.complianceStatus !== "unverified" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPhoneNumber(number.phoneNumber)}
                              data-testid={`button-view-form-${number.id}`}
                            >
                              View form
                            </Button>
                          ) : (
                            <Link href="/compliance">
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-verify-${number.id}`}
                              >
                                Verify Now
                              </Button>
                            </Link>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                data-testid={`button-actions-${number.id}`}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => setSelectedPhoneNumber(number.phoneNumber)}
                                data-testid={`menu-view-details-${number.id}`}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEditVerification(number.phoneNumber)}
                                data-testid={`menu-edit-${number.id}`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit verification
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600 dark:text-red-400"
                                data-testid={`menu-release-${number.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Release number
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalNumbers > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span data-testid="text-pagination-info">
                {startIndex + 1}-{endIndex} of {totalNumbers} number{totalNumbers !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>Show on page</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20 h-8" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="h-3 w-3 text-white" />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                10DLC and toll-free messaging registration is <strong>an industry-wide requirement</strong>. 
                The industry is moving to <strong>100% registered messaging traffic</strong> to fight spam and fraud. 
                Registration cannot be skipped.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Toll-free FAQ</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Haven't found what you were looking for?{" "}
              <a 
                href="/support" 
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                data-testid="link-contact-us"
              >
                Contact us
              </a>
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-why-tollfree">
                When and why choose a toll-free number for texting?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                Toll-free numbers are ideal for businesses that need to send high volumes of messages with a recognizable, professional identity. 
                They provide national reach and don't require 10DLC registration, making them a good choice for marketing campaigns, 
                customer notifications, and two-factor authentication.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-10dlc-difference">
                What is the difference between 10DLC and toll-free numbers?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                10DLC (10-Digit Long Code) numbers are standard local phone numbers used for A2P (Application-to-Person) messaging. 
                They require brand and campaign registration. Toll-free numbers (800, 833, 844, etc.) have their own verification process 
                and are better suited for high-volume messaging with nationwide coverage.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-why-verify">
                Why do I need to complete a toll-free number verification?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                Toll-free verification is required by carriers to ensure legitimate messaging practices and reduce spam. 
                Unverified toll-free numbers may face message filtering, blocking, or reduced throughput. 
                Verification helps establish trust with carriers and improves message deliverability.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-info-required">
                What information is required for the toll-free verification?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                You'll need to provide: business name and type, business address, contact information, 
                website URL, use case description, sample messages, opt-in method description, 
                and volume estimates. Having accurate and complete information helps speed up the approval process.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-how-long">
                How long will it take to complete the verification?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                The verification process typically takes 2-7 business days, depending on the completeness of your application 
                and the volume of requests being processed. Some applications may require additional information, 
                which can extend the timeline. You'll receive updates on your verification status via email.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Dialog open={!!selectedPhoneNumber} onOpenChange={(open) => !open && setSelectedPhoneNumber(null)}>
          <DialogContent className="max-w-4xl max-h-[95vh]" aria-describedby="verification-form-description">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Verification Details - {selectedPhoneNumber ? formatPhoneNumber(selectedPhoneNumber) : ''}
              </DialogTitle>
            </DialogHeader>
            <p id="verification-form-description" className="sr-only">
              View the verification form details for this phone number
            </p>
            
            <ScrollArea className="max-h-[85vh] pr-4">
              {isLoadingVerification ? (
                <div className="py-8">
                  <LoadingSpinner fullScreen={false} message="Loading verification details..." />
                </div>
              ) : verification ? (
                <div className="space-y-6">
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    1. Brand details
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Brand ID
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.id || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Legal organization name
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.business_name || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            DBA or Brand name
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.brand_display_name || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Organization type
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {formatEntityType(verification.business_type)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Organization website
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.website_url ? (
                              <a href={verification.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                                {verification.website_url}
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Vertical type
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {formatVertical(verification.business_vertical)}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Organization address
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {[verification.street_address, verification.city, verification.region, verification.postal_code]
                              .filter(Boolean)
                              .join(', ') || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Contact person
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {[verification.first_name, verification.last_name].filter(Boolean).join(' ') || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Contact phone number
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.contact_phone || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Contact e-mail address
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.contact_email || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Status
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900">
                            {getComplianceStatusBadge(verification.verification_status || null)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-6">
                    2. Campaign details
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Use case
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.use_case || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Campaign name
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            -
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                            Campaign description
                          </td>
                          <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {verification.campaign_description || '-'}
                          </td>
                        </tr>
                        {verification.sample_messages && verification.sample_messages.length > 0 && verification.sample_messages.map((msg, idx) => (
                          <tr key={idx} className={idx < verification.sample_messages!.length - 1 ? "border-b border-slate-200 dark:border-slate-700" : ""}>
                            <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                              Sample message {idx + 1}
                            </td>
                            <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {msg}
                            </td>
                          </tr>
                        ))}
                        {(!verification.sample_messages || verification.sample_messages.length === 0) && (
                          <tr>
                            <td className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium text-right w-[180px] align-top">
                              Sample message 1
                            </td>
                            <td className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              -
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Verification data not found for this phone number.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                    This number may not have a verification request submitted yet.
                  </p>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </SettingsLayout>
  );
}
