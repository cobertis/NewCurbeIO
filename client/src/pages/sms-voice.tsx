import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Plus, AlertTriangle, ExternalLink, Phone, Flag, ChevronRight } from "lucide-react";
import { format, addDays } from "date-fns";

interface SmsVoiceNumber {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  status: string;
  monthlyFee: string;
  purchasedAt: string;
  ownerUserId: string | null;
  ownerName: string | null;
  complianceStatus: string | null;
  complianceApplicationId: string | null;
}

function getComplianceStatusBadge(status: string | null) {
  switch (status) {
    case "approved":
    case "verified":
      return (
        <Badge data-testid="badge-status-verified" className="bg-green-500/10 text-green-600 border-green-500/20">
          Verified
        </Badge>
      );
    case "pending":
    case "submitted":
    case "in_review":
      return (
        <Badge data-testid="badge-status-pending" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          Pending
        </Badge>
      );
    case "rejected":
      return (
        <Badge data-testid="badge-status-rejected" className="bg-red-500/10 text-red-600 border-red-500/20">
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge data-testid="badge-status-unverified" variant="outline" className="text-muted-foreground">
          Unverified
        </Badge>
      );
  }
}

export default function SmsVoice() {
  const [, setLocation] = useLocation();

  const { data: numbersData, isLoading } = useQuery<{ numbers: SmsVoiceNumber[] }>({
    queryKey: ["/api/sms-voice/numbers"],
  });

  const numbers = numbersData?.numbers || [];

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading phone numbers..." />;
  }

  return (
    <div className="space-y-6" data-testid="page-sms-voice">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            Toll-free verification
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your toll-free numbers and verification status
          </p>
        </div>
        <Button
          data-testid="button-buy-number"
          onClick={() => setLocation("/compliance/choose-number")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Buy a new number
        </Button>
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-400">
              Industry-wide registration requirement
            </p>
            <p className="text-amber-700 dark:text-amber-500/80 mt-1">
              All toll-free numbers must be verified to send SMS messages. Unverified numbers may experience
              message filtering or blocking by carriers. Complete verification to ensure reliable message delivery.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your toll-free numbers</CardTitle>
          <CardDescription>
            View and manage verification status for your phone numbers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {numbers.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No phone numbers found</p>
              <Button
                variant="outline"
                className="mt-4"
                data-testid="button-buy-number-empty"
                onClick={() => setLocation("/compliance/choose-number")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Buy your first number
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Toll-free number</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next renewal date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numbers.map((number) => {
                    const nextRenewal = number.purchasedAt
                      ? addDays(new Date(number.purchasedAt), 30)
                      : null;
                    
                    return (
                      <TableRow key={number.id} data-testid={`row-number-${number.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-4 bg-slate-100 dark:bg-slate-800 rounded text-xs font-medium">
                              <Flag className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="font-mono" data-testid={`text-phone-${number.id}`}>
                              {number.phoneNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-owner-${number.id}`}>
                          {number.ownerName || "Unassigned"}
                        </TableCell>
                        <TableCell>
                          {getComplianceStatusBadge(number.complianceStatus)}
                        </TableCell>
                        <TableCell data-testid={`text-renewal-${number.id}`}>
                          {nextRenewal ? format(nextRenewal, "MMM dd, yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {number.complianceApplicationId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-view-form-${number.id}`}
                              onClick={() => setLocation(`/compliance/info?applicationId=${number.complianceApplicationId}`)}
                            >
                              View form
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-start-verification-${number.id}`}
                              onClick={() => setLocation("/compliance/choose-number")}
                            >
                              Start verification
                              <ExternalLink className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
          <CardDescription>
            Learn more about toll-free verification requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="what-is" data-testid="accordion-what-is">
              <AccordionTrigger>What is toll-free verification?</AccordionTrigger>
              <AccordionContent>
                Toll-free verification is an industry-wide requirement that validates the identity
                and use case of businesses sending SMS messages from toll-free numbers. This process
                helps reduce spam and ensures legitimate business messages are delivered reliably.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="why-needed" data-testid="accordion-why-needed">
              <AccordionTrigger>Why is verification needed?</AccordionTrigger>
              <AccordionContent>
                Mobile carriers require verification to combat spam and protect consumers. Unverified
                toll-free numbers may experience message filtering, throttling, or blocking. Verification
                demonstrates that your business is legitimate and follows messaging best practices.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="how-long" data-testid="accordion-how-long">
              <AccordionTrigger>How long does verification take?</AccordionTrigger>
              <AccordionContent>
                The verification process typically takes 2-4 weeks after submitting all required
                documentation. Some applications may take longer if additional information is needed.
                You can continue using your number for voice calls during the verification process.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="what-happens" data-testid="accordion-what-happens">
              <AccordionTrigger>What happens if my number is not verified?</AccordionTrigger>
              <AccordionContent>
                Unverified toll-free numbers may experience reduced message deliverability. Carriers
                may filter or block messages from unverified numbers. We recommend completing
                verification as soon as possible to ensure reliable SMS delivery.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="required-docs" data-testid="accordion-required-docs">
              <AccordionTrigger>What documentation is required?</AccordionTrigger>
              <AccordionContent>
                You will need to provide business information including your legal business name,
                EIN or business registration number, business address, and a description of your
                messaging use case. Sample messages and opt-in procedures may also be required.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
