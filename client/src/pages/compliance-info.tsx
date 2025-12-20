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
  { name: "US Cellular", logo: uscellularLogo },
];

const bulletPoints = [
  "Messages will be delivered directly to the handsets",
  "Increased throughput for high-volume messaging",
  "Brand recognition with your verified business name",
  "Reduced carrier filtering and blocking",
  "Compliance with industry regulations",
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

            <div className="space-y-6 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {isTollFree ? "What is toll-free verification?" : "What is 10DLC registration?"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {isTollFree 
                    ? "Toll-free verification is a process required by carriers to verify your business identity and messaging use case. This ensures your messages are delivered reliably to recipients."
                    : "10DLC (10-Digit Long Code) registration is a process required by carriers to register your brand and messaging campaigns. This ensures higher throughput and better deliverability."
                  }
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Why do I need it?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  Major carriers require verification to prevent spam and ensure legitimate business messaging. Without verification, your messages may be filtered or blocked entirely.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  What else do I need to know?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  The verification process typically takes 2-5 business days. You'll need to provide basic business information, your EIN, and describe how you plan to use messaging.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-6 mb-8">
              {carrierLogos.map((carrier) => (
                <img
                  key={carrier.name}
                  src={carrier.logo}
                  alt={carrier.name}
                  className="h-6 object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
                  data-testid={`carrier-${carrier.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`}
                />
              ))}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <ul className="space-y-3">
                {bulletPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 text-sm" data-testid={`bullet-point-${index}`}>
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
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
