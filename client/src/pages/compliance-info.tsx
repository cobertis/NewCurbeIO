import { useQuery } from "@tanstack/react-query";
import { useLocation, Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceApplication } from "@shared/schema";
import complianceImage from "@assets/image_1766269959786.png";
import attLogo from "@assets/att-logo.svg";
import verizonLogo from "@assets/verizon-logo.svg";
import tmobileLogo from "@assets/tmobile-logo.svg";
import bellLogo from "@assets/bell-logo.svg";
import rogersLogo from "@assets/rogers-logo.svg";
import telusLogo from "@assets/telus-logo.svg";
import uscellularLogo from "@assets/uscellular-logo.svg";

const steps = [
  { id: "number", label: "Number" },
  { id: "info", label: "Info" },
  { id: "brand", label: "Brand" },
  { id: "campaign", label: "Campaign" },
  { id: "review", label: "Review" },
];

const carrierLogos = [
  { name: "AT&T", logo: attLogo },
  { name: "Verizon", logo: verizonLogo },
  { name: "T-Mobile", logo: tmobileLogo },
  { name: "Bell", logo: bellLogo },
  { name: "Rogers", logo: rogersLogo },
  { name: "Telus", logo: telusLogo },
];

const tollFreeBulletPoints = [
  { text: "Toll-free verification is ", bold: "free of charge" },
  { text: "The form takes around ", bold: "10-15 minutes", suffix: " to complete" },
  { text: "You can ", bold: "save and return", suffix: " to the form at any time" },
  { text: "We ", bold: "don't need", suffix: " your tax ID (EIN number) or any company documents" },
  { text: "The approval period usually takes ", bold: "3-5 business days" },
];

const tenDlcBulletPoints = [
  { text: "10DLC registration is ", bold: "required for all business messaging" },
  { text: "The form takes around ", bold: "15-20 minutes", suffix: " to complete" },
  { text: "You can ", bold: "save and return", suffix: " to the form at any time" },
  { text: "You will need your ", bold: "EIN number", suffix: " for registration" },
  { text: "The approval period usually takes ", bold: "3-5 business days" },
];

export default function ComplianceInfo() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/compliance/info/:id");
  const applicationId = params?.id;
  
  const { data: application, isLoading } = useQuery<ComplianceApplication>({
    queryKey: ["/api/compliance/applications", applicationId],
    enabled: !!applicationId,
  });

  const currentStep = 1;
  const isTollFree = application?.numberType === "toll_free";
  
  const title = isTollFree 
    ? "Get started with toll-free texting" 
    : "Get started with 10DLC texting";
    
  const verificationTitle = isTollFree
    ? "Get started with toll-free verification"
    : "Get started with 10DLC registration";

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3" data-testid="text-page-title">
            {title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            For more information about filling out this form, watch our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-video-guide">
              video guide
            </a>
            {" "}or read our{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium" data-testid="link-support-article">
              support article
            </a>.
          </p>
        </div>

        <div className="flex items-center justify-center gap-12 mb-10">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2",
                  index < currentStep
                    ? "bg-green-600 border-green-600 text-white"
                    : index === currentStep
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                )}
                data-testid={`step-indicator-${index + 1}`}
              >
                {index < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  index <= currentStep
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <Card className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
          <CardContent className="p-10">
            <div className="flex flex-col items-center mb-8">
              <img 
                src={complianceImage} 
                alt="100% Compliance with industry-wide requirements" 
                className="h-24 object-contain mb-4"
                data-testid="img-compliance-badge"
              />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center" data-testid="text-verification-title">
                {verificationTitle}
              </h2>
            </div>

            <div className="space-y-6 mb-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {isTollFree ? "What is toll-free verification?" : "What is 10DLC registration?"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {isTollFree 
                    ? <>The toll-free number (TFN) verification is an <strong className="text-gray-900 dark:text-gray-100">industry-wide requirement</strong> and a trust-building measure created to protect consumers from unwanted spam and fraud. By verifying your number, you'll benefit from rapid and reliable message delivery, with an <strong className="text-gray-900 dark:text-gray-100">average delivery rate of 98%</strong>.</>
                    : <>10DLC (10-Digit Long Code) registration is an <strong className="text-gray-900 dark:text-gray-100">industry-wide requirement</strong> and a trust-building measure for A2P messaging. Registration ensures higher throughput and better deliverability for your business messages.</>
                  }
                </p>
                <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium inline-flex items-center gap-1 mt-2">
                  Learn more about {isTollFree ? "toll-free verification" : "10DLC registration"}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Why do I need it?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
                  {isTollFree 
                    ? "U.S. and Canadian carriers, the messaging aggregator, and Curbe will block any SMS campaigns that are sent from unverified toll-free numbers and do not comply with regulations."
                    : "U.S. carriers require 10DLC registration to send business SMS. Messages from unregistered numbers may be blocked or severely rate-limited."
                  }
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  {carrierLogos.map((carrier) => (
                    <img
                      key={carrier.name}
                      src={carrier.logo}
                      alt={carrier.name}
                      className="h-5 object-contain"
                      data-testid={`carrier-${carrier.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`}
                    />
                  ))}
                  <span className="text-gray-500 dark:text-gray-400 text-sm">+ all local carriers</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  What else do I need to know?
                </h3>
                <ul className="space-y-2">
                  {(isTollFree ? tollFreeBulletPoints : tenDlcBulletPoints).map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300 text-sm" data-testid={`bullet-point-${index}`}>
                        {point.text}<strong className="text-gray-900 dark:text-gray-100">{point.bold}</strong>{point.suffix || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-8">
          <Link href={`/compliance/choose-number${application?.numberType === "10dlc" ? "?type=10dlc" : ""}`}>
            <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium cursor-pointer flex items-center gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              Back
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              data-testid="link-add-team-members"
            >
              Add team members
            </a>
            <Button
              className="bg-blue-600 hover:bg-blue-700 px-6"
              onClick={() => setLocation(`/compliance/brand?id=${applicationId}`)}
              data-testid="button-proceed"
            >
              Proceed to verification
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
