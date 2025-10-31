import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Shield, Phone, Mail, User, Calendar, IdCard, MapPin, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PolicyPrintPage() {
  const [, params] = useRoute("/policies/:id/print");
  const policyId = params?.id;

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/policies/${policyId}/detail`],
    enabled: !!policyId,
  });
  
  // Extract data from response structure
  const policy = data?.policy;
  const members = data?.members || [];
  const selectedPlan = policy?.selectedPlan;

  const formatDateForDisplay = (dateString: string, formatStr = "MM/dd/yyyy") => {
    if (!dateString) return "";
    // Parse date as local time to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, formatStr);
  };

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    // Parse date as local time to avoid timezone issues
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    const birthDate = new Date(year, month - 1, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `$${Math.round(num)}`;
  };

  if (isLoading || !policy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading policy information...</p>
        </div>
      </div>
    );
  }

  // Parse effectiveDate as local time to avoid timezone issues
  const policyYear = policy?.effectiveDate 
    ? (() => {
        const [year] = policy.effectiveDate.split('-').map(Number);
        return year;
      })()
    : new Date().getFullYear();

  const plan = selectedPlan;

  // Extract plan details
  const individualDeductible = plan?.deductibles?.find((d: any) => !d.family);
  const familyDeductible = plan?.deductibles?.find((d: any) => d.family);
  const mainDeductible = individualDeductible || familyDeductible || plan?.deductibles?.[0];
  const individualMoop = plan?.moops?.find((m: any) => !m.family);
  const outOfPocketMax = individualMoop?.amount || plan?.out_of_pocket_limit;

  // Extract benefits with cost sharing info
  const getBenefitCost = (benefitName: string) => {
    const benefit = plan?.benefits?.find((b: any) => 
      b.name?.toLowerCase().includes(benefitName.toLowerCase())
    );
    if (!benefit) return null;
    const costSharing = benefit.cost_sharings?.[0];
    return costSharing?.display_string || costSharing?.copay_options || costSharing?.coinsurance_options;
  };

  const primaryCareCost = getBenefitCost('Primary Care') || (plan?.copay_primary ? formatCurrency(plan.copay_primary) : null);
  const specialistCost = getBenefitCost('Specialist') || (plan?.copay_specialist ? formatCurrency(plan.copay_specialist) : null);
  const urgentCareCost = getBenefitCost('Urgent Care') || (plan?.copay_urgent_care ? formatCurrency(plan.copay_urgent_care) : null);
  const emergencyCost = getBenefitCost('Emergency') || (plan?.copay_emergency ? formatCurrency(plan.copay_emergency) : null);
  const genericDrugsCost = getBenefitCost('Generic Drugs');
  const mentalHealthCost = getBenefitCost('Mental');
  
  // Collect all members from the new backend structure
  const allMembers = [
    // Primary client from policy root
    {
      type: 'Primary',
      firstName: policy?.clientFirstName,
      middleName: policy?.clientMiddleName,
      lastName: policy?.clientLastName,
      secondLastName: policy?.clientSecondLastName,
      dateOfBirth: policy?.clientDateOfBirth,
      gender: policy?.clientGender,
      ssn: policy?.clientSsn,
      phone: policy?.clientPhone,
      email: policy?.clientEmail,
      isApplicant: policy?.clientIsApplicant,
      isPrimaryDependent: policy?.isPrimaryDependent,
    },
    // Additional members from members array
    ...members.map((m: any) => ({
      type: m.member.relation === 'spouse' ? 'Spouse' : (m.member.relation === 'child' ? 'Child' : 'Dependent'),
      firstName: m.member.firstName,
      middleName: m.member.middleName,
      lastName: m.member.lastName,
      secondLastName: m.member.secondLastName,
      dateOfBirth: m.member.dateOfBirth,
      gender: m.member.gender,
      ssn: m.member.ssn,
      phone: m.member.phone,
      email: m.member.email,
      isApplicant: m.member.isApplicant,
      isPrimaryDependent: m.member.isPrimaryDependent,
    })),
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Screen-only header with print button */}
      <div className="no-print sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Policy Summary - Print View</h1>
          <Button onClick={handlePrint} size="lg" data-testid="button-print-page">
            <FileText className="h-5 w-5 mr-2" />
            Print Policy
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 print:px-4 print:py-2 print:max-w-none">
        {/* Print-only Company Header */}
        <div className="print-only text-center mb-4 pb-3 border-b-2 print:mb-3">
          <h1 className="text-3xl font-bold mb-1 print:text-2xl">HEALTH INSURANCE POLICY</h1>
          <p className="text-base text-muted-foreground print:text-sm">Official Policy Summary</p>
        </div>

        {/* Enhanced Header with Client Info */}
        <Card className="mb-6 bg-muted/20 print:shadow-none">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-primary/10 rounded-lg print:bg-muted">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold mb-1">
                      {[policy.clientFirstName, policy.clientMiddleName, policy.clientLastName, policy.clientSecondLastName].filter(Boolean).join(' ')}
                    </h2>
                    <p className="text-sm text-muted-foreground">Primary Policyholder</p>
                  </div>
                </div>
                
                {/* Quick Summary */}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {policy.clientPhone || 'N/A'}
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {policy.clientEmail || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {policy.clientGender ? policy.clientGender.charAt(0).toUpperCase() + policy.clientGender.slice(1) : 'N/A'}
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {policy.clientDateOfBirth ? (
                        <>
                          {formatDateForDisplay(policy.clientDateOfBirth, "MMM dd, yyyy")}
                          <span className="text-foreground/60">
                            ({calculateAge(policy.clientDateOfBirth) || 0} years)
                          </span>
                        </>
                      ) : 'N/A'}
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span className="flex items-center gap-2 font-mono">
                      <IdCard className="h-4 w-4" />
                      {policy.clientSsn || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {policy.physical_street}, {policy.physical_city}, {policy.physical_state} {policy.physical_postal_code}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-3">
                {/* Policy Info */}
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Policy ID</p>
                  <p className="font-mono text-lg font-semibold">{policy.id}</p>
                </div>
                
                {/* Internal Code */}
                {policy.internalCode && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Internal Code</p>
                    <p className="font-mono text-base font-semibold">{policy.internalCode}</p>
                  </div>
                )}
                
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium">{policy.productType || 'Health Insurance'}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Effective {formatDateForDisplay(policy.effectiveDate, "MMM dd, yyyy")}
                  </span>
                </div>
                
                {/* Policy Year - IRS Style */}
                <div className="inline-flex items-center justify-center border-2 border-foreground px-6 py-2 bg-background rounded-sm mt-2">
                  <span className="text-3xl font-bold tracking-wide" style={{ fontFamily: 'monospace' }}>
                    {policyYear}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Plan Card */}
        {plan && (
          <Card className="mb-6 overflow-hidden print:shadow-none print:break-inside-avoid">
            {/* Header with Logo */}
            <div className="flex items-start justify-between gap-4 p-6 border-b bg-muted/20">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-12 w-12 rounded-lg bg-background border flex items-center justify-center flex-shrink-0">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1">{plan.issuer?.name || 'Insurance Provider'}</h3>
                  <p className="text-xs text-muted-foreground mb-2">Plan ID: {plan.id || 'N/A'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs font-semibold">
                      {plan.metal_level || 'N/A'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {plan.type || 'N/A'}
                    </Badge>
                    {plan.quality_rating?.available ? (
                      <span className="text-xs">
                        Rating: {plan.quality_rating.global_rating > 0 
                          ? `${plan.quality_rating.global_rating}/5` 
                          : 'New/Ineligible'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Rating: N/A</span>
                    )}
                    {plan.has_dental_child_coverage && (
                      <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700">
                        Dental Child
                      </Badge>
                    )}
                    {plan.has_dental_adult_coverage && (
                      <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700">
                        Dental Adult
                      </Badge>
                    )}
                    {plan.hsa_eligible && (
                      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700">
                        HSA
                      </Badge>
                    )}
                    {plan.simple_choice && (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700">
                        Simple Choice
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">
              {/* Plan Name */}
              <h4 className="text-lg font-semibold mb-6 text-primary">{plan.name}</h4>
              
              {/* Cost Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Premium */}
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-2 text-muted-foreground">Monthly Premium</p>
                  <p className="text-4xl font-bold mb-1">
                    {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null 
                      ? formatCurrency(plan.premium_w_credit)
                      : formatCurrency(plan.premium)}
                  </p>
                  {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null && plan.premium > plan.premium_w_credit && (
                    <>
                      <p className="text-xs text-green-600 dark:text-green-500">
                        Savings: {formatCurrency(plan.premium - plan.premium_w_credit)}
                      </p>
                      <p className="text-xs text-muted-foreground line-through">
                        Was {formatCurrency(plan.premium)}
                      </p>
                    </>
                  )}
                </div>

                {/* Deductible */}
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-2 text-muted-foreground">Annual Deductible</p>
                  <p className="text-4xl font-bold mb-1">
                    {mainDeductible ? formatCurrency(mainDeductible.amount) : '$0'}
                  </p>
                  {mainDeductible && (
                    <>
                      <p className="text-xs text-muted-foreground">Individual</p>
                      <p className="text-xs text-muted-foreground">Health & drug combined</p>
                    </>
                  )}
                </div>

                {/* Out-of-pocket max */}
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-2 text-muted-foreground">Out-of-Pocket Max</p>
                  <p className="text-4xl font-bold mb-1">
                    {outOfPocketMax ? formatCurrency(outOfPocketMax) : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">Individual total</p>
                  <p className="text-xs text-muted-foreground">Medical and Drug EHB Benefits</p>
                </div>
              </div>

              {/* Benefits Section */}
              <div className="border-t pt-6">
                <h5 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">Coverage Benefits</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm font-medium mb-1">Primary Doctor Visits</p>
                    <p className="text-sm text-muted-foreground">
                      {primaryCareCost || 'No Charge After Deductible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Specialist Visits</p>
                    <p className="text-sm text-muted-foreground">
                      {specialistCost || 'No Charge After Deductible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Urgent Care</p>
                    <p className="text-sm text-muted-foreground">
                      {urgentCareCost || 'No Charge After Deductible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Emergency Room</p>
                    <p className="text-sm text-muted-foreground">
                      {emergencyCost || '40% Coinsurance after deductible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Mental Health</p>
                    <p className="text-sm text-muted-foreground">
                      {mentalHealthCost || 'No Charge After Deductible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Generic Drugs</p>
                    <p className="text-sm text-muted-foreground">
                      {genericDrugsCost || 'No Charge After Deductible'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Covered Members */}
        {allMembers.length > 0 && (
          <Card className="mb-6 print:shadow-none print:break-inside-avoid">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Covered Members ({allMembers.length})
              </h3>
              
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Name</th>
                      <th className="text-left p-2 font-semibold">Type</th>
                      <th className="text-left p-2 font-semibold">DOB</th>
                      <th className="text-center p-2 font-semibold">Age</th>
                      <th className="text-center p-2 font-semibold">Gender</th>
                      <th className="text-left p-2 font-semibold">SSN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMembers.map((member, index) => (
                      <tr key={index} className="border-b last:border-b-0 hover:bg-muted/5">
                        <td className="p-2 font-medium">
                          {[member.firstName, member.middleName, member.lastName, member.secondLastName].filter(Boolean).join(' ')}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{member.type}</Badge>
                            {member.isApplicant && <Badge variant="default" className="text-xs">Applicant</Badge>}
                          </div>
                        </td>
                        <td className="p-2">{member.dateOfBirth ? formatDateForDisplay(member.dateOfBirth, "MMM dd, yyyy") : 'N/A'}</td>
                        <td className="p-2 text-center">{member.dateOfBirth ? calculateAge(member.dateOfBirth) : 'N/A'}</td>
                        <td className="p-2 text-center capitalize">{member.gender || 'N/A'}</td>
                        <td className="p-2 font-mono text-xs">{member.ssn || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground print:border-t-2">
          <p className="font-semibold mb-2">This document is an official summary of your health insurance policy</p>
          <p>Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}</p>
          <p className="mt-2 font-mono">Policy ID: {policy.id}</p>
          <p className="mt-4 text-xs">For questions or assistance, please contact your insurance agent</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          /* Hide screen-only elements */
          .no-print {
            display: none !important;
          }
          
          /* Show print-only elements */
          .print-only {
            display: block !important;
          }
          
          /* Exact color reproduction */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Page setup for US Letter (8.5" x 11") - minimal margins */
          @page {
            size: letter portrait;
            margin: 0.3in 0.4in;
          }
          
          /* Prevent page breaks inside elements */
          .print\\:break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          /* Optimize spacing for print */
          .print\\:px-4 {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          
          .print\\:py-2 {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          
          .print\\:max-w-none {
            max-width: 100% !important;
          }
          
          /* Ensure shadows don't print */
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          /* Very compact font sizes for print */
          html {
            font-size: 7.5pt !important;
            line-height: 1.2 !important;
          }
          
          h1 {
            font-size: 13pt !important;
            margin-bottom: 0.15rem !important;
            line-height: 1.1 !important;
          }
          
          h2 {
            font-size: 11pt !important;
            margin-bottom: 0.15rem !important;
            line-height: 1.1 !important;
          }
          
          h3 {
            font-size: 9.5pt !important;
            margin-bottom: 0.1rem !important;
            line-height: 1.1 !important;
          }
          
          h4 {
            font-size: 8.5pt !important;
            margin-bottom: 0.1rem !important;
            line-height: 1.1 !important;
          }
          
          /* Ultra-minimal spacing */
          .mb-1, .my-1 { margin-bottom: 0.05rem !important; }
          .mb-2, .my-2 { margin-bottom: 0.1rem !important; }
          .mb-3, .my-3 { margin-bottom: 0.15rem !important; }
          .mb-4, .my-4 { margin-bottom: 0.2rem !important; }
          .mb-6, .my-6 { margin-bottom: 0.25rem !important; }
          .mb-8, .my-8 { margin-bottom: 0.3rem !important; }
          
          .mt-2, .my-2 { margin-top: 0.1rem !important; }
          .mt-4, .my-4 { margin-top: 0.2rem !important; }
          .mt-8, .my-8 { margin-top: 0.3rem !important; }
          
          .p-3 { padding: 0.15rem !important; }
          .p-4 { padding: 0.2rem !important; }
          .p-6 { padding: 0.25rem !important; }
          
          .px-6 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
          .py-4 { padding-top: 0.15rem !important; padding-bottom: 0.15rem !important; }
          .py-6 { padding-top: 0.2rem !important; padding-bottom: 0.2rem !important; }
          .py-8 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          
          .pb-3 { padding-bottom: 0.15rem !important; }
          .pb-6 { padding-bottom: 0.25rem !important; }
          .pt-6 { padding-top: 0.25rem !important; }
          
          .gap-2 { gap: 0.1rem !important; }
          .gap-3 { gap: 0.15rem !important; }
          .gap-4 { gap: 0.2rem !important; }
          .gap-6 { gap: 0.25rem !important; }
          
          .space-y-2 > * + * { margin-top: 0.1rem !important; }
          .space-y-3 > * + * { margin-top: 0.15rem !important; }
          .space-y-4 > * + * { margin-top: 0.2rem !important; }
          .space-y-6 > * + * { margin-top: 0.25rem !important; }
          
          /* Very compact text sizes */
          .text-xs { font-size: 6pt !important; line-height: 1.2 !important; }
          .text-sm { font-size: 6.5pt !important; line-height: 1.2 !important; }
          .text-base { font-size: 7.5pt !important; line-height: 1.2 !important; }
          .text-lg { font-size: 8.5pt !important; line-height: 1.2 !important; }
          .text-xl { font-size: 9.5pt !important; line-height: 1.2 !important; }
          .text-2xl { font-size: 10pt !important; line-height: 1.2 !important; }
          .text-3xl { font-size: 11pt !important; line-height: 1.2 !important; }
          .text-4xl { font-size: 13pt !important; line-height: 1.1 !important; }
          
          /* Very compact icons */
          .lucide, svg {
            width: 8pt !important;
            height: 8pt !important;
          }
          
          /* Very compact badges */
          .inline-flex.items-center {
            padding: 0.02rem 0.2rem !important;
            font-size: 6pt !important;
            line-height: 1.1 !important;
          }
          
          /* Remove ALL borders and backgrounds */
          .border,
          .border-t,
          .border-b,
          .border-l,
          .border-r {
            border-color: #e5e7eb !important;
            border-width: 0.5px !important;
          }
          
          .bg-muted\\/20,
          .bg-accent\\/5,
          .bg-primary\\/5 {
            background-color: #fafafa !important;
          }
          
          .pl-6 {
            padding-left: 0.3rem !important;
          }
          
          /* Print header very compact */
          .print\\:mb-3 {
            margin-bottom: 0.15rem !important;
          }
          
          .print\\:text-2xl {
            font-size: 11pt !important;
          }
          
          .print\\:text-sm {
            font-size: 6.5pt !important;
          }
          
          /* Compact card content */
          .rounded-lg,
          .rounded-md,
          .rounded-sm {
            border-radius: 0 !important;
          }
          
          /* Reduce line heights everywhere */
          * {
            line-height: 1.2 !important;
            color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* Make grids more compact */
          .grid {
            gap: 0.2rem !important;
          }
          
          /* Compact flex gaps */
          .flex {
            gap: 0.15rem !important;
          }
          
          /* Compact table styling */
          table {
            border-collapse: collapse !important;
          }
          
          th, td {
            padding: 0.1rem 0.15rem !important;
            font-size: 6.5pt !important;
            line-height: 1.1 !important;
          }
          
          th {
            font-size: 7pt !important;
            font-weight: 600 !important;
          }
          
          .overflow-hidden {
            overflow: visible !important;
          }
        }
        
        /* Hide print-only on screen */
        .print-only {
          display: none;
        }
      `}</style>
    </div>
  );
}
