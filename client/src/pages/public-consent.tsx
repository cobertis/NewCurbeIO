import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, FileText, AlertCircle, MapPin, Monitor } from "lucide-react";
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
      const response = await fetch(`/api/consent/${token}`);
      
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
        duration: 3000,
      });
      return;
    }
    
    if (!agreeChecked) {
      toast({
        title: "Agreement required",
        description: "Please check the agreement box to proceed",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    try {
      setSigning(true);
      const response = await fetch(`/api/consent/${params?.token}/sign`, {
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
        title: "Success",
        description: "Consent form signed successfully",
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to sign consent form",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-gray-600 dark:text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading consent form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-gray-200 dark:border-gray-800">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-lg">Unable to Load Form</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!consentData) {
    return null;
  }

  const { consent, quote, company, agent } = consentData;
  const isSpanish = quote.clientPreferredLanguage === 'spanish' || quote.clientPreferredLanguage === 'es';
  const language = isSpanish ? 'es' : 'en';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-12">
        
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
            {company.logo ? (
              <img 
                src={company.logo} 
                alt={company.name}
                className="h-12 sm:h-16 object-contain"
              />
            ) : (
              <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-gray-200 dark:bg-gray-800">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 dark:text-gray-400" />
              </div>
            )}
            
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {language === 'es' ? 'Formulario de Consentimiento' : 'Health Insurance Consent Form'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{company.name}</p>
            </div>
          </div>
          
          {/* Company details */}
          <div className="mt-4 sm:mt-6 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {company.address && <p>{company.address}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {company.phone && <p>Phone: {company.phone}</p>}
                {company.email && <p>Email: {company.email}</p>}
              </div>
              {company.website && (
                <p>
                  Website: <a href={company.website} className="underline hover:text-gray-900 dark:hover:text-gray-200" target="_blank" rel="noopener noreferrer">{company.website}</a>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {signed && (
          <div className="mb-6">
            <div className="p-4 bg-gray-900 dark:bg-gray-800 text-white rounded-lg flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {language === 'es' ? 'Firmado exitosamente' : 'Successfully Signed'}
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  {format(new Date(consent.signedAt), "MMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Consent Document */}
        <Card className="mb-6 border-gray-200 dark:border-gray-800">
          <CardHeader className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <CardTitle className="text-base sm:text-lg">
              {language === 'es' ? 'Acuerdo de Consentimiento Legal' : 'Legal Consent Agreement'}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {language === 'es' ? 'Por favor lea cuidadosamente antes de firmar' : 'Please read carefully before signing'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {language === 'es' ? (
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  Yo, <strong className="text-gray-900 dark:text-gray-100">{quote.clientFirstName} {quote.clientMiddleName || ''} {quote.clientLastName}</strong>, en la fecha de hoy <strong className="text-gray-900 dark:text-gray-100">{new Date().toLocaleDateString()}</strong>, doy mi permiso a
                </p>

                <p className="text-center font-semibold text-gray-900 dark:text-gray-100">
                  {agent ? `${agent.firstName} ${agent.lastName}` : 'Agent Name'} NPN: {agent?.nationalProducerNumber || 'N/A'}
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
                  <p className="font-medium text-gray-900 dark:text-gray-100">{quote.clientFirstName} {quote.clientMiddleName || ''} {quote.clientLastName}</p>
                  <p className="text-gray-600 dark:text-gray-400">{quote.clientPhone || ''}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  I, <strong className="text-gray-900 dark:text-gray-100">{quote.clientFirstName} {quote.clientMiddleName || ''} {quote.clientLastName}</strong>, on this day <strong className="text-gray-900 dark:text-gray-100">{new Date().toLocaleDateString()}</strong>, give my permission to
                </p>

                <p className="text-center font-semibold text-gray-900 dark:text-gray-100">
                  {agent ? `${agent.firstName} ${agent.lastName}` : 'Agent Name'} NPN: {agent?.nationalProducerNumber || 'N/A'}
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
                  <p className="font-medium text-gray-900 dark:text-gray-100">{quote.clientFirstName} {quote.clientMiddleName || ''} {quote.clientLastName}</p>
                  <p className="text-gray-600 dark:text-gray-400">{quote.clientPhone || ''}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signature Section */}
        {!signed ? (
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-base sm:text-lg">
                {language === 'es' ? 'Firmar Documento' : 'Sign Document'}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {language === 'es' 
                  ? 'Proporcione su información para firmar electrónicamente este consentimiento'
                  : 'Please provide your information to electronically sign this consent'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signedByName" className="text-sm" data-testid="label-signature-name">
                  {language === 'es' ? 'Nombre Completo' : 'Full Name'} <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="signedByName"
                  value={signedByName}
                  onChange={(e) => setSignedByName(e.target.value)}
                  placeholder={language === 'es' ? 'Ingrese su nombre legal completo' : 'Enter your full legal name'}
                  className="text-base"
                  data-testid="input-signature-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signedByEmail" className="text-sm" data-testid="label-signature-email">
                  {language === 'es' ? 'Correo Electrónico (Opcional)' : 'Email (Optional)'}
                </Label>
                <Input
                  id="signedByEmail"
                  type="email"
                  value={signedByEmail}
                  onChange={(e) => setSignedByEmail(e.target.value)}
                  placeholder={language === 'es' ? 'su.correo@ejemplo.com' : 'your.email@example.com'}
                  className="text-base"
                  data-testid="input-signature-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signedByPhone" className="text-sm" data-testid="label-signature-phone">
                  {language === 'es' ? 'Teléfono (Opcional)' : 'Phone (Optional)'}
                </Label>
                <Input
                  id="signedByPhone"
                  type="tel"
                  value={signedByPhone}
                  onChange={(e) => setSignedByPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="text-base"
                  data-testid="input-signature-phone"
                />
              </div>
              
              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="agree"
                  checked={agreeChecked}
                  onCheckedChange={(checked) => setAgreeChecked(checked as boolean)}
                  data-testid="checkbox-agree"
                  className="mt-1"
                />
                <label
                  htmlFor="agree"
                  className="text-xs sm:text-sm leading-relaxed cursor-pointer"
                >
                  {language === 'es'
                    ? 'He leído y acepto los términos de este formulario de consentimiento'
                    : 'I have read and agree to the terms of this consent form'
                  }
                </label>
              </div>
              
              <Button
                onClick={handleSign}
                disabled={signing || !signedByName.trim() || !agreeChecked}
                className="w-full h-11 sm:h-12 text-base bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900"
                data-testid="button-sign"
              >
                {signing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {language === 'es' ? 'Firmar Formulario de Consentimiento' : 'Sign Consent Form'}
              </Button>
              
              <p className="text-xs text-center text-gray-500 dark:text-gray-500">
                {language === 'es'
                  ? 'Al firmar, reconoce que esta es una firma electrónica legalmente vinculante'
                  : 'By signing, you acknowledge that this is a legally binding electronic signature'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <CheckCircle2 className="h-5 w-5" />
                <CardTitle className="text-base sm:text-lg">
                  {language === 'es' ? 'Documento Firmado Exitosamente' : 'Document Signed Successfully'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {language === 'es' ? 'Firmado Por:' : 'Signed By:'}
                </p>
                <p className="text-base sm:text-lg text-gray-900 dark:text-gray-100">{consent.signedByName}</p>
              </div>
              
              {consent.signedByEmail && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {language === 'es' ? 'Correo Electrónico:' : 'Email:'}
                  </p>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100">{consent.signedByEmail}</p>
                </div>
              )}
              
              {consent.signedByPhone && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {language === 'es' ? 'Teléfono:' : 'Phone:'}
                  </p>
                  <p className="text-sm sm:text-base text-gray-900 dark:text-gray-100">{consent.signedByPhone}</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <p className="text-xs sm:text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">
                  {language === 'es' ? 'Registro de Auditoría Digital:' : 'Digital Audit Trail:'}
                </p>
                <dl className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-start gap-2">
                    <dt className="text-gray-600 dark:text-gray-400 min-w-[100px] sm:min-w-[120px]">
                      {language === 'es' ? 'Hora de Firma:' : 'Signature Time:'}
                    </dt>
                    <dd className="text-gray-900 dark:text-gray-100 flex-1">
                      {format(new Date(consent.signedAt), "MMM dd, yyyy 'at' h:mm:ss a")}
                    </dd>
                  </div>
                  
                  {consent.signerIp && (
                    <div className="flex items-start gap-2">
                      <dt className="text-gray-600 dark:text-gray-400 min-w-[100px] sm:min-w-[120px]">
                        {language === 'es' ? 'Dirección IP:' : 'IP Address:'}
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100 flex-1">{consent.signerIp}</dd>
                    </div>
                  )}
                  
                  {consent.signerTimezone && (
                    <div className="flex items-start gap-2">
                      <dt className="text-gray-600 dark:text-gray-400 min-w-[100px] sm:min-w-[120px]">
                        {language === 'es' ? 'Zona Horaria:' : 'Timezone:'}
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100 flex-1">{consent.signerTimezone}</dd>
                    </div>
                  )}
                  
                  {consent.signerPlatform && (
                    <div className="flex items-start gap-2">
                      <dt className="text-gray-600 dark:text-gray-400 min-w-[100px] sm:min-w-[120px] flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {language === 'es' ? 'Plataforma:' : 'Platform:'}
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100 flex-1">{consent.signerPlatform}</dd>
                    </div>
                  )}
                  
                  {consent.signerBrowser && (
                    <div className="flex items-start gap-2">
                      <dt className="text-gray-600 dark:text-gray-400 min-w-[100px] sm:min-w-[120px]">
                        {language === 'es' ? 'Navegador:' : 'Browser:'}
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100 flex-1">{consent.signerBrowser}</dd>
                    </div>
                  )}
                  
                  {consent.signerLocation && (
                    <div className="flex items-start gap-2">
                      <dt className="text-gray-600 dark:text-gray-400 min-w-[100px] sm:min-w-[120px] flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {language === 'es' ? 'Ubicación:' : 'Location:'}
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100 flex-1 font-mono text-xs">
                        {consent.signerLocation}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500 space-y-1">
          <p>
            {language === 'es'
              ? 'Este documento es legalmente vinculante y se almacena electrónicamente.'
              : 'This document is legally binding and electronically stored.'
            }
          </p>
          <p>&copy; {new Date().getFullYear()} {company.name}. {language === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </div>
  );
}
