import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, FileSignature, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function PublicConsentPage() {
  const [, params] = useRoute("/consent/:token");
  const { toast } = useToast();
  
  const [consentData, setConsentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  
  // Form fields
  const [signedByName, setSignedByName] = useState("");
  const [signedByEmail, setSignedByEmail] = useState("");
  const [signedByPhone, setSignedByPhone] = useState("");
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [signing, setSigning] = useState(false);
  
  // Audit trail data
  const [auditData, setAuditData] = useState<any>({});

  useEffect(() => {
    if (params?.token) {
      fetchConsentData(params.token);
      collectAuditData();
    }
  }, [params?.token]);

  const collectAuditData = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    
    // Parse browser from user agent
    let browser = "Unknown";
    if (userAgent.indexOf("Chrome") > -1) browser = "Chrome";
    else if (userAgent.indexOf("Safari") > -1) browser = "Safari";
    else if (userAgent.indexOf("Firefox") > -1) browser = "Firefox";
    else if (userAgent.indexOf("Edge") > -1) browser = "Edge";
    
    // Try to get geolocation (optional)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAuditData({
            timezone,
            platform,
            browser,
            userAgent,
            location: `${position.coords.latitude}, ${position.coords.longitude}`,
          });
        },
        () => {
          // Geolocation denied or unavailable
          setAuditData({
            timezone,
            platform,
            browser,
            userAgent,
            location: null,
          });
        }
      );
    } else {
      setAuditData({
        timezone,
        platform,
        browser,
        userAgent,
        location: null,
      });
    }
  };

  const fetchConsentData = async (token: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/consent/${token}`);
      
      if (!response.ok) {
        if (response.status === 410) {
          throw new Error("This consent form has expired");
        }
        throw new Error("Consent form not found");
      }
      
      const data = await response.json();
      setConsentData(data);
      
      // Check if already signed
      if (data.consent.status === 'signed') {
        setSigned(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load consent form");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signedByName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your full name to sign",
        variant: "destructive",
      });
      return;
    }
    
    if (!agreeChecked) {
      toast({
        title: "Agreement required",
        description: "Please check the agreement box to proceed",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSigning(true);
      const response = await fetch(`/consent/${params?.token}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedByName,
          signedByEmail: signedByEmail || undefined,
          signedByPhone: signedByPhone || undefined,
          timezone: auditData.timezone,
          platform: auditData.platform,
          browser: auditData.browser,
          userAgent: auditData.userAgent,
          location: auditData.location || undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to sign consent form");
      }
      
      const data = await response.json();
      setSigned(true);
      setConsentData((prev: any) => ({ ...prev, consent: data.consent }));
      
      toast({
        title: "Success!",
        description: "Consent form signed successfully",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to sign consent form",
        variant: "destructive",
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">Loading consent form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!consentData) {
    return null;
  }

  const { consent, quote, company, agent } = consentData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FileSignature className="h-12 w-12 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Health Insurance Consent Form</h1>
          <p className="text-muted-foreground">
            {company.name}
          </p>
        </div>

        {/* Status Badge */}
        {signed && (
          <div className="mb-6 flex justify-center">
            <Badge variant="default" className="bg-green-600 text-white px-4 py-2">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Signed on {format(new Date(consent.signedAt), "MMM dd, yyyy 'at' h:mm a")}
            </Badge>
          </div>
        )}

        {/* Consent Document */}
        <Card className="mb-6">
          <CardHeader className="bg-muted/50">
            <CardTitle>Legal Consent Agreement</CardTitle>
            <CardDescription>
              Please read carefully before signing
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="prose dark:prose-invert max-w-none">
              <h2 className="text-xl font-bold mb-4">LEGAL CONSENT IN FULL USE OF MY FACULTIES</h2>
              
              <p className="mb-4">
                I, <strong>{quote.clientFirstName} {quote.clientMiddleName || ''} {quote.clientLastName}</strong>, give my permission to{' '}
                <strong>{agent?.firstName} {agent?.lastName} NPN {agent?.nationalProducerNumber || company.nationalProducerNumber}</strong> from{' '}
                <strong>{company.name}</strong> to act as a health insurance agent on my entire household if applicable, for the purpose of enrolling me in a Qualified Health Plan offered in the Federally-facilitated Marketplace.
              </p>

              <p className="mb-4">
                By giving my consent to this agreement, I authorize the above-mentioned Agent to view and use confidential information provided by me in writing, electronically, or by phone, solely for the purposes of one or more of the following:
              </p>

              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Searching for an existing Marketplace application.</li>
                <li>Completing an application for eligibility and enrollment in a Marketplace Qualified Health Plan or other governmental insurance affordability programs, such as Medicaid and CHIP or advance tax credits to help pay for Marketplace premiums.</li>
                <li>Providing ongoing account maintenance and enrollment assistance as needed.</li>
                <li>Responding to queries from the Marketplace about my application.</li>
              </ul>

              <p className="mb-4">
                I understand that the Agent will not use or share my personally identifiable information (PII) for any purpose other than those listed above. The Agent will ensure that my PII is kept private and secure when collecting, storing, and using my PII for the purposes set forth above.
              </p>

              <p className="mb-4">
                I confirm that the information I provide to be entered into my Marketplace eligibility and enrollment application will be true to the best of my knowledge. I understand that I do not have to share additional personal information about me or my health with my Agent beyond what is required on the application for eligibility and enrollment purposes. I understand that my consent remains in effect until I revoke it, and I may revoke or modify my consent at any time by contacting the person directly.
              </p>

              <div className="border-t pt-4 mt-6">
                <p className="font-semibold mb-2">Client Information:</p>
                <p>{quote.clientFirstName} {quote.clientMiddleName || ''} {quote.clientLastName}</p>
                <p>{quote.clientPhone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature Section */}
        {!signed ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign Document</CardTitle>
              <CardDescription>
                Please provide your information to electronically sign this consent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="signedByName" data-testid="label-signature-name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="signedByName"
                  value={signedByName}
                  onChange={(e) => setSignedByName(e.target.value)}
                  placeholder="Enter your full legal name"
                  data-testid="input-signature-name"
                />
              </div>
              
              <div>
                <Label htmlFor="signedByEmail" data-testid="label-signature-email">
                  Email (Optional)
                </Label>
                <Input
                  id="signedByEmail"
                  type="email"
                  value={signedByEmail}
                  onChange={(e) => setSignedByEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  data-testid="input-signature-email"
                />
              </div>
              
              <div>
                <Label htmlFor="signedByPhone" data-testid="label-signature-phone">
                  Phone (Optional)
                </Label>
                <Input
                  id="signedByPhone"
                  type="tel"
                  value={signedByPhone}
                  onChange={(e) => setSignedByPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  data-testid="input-signature-phone"
                />
              </div>
              
              <div className="flex items-start space-x-2 pt-4">
                <Checkbox
                  id="agree"
                  checked={agreeChecked}
                  onCheckedChange={(checked) => setAgreeChecked(checked as boolean)}
                  data-testid="checkbox-agree"
                />
                <label
                  htmlFor="agree"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I have read and agree to the terms of this consent form
                </label>
              </div>
              
              <Button
                onClick={handleSign}
                disabled={signing || !signedByName.trim() || !agreeChecked}
                className="w-full"
                size="lg"
                data-testid="button-sign"
              >
                {signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Consent Form
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                By signing, you acknowledge that this is a legally binding electronic signature
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-6 w-6" />
                <CardTitle>Document Signed Successfully</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-sm font-medium">Signed By:</p>
                <p className="text-lg">{consent.signedByName}</p>
              </div>
              
              {consent.signedByEmail && (
                <div>
                  <p className="text-sm font-medium">Email:</p>
                  <p>{consent.signedByEmail}</p>
                </div>
              )}
              
              {consent.signedByPhone && (
                <div>
                  <p className="text-sm font-medium">Phone:</p>
                  <p>{consent.signedByPhone}</p>
                </div>
              )}
              
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Digital Audit Trail:</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Signature Time:</dt>
                  <dd>{format(new Date(consent.signedAt), "MMM dd, yyyy 'at' h:mm:ss a")}</dd>
                  
                  {consent.signerIp && (
                    <>
                      <dt className="text-muted-foreground">IP Address:</dt>
                      <dd>{consent.signerIp}</dd>
                    </>
                  )}
                  
                  {consent.signerTimezone && (
                    <>
                      <dt className="text-muted-foreground">Timezone:</dt>
                      <dd>{consent.signerTimezone}</dd>
                    </>
                  )}
                  
                  {consent.signerPlatform && (
                    <>
                      <dt className="text-muted-foreground">Platform:</dt>
                      <dd>{consent.signerPlatform}</dd>
                    </>
                  )}
                  
                  {consent.signerBrowser && (
                    <>
                      <dt className="text-muted-foreground">Browser:</dt>
                      <dd>{consent.signerBrowser}</dd>
                    </>
                  )}
                  
                  {consent.signerLocation && (
                    <>
                      <dt className="text-muted-foreground">Location:</dt>
                      <dd>{consent.signerLocation}</dd>
                    </>
                  )}
                </dl>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>This document is legally binding and electronically stored.</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
