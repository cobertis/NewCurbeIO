import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Trash2,
  Edit,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { 
  formatPhoneNumber, 
  type SmsVoiceNumber 
} from "@/pages/sms-voice";

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

export default function SmsVoice10dlc() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isSuperAdmin = user?.role === "superadmin";

  const { data: numbersData, isLoading } = useQuery<{ numbers: SmsVoiceNumber[] }>({
    queryKey: ["/api/sms-voice/numbers"],
  });

  interface Brand {
    id: string;
    brandId: string;
    tcrBrandId?: string;
    displayName: string;
    companyName: string;
    email?: string;
    entityType?: string;
    vertical?: string;
    status: string;
    identityStatus?: string;
    country?: string;
    website?: string;
    createdAt?: string;
  }
  
  const { data: brandsData, isLoading: isLoadingBrands } = useQuery<Brand[]>({
    queryKey: ["/api/phone-system/brands"],
  });

  const primaryBrand = brandsData?.[0];

  const numbers = numbersData?.numbers || [];
  const localNumbers = numbers.filter(n => {
    const areaCode = n.phoneNumber.replace(/^\+1/, '').slice(0, 3);
    return !['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
  });

  const filteredNumbers = useMemo(() => {
    if (!searchQuery.trim()) return localNumbers;
    const query = searchQuery.toLowerCase();
    return localNumbers.filter(n => 
      n.phoneNumber.toLowerCase().includes(query) ||
      n.ownerName?.toLowerCase().includes(query) ||
      formatPhoneNumber(n.phoneNumber).toLowerCase().includes(query)
    );
  }, [localNumbers, searchQuery]);

  const totalNumbers = filteredNumbers.length;
  const totalPages = Math.ceil(totalNumbers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalNumbers);
  const paginatedNumbers = filteredNumbers.slice(startIndex, endIndex);

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading 10DLC numbers..." />;
  }

  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-10dlc">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/settings" className="hover:text-slate-700 dark:hover:text-slate-300">
            Settings
          </Link>
          <span>&gt;</span>
          <Link href="/settings/sms-voice" className="hover:text-slate-700 dark:hover:text-slate-300">
            SMS & voice
          </Link>
          <span>&gt;</span>
          <span className="text-slate-700 dark:text-slate-300">10DLC registration</span>
        </div>

        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
            10DLC registration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            To send messages, you need to buy a virtual number, verify your use case, and get approved by the mobile network operators. Once your traffic has been approved, you can send and receive SMS, and make voice calls.{" "}
            <a 
              href="https://support.telnyx.com/en/articles/4131500-10dlc-registration-guide" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
              data-testid="link-learn-more"
            >
              Learn more about 10DLC
            </a>
          </p>
        </div>

        {!isSuperAdmin && (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="py-6">
              {isLoadingBrands ? (
                <div className="py-8">
                  <LoadingSpinner fullScreen={false} message="Loading brand information..." />
                </div>
              ) : primaryBrand ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Registered Brand
                    </h2>
                    <span className={cn(
                      "px-2.5 py-0.5 text-xs font-medium rounded-full",
                      primaryBrand.status === "verified" || primaryBrand.status === "VERIFIED" 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : primaryBrand.status === "pending" || primaryBrand.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {primaryBrand.status}
                    </span>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium w-[160px]">
                            Brand Name
                          </td>
                          <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {primaryBrand.displayName || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            Company Name
                          </td>
                          <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {primaryBrand.companyName || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            Brand ID
                          </td>
                          <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs">
                            {primaryBrand.brandId || '-'}
                          </td>
                        </tr>
                        {primaryBrand.tcrBrandId && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                              TCR Brand ID
                            </td>
                            <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs">
                              {primaryBrand.tcrBrandId}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            Entity Type
                          </td>
                          <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {primaryBrand.entityType || '-'}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            Vertical
                          </td>
                          <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {primaryBrand.vertical || '-'}
                          </td>
                        </tr>
                        {primaryBrand.website && (
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                              Website
                            </td>
                            <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              <a href={primaryBrand.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                                {primaryBrand.website}
                              </a>
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            Identity Status
                          </td>
                          <td className="px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                            {primaryBrand.identityStatus || '-'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/compliance/10dlc">
                      <Button variant="outline" size="sm" data-testid="button-manage-brand">
                        Manage brand
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
                  <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <FileText className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Get started with 10DLC
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                      10-digit local U.S. numbers approved by the mobile network operators for sending texts.
                    </p>
                  </div>
                  <Link href="/compliance/10dlc">
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-register-brand"
                    >
                      Register brand and campaign
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            10DLC numbers
          </h2>

          <div className="flex items-center justify-between gap-4">
            <Link href="/phone/buy">
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
                    {searchQuery ? "No matching 10DLC numbers" : "No 10DLC numbers"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {searchQuery 
                      ? "Try adjusting your search terms." 
                      : "You don't have any 10DLC numbers yet. Purchase a local number to get started."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 dark:border-slate-800">
                      <TableHead className="text-xs font-medium text-slate-500">Textmagic number</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Account</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Linked to campaign</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Status</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Next renewal</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 text-right"></TableHead>
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
                              className="text-blue-600 dark:text-blue-400 flex items-center gap-1"
                              data-testid={`text-phone-${number.id}`}
                            >
                              {formatPhoneNumber(number.phoneNumber)}
                              {(!number.complianceStatus || number.complianceStatus === "unverified") && (
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
                        <TableCell className="text-slate-500 dark:text-slate-400">
                          -
                        </TableCell>
                        <TableCell className="text-slate-500 dark:text-slate-400">
                          -
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-renewal-${number.id}`}>
                          {number.purchasedAt 
                            ? format(addMonths(new Date(number.purchasedAt), 12), "d MMM yyyy")
                            : format(addMonths(new Date(), 12), "d MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
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
                              <DropdownMenuItem data-testid={`menu-view-details-${number.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuItem data-testid={`menu-edit-${number.id}`}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit settings
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
                  <SelectTrigger className="w-24 h-8" data-testid="select-page-size">
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
        </div>

        <div className="space-y-4 pt-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">10DLC FAQ</h2>
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
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-why-10dlc">
                When and why choose a local 10DLC number for texting?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                10DLC (10-Digit Long Code) is ideal for businesses sending A2P (Application-to-Person) messages using local phone numbers. 
                It offers better deliverability, higher throughput, and carrier trust compared to unregistered long codes. 
                10DLC is required for businesses sending SMS/MMS in the United States using local numbers.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-10dlc-registration">
                How do I register my brand and campaign for 10DLC?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                To register for 10DLC, you need to complete a two-step process: First, register your brand (business) with The Campaign Registry (TCR). 
                Then, register your messaging campaign describing how you'll use SMS. After approval, you can associate your 10DLC numbers with your campaign.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-10dlc-time">
                How long does 10DLC registration take?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                Brand registration is typically approved within 24-48 hours. Campaign registration can take 1-7 business days depending on the use case. 
                Standard campaigns (marketing, notifications) are usually faster. Special use cases like political messaging may require additional vetting.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-10dlc-cost">
                What are the costs associated with 10DLC?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                10DLC registration involves a one-time brand registration fee and monthly campaign fees. 
                The exact costs depend on your carrier and messaging volume. Additional per-message fees may apply. 
                Contact our sales team for specific pricing based on your needs.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5" className="border-slate-200 dark:border-slate-800">
              <AccordionTrigger className="text-sm text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="accordion-10dlc-vs-tollfree">
                What's the difference between 10DLC and toll-free numbers?
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                10DLC uses local area codes and requires brand/campaign registration, while toll-free numbers (800, 833, etc.) have their own verification process. 
                10DLC is better for local presence and personalized messaging. Toll-free is ideal for high-volume national campaigns and provides a professional, recognizable identity.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </SettingsLayout>
  );
}
