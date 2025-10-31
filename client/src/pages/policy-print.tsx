import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Shield, Users, FileText, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PolicyPrintPage() {
  const [, params] = useRoute("/policies/:id/print");
  const policyId = params?.id;

  const { data: policy, isLoading } = useQuery<any>({
    queryKey: [`/api/policies/${policyId}/detail`],
    enabled: !!policyId,
  });

  const formatDateForDisplay = (dateString: string, formatStr = "MM/dd/yyyy") => {
    if (!dateString) return "";
    return format(new Date(dateString), formatStr);
  };

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getImmigrationStatusDisplay = (immigration: any) => {
    if (!immigration) return 'N/A';
    const status = immigration.status || immigration.immigrationStatus;
    if (status === 'us_citizen') return 'US Citizen';
    if (status === 'lawfully_present') return 'Lawfully Present';
    if (status === 'not_lawfully_present') return 'Not Lawfully Present';
    return status || 'N/A';
  };

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
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

  const policyYear = policy.effectiveDate ? new Date(policy.effectiveDate).getFullYear() : new Date().getFullYear();
  const plan = policy.selectedPlan;

  // Extract plan details
  const individualDeductible = plan?.deductibles?.find((d: any) => !d.family);
  const individualMoop = plan?.moops?.find((m: any) => !m.family);
  
  // Collect all members
  const allMembers = [
    {
      type: 'Primary',
      firstName: policy.clientFirstName,
      middleName: policy.clientMiddleName,
      lastName: policy.clientLastName,
      secondLastName: policy.clientSecondLastName,
      dateOfBirth: policy.clientDateOfBirth,
      gender: policy.clientGender,
      ssn: policy.clientSsn,
      phone: policy.clientPhone,
      email: policy.clientEmail,
      isApplicant: policy.clientIsApplicant,
      isPrimaryDependent: policy.isPrimaryDependent,
    },
    ...(policy.spouses || []).map((s: any) => ({ ...s, type: 'Spouse' })),
    ...(policy.dependents || []).map((d: any) => ({ ...d, type: d.relation || 'Dependent' })),
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Print Header - Only shows when printing */}
      <div className="print-only text-center mb-6 pb-4 border-b-2 border-foreground">
        <h1 className="text-3xl font-bold mb-2">HEALTH INSURANCE POLICY SUMMARY</h1>
        <p className="text-sm text-muted-foreground">Official Policy Documentation</p>
      </div>

      {/* Screen-only header with print button */}
      <div className="no-print sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Policy Summary - Print View</h1>
          <Button onClick={handlePrint} size="lg" data-testid="button-print-page">
            <FileText className="h-5 w-5 mr-2" />
            Print Policy
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 print:px-0">
        {/* Policy Header Section - IRS Style */}
        <Card className="mb-6 border-2 border-foreground print:shadow-none">
          <div className="p-6 space-y-4">
            {/* Year Banner - IRS Style */}
            <div className="flex items-center justify-between border-b-2 border-foreground pb-4">
              <div>
                <h2 className="text-xl font-bold mb-1">POLICY INFORMATION</h2>
                <p className="text-sm text-muted-foreground">Policy ID: {policy.id}</p>
              </div>
              <div className="inline-flex items-center justify-center border-2 border-foreground px-6 py-2 bg-background">
                <span className="text-4xl font-bold tracking-wide" style={{ fontFamily: 'monospace' }}>
                  {policyYear}
                </span>
              </div>
            </div>

            {/* Policy Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">POLICY STATUS</p>
                <p className="text-sm font-medium uppercase">{policy.status || 'ACTIVE'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">EFFECTIVE DATE</p>
                <p className="text-sm font-medium">{policy.effectiveDate ? formatDateForDisplay(policy.effectiveDate) : 'Not Set'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">PRODUCT TYPE</p>
                <p className="text-sm font-medium uppercase">{policy.productType || 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">COVERAGE YEAR</p>
                <p className="text-sm font-medium">{policyYear || 'N/A'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Primary Policyholder */}
        <Card className="mb-6 border-2 border-foreground print:shadow-none">
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 border-b-2 border-foreground pb-2">PRIMARY POLICYHOLDER</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">FULL NAME</p>
                <p className="text-sm font-medium">
                  {[policy.clientFirstName, policy.clientMiddleName, policy.clientLastName, policy.clientSecondLastName].filter(Boolean).join(' ') || 'N/A'}
                </p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">DATE OF BIRTH</p>
                <p className="text-sm font-medium">{policy.clientDateOfBirth ? formatDateForDisplay(policy.clientDateOfBirth) : 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">AGE</p>
                <p className="text-sm font-medium">{policy.clientDateOfBirth ? `${calculateAge(policy.clientDateOfBirth)} years` : 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">GENDER</p>
                <p className="text-sm font-medium uppercase">{policy.clientGender || 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">SSN</p>
                <p className="text-sm font-medium font-mono">{policy.clientSsn || 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">PHONE</p>
                <p className="text-sm font-medium">{policy.clientPhone || 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3 md:col-span-2">
                <p className="text-xs font-semibold mb-1">EMAIL</p>
                <p className="text-sm font-medium">{policy.clientEmail || 'N/A'}</p>
              </div>
              <div className="border border-foreground p-3">
                <p className="text-xs font-semibold mb-1">STATUS</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {policy.clientIsApplicant && <Badge variant="default" className="text-xs">APPLICANT</Badge>}
                  {policy.isPrimaryDependent && <Badge variant="outline" className="text-xs">DEPENDENT</Badge>}
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="mt-4 border border-foreground p-3">
              <p className="text-xs font-semibold mb-1">RESIDENTIAL ADDRESS</p>
              <p className="text-sm font-medium">
                {policy.physical_street || 'N/A'}<br />
                {[policy.physical_city, policy.physical_state, policy.physical_postal_code].filter(Boolean).join(', ') || '-'}
              </p>
            </div>
          </div>
        </Card>

        {/* Selected Plan */}
        {plan && (
          <Card className="mb-6 border-2 border-foreground print:shadow-none">
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4 border-b-2 border-foreground pb-2">SELECTED HEALTH PLAN</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="border border-foreground p-3">
                  <p className="text-xs font-semibold mb-1">PLAN NAME</p>
                  <p className="text-sm font-medium">{plan.name}</p>
                </div>
                <div className="border border-foreground p-3">
                  <p className="text-xs font-semibold mb-1">INSURANCE PROVIDER</p>
                  <p className="text-sm font-medium">{plan.issuer?.name || 'N/A'}</p>
                </div>
                <div className="border border-foreground p-3">
                  <p className="text-xs font-semibold mb-1">PLAN ID</p>
                  <p className="text-sm font-medium font-mono">{plan.id}</p>
                </div>
                <div className="border border-foreground p-3">
                  <p className="text-xs font-semibold mb-1">METAL LEVEL</p>
                  <p className="text-sm font-medium uppercase">{plan.metal_level || 'N/A'}</p>
                </div>
              </div>

              {/* Premium & Costs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border-2 border-foreground p-4 bg-muted/20">
                  <p className="text-xs font-semibold mb-2">MONTHLY PREMIUM</p>
                  <p className="text-3xl font-bold">
                    {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null
                      ? formatCurrency(plan.premium_w_credit)
                      : formatCurrency(plan.premium)}
                  </p>
                  {plan.premium_w_credit !== undefined && plan.premium_w_credit !== null && plan.premium > plan.premium_w_credit && (
                    <p className="text-xs text-green-600 mt-1">
                      Savings: {formatCurrency(plan.premium - plan.premium_w_credit)}
                    </p>
                  )}
                </div>
                <div className="border-2 border-foreground p-4 bg-muted/20">
                  <p className="text-xs font-semibold mb-2">ANNUAL DEDUCTIBLE</p>
                  <p className="text-3xl font-bold">
                    {individualDeductible ? formatCurrency(individualDeductible.amount) : '$0'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Individual</p>
                </div>
                <div className="border-2 border-foreground p-4 bg-muted/20">
                  <p className="text-xs font-semibold mb-2">OUT-OF-POCKET MAX</p>
                  <p className="text-3xl font-bold">
                    {individualMoop ? formatCurrency(individualMoop.amount) : 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Individual</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Covered Members */}
        {allMembers.length > 0 && (
          <Card className="mb-6 border-2 border-foreground print:shadow-none">
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4 border-b-2 border-foreground pb-2">
                COVERED MEMBERS ({allMembers.length})
              </h2>
              
              <div className="space-y-4">
                {allMembers.map((member, index) => (
                  <div key={index} className="border border-foreground p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm">
                          {member.firstName} {member.middleName || ''} {member.lastName} {member.secondLastName || ''}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{member.type}</Badge>
                          {member.isApplicant && <Badge variant="default" className="text-xs">APPLICANT</Badge>}
                          {member.isPrimaryDependent && <Badge variant="outline" className="text-xs">DEPENDENT</Badge>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="font-semibold">DOB:</p>
                        <p className="font-mono">{formatDateForDisplay(member.dateOfBirth)}</p>
                      </div>
                      <div>
                        <p className="font-semibold">AGE:</p>
                        <p>{calculateAge(member.dateOfBirth)} years</p>
                      </div>
                      <div>
                        <p className="font-semibold">GENDER:</p>
                        <p className="uppercase">{member.gender || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-semibold">SSN:</p>
                        <p className="font-mono">{member.ssn || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t-2 border-foreground text-center text-sm text-muted-foreground">
          <p className="font-semibold mb-2">This document is an official summary of your health insurance policy</p>
          <p>Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}</p>
          <p className="mt-2">Policy ID: {policy.id}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          @page {
            margin: 1cm;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>
    </div>
  );
}
