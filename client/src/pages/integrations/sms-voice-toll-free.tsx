import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { 
  Phone, 
  Mail, 
  Settings, 
  Building, 
  CreditCard, 
  Users, 
  Zap, 
  Plug, 
  User as UserIcon,
  MessageSquare,
  AlertTriangle,
  Ticket,
  ListTodo,
  DollarSign,
  Sparkles,
  ArrowLeft,
  Plus,
  ExternalLink,
  X
} from "lucide-react";
import { SiWhatsapp, SiFacebook, SiInstagram } from "react-icons/si";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  formatPhoneNumber, 
  getComplianceStatusBadge, 
  type SmsVoiceNumber, 
  type TelnyxVerificationRequest 
} from "@/pages/sms-voice";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  hasWarning?: boolean;
}

function NavigationLink({ item, onClick }: { item: NavigationItem; onClick: (href: string) => void }) {
  return (
    <button
      onClick={() => onClick(item.href)}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
        item.active && "border-l-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
      )}
    >
      <item.icon className="h-4 w-4" />
      <span className="flex-1 text-left">{item.label}</span>
      {item.hasWarning && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
    </button>
  );
}

export default function SmsVoiceTollFree() {
  const [, setLocation] = useLocation();
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null);

  const { data: numbersData, isLoading } = useQuery<{ numbers: SmsVoiceNumber[] }>({
    queryKey: ["/api/sms-voice/numbers"],
  });

  const { data: verificationData, isLoading: isLoadingVerification } = useQuery<{ verification: TelnyxVerificationRequest }>({
    queryKey: [`/api/telnyx/verification-request/by-phone/${encodeURIComponent(selectedPhoneNumber || '')}`],
    enabled: !!selectedPhoneNumber,
  });

  const numbers = numbersData?.numbers || [];
  const tollFreeNumbers = numbers.filter(n => {
    const areaCode = n.phoneNumber.replace(/^\+1/, '').slice(0, 3);
    return ['800', '833', '844', '855', '866', '877', '888'].includes(areaCode);
  });
  const verification = verificationData?.verification;

  const menuItems: { channels: NavigationItem[]; features: NavigationItem[]; administration: NavigationItem[] } = {
    channels: [
      { label: "SMS & voice", href: "/integrations/sms-voice", icon: Phone, active: true },
      { label: "Email", href: "/settings/email", icon: Mail },
      { label: "Chat widget", href: "/integrations", icon: MessageSquare },
      { label: "WhatsApp", href: "/integrations", icon: SiWhatsapp },
      { label: "Facebook", href: "/integrations", icon: SiFacebook },
      { label: "Instagram", href: "/integrations", icon: SiInstagram },
    ],
    features: [
      { label: "Messenger", href: "/inbox", icon: MessageSquare },
      { label: "Contacts", href: "/contacts", icon: Users },
      { label: "API & Integrations", href: "/integrations", icon: Plug },
      { label: "Email to SMS", href: "/settings/email-to-sms", icon: Mail },
      { label: "Auto-responders", href: "/campaigns", icon: Zap },
      { label: "Tickets", href: "/tickets", icon: Ticket },
      { label: "Tasks", href: "/tasks", icon: ListTodo },
      { label: "Deals", href: "/deals", icon: DollarSign },
      { label: "Point AI", href: "/ai-assistant", icon: Sparkles },
    ],
    administration: [
      { label: "Workspace", href: "/settings/company", icon: Building },
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "My account", href: "/settings/profile", icon: UserIcon },
    ],
  };

  const handleNavigation = (href: string) => {
    setLocation(href);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading toll-free numbers..." />;
  }

  return (
    <div className="flex gap-6" data-testid="page-sms-voice-toll-free">
      <div className="w-60 shrink-0 hidden lg:block">
        <div className="sticky top-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Settings</span>
          </div>

          <div className="py-2">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Channels</p>
            {menuItems.channels.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>

          <div className="py-2">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Features</p>
            {menuItems.features.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>

          <div className="py-2 pb-3">
            <p className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
            {menuItems.administration.map((item) => (
              <NavigationLink key={item.label} item={item} onClick={handleNavigation} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/integrations/sms-voice">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-sms-voice">
              <ArrowLeft className="h-4 w-4" />
              Back to SMS & Voice
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-testid="text-page-title">
              Toll-Free Verification
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Verify and manage your toll-free numbers to ensure compliance and enhance your business's credibility.
            </p>
          </div>
          <Link href="/compliance">
            <Button size="sm" className="gap-2" data-testid="button-new-verification">
              <Plus className="h-4 w-4" />
              New Verification
            </Button>
          </Link>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {tollFreeNumbers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                  No toll-free numbers
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  You don't have any toll-free numbers yet. Purchase a toll-free number to get started.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-xs font-medium text-slate-500">Phone Number</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Owner</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Monthly Fee</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Status</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tollFreeNumbers.map((number) => (
                    <TableRow 
                      key={number.id} 
                      className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      data-testid={`row-number-${number.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span data-testid={`text-phone-${number.id}`}>
                            {formatPhoneNumber(number.phoneNumber)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {number.ownerName || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        ${number.monthlyFee}/mo
                      </TableCell>
                      <TableCell>
                        {getComplianceStatusBadge(number.complianceStatus)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {number.complianceStatus && number.complianceStatus !== "unverified" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedPhoneNumber(number.phoneNumber)}
                                    data-testid={`button-view-form-${number.id}`}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    View form
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View verification details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Toll-Free Verification Required
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  All toll-free numbers must be verified to send SMS messages. Unverified numbers may have messaging restrictions.
                  Complete the verification process to ensure full messaging capabilities.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedPhoneNumber} onOpenChange={(open) => !open && setSelectedPhoneNumber(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden" aria-describedby="verification-form-description">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Verification Details - {selectedPhoneNumber ? formatPhoneNumber(selectedPhoneNumber) : ''}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPhoneNumber(null)}
              className="h-8 w-8 p-0"
              data-testid="button-close-dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <p id="verification-form-description" className="sr-only">
            View the verification form details for this phone number
          </p>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            {isLoadingVerification ? (
              <div className="py-8">
                <LoadingSpinner fullScreen={false} message="Loading verification details..." />
              </div>
            ) : verification ? (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Verification Status
                  </h4>
                  <div className="flex items-center gap-2">
                    {getComplianceStatusBadge(verification.verification_status || null)}
                    <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                      {verification.verification_status?.replace(/_/g, ' ') || 'Unknown'}
                    </span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Business Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Business Name</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.business_name || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Brand Display Name</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.brand_display_name || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Business Type</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.business_type || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Business Vertical</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.business_vertical || '-'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 dark:text-slate-400">Website</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.website_url || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Address
                  </h4>
                  <div className="text-sm">
                    <p className="text-slate-900 dark:text-slate-100">
                      {verification.street_address || '-'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">
                      {[verification.city, verification.region, verification.postal_code]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Contact Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Contact Name</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {[verification.first_name, verification.last_name].filter(Boolean).join(' ') || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Phone</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.contact_phone || '-'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 dark:text-slate-400">Email</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.contact_email || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Campaign Details
                  </h4>
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Use Case</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.use_case || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Campaign Description</span>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {verification.campaign_description || '-'}
                      </p>
                    </div>
                    {verification.sample_messages && verification.sample_messages.length > 0 && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Sample Messages</span>
                        <div className="space-y-2 mt-2">
                          {verification.sample_messages.map((msg, idx) => (
                            <div 
                              key={idx} 
                              className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-slate-100"
                            >
                              {msg}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
  );
}
