import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { ChevronLeft, Check, Video, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailableNumber {
  phone_number: string;
  phone_number_type?: string;
  cost_information?: {
    monthly_cost: string;
    upfront_cost: string;
    currency: string;
  };
  region_information?: Array<{
    region_name: string;
    region_type: string;
  }>;
}

const steps = [
  { id: "number", label: "Number" },
  { id: "info", label: "Info" },
  { id: "brand", label: "Brand" },
  { id: "campaign", label: "Campaign" },
  { id: "review", label: "Review" },
];

export default function ComplianceChooseNumber() {
  const [location, setLocation] = useLocation();

  const [currentStep] = useState(0);
  const [country] = useState("US");
  const [numberType, setNumberType] = useState<"toll-free" | "10dlc">("toll-free");
  const [selectedNumber, setSelectedNumber] = useState<string>("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get("type");
    if (typeParam === "10dlc") {
      setNumberType("10dlc");
    }
  }, []);

  const phoneNumberType = numberType === "toll-free" ? "toll_free" : "local";
  const { data: numbersData, isLoading: loadingNumbers } = useQuery<{ numbers: AvailableNumber[] }>({
    queryKey: [`/api/telnyx/available-numbers?phone_number_type=${phoneNumberType}&limit=20`],
  });

  const numbers = numbersData?.numbers || [];

  useEffect(() => {
    setSelectedNumber("");
  }, [numberType]);

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const title = numberType === "toll-free" 
    ? "Get started with toll-free texting" 
    : "Get started with 10DLC texting";

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-6 mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  index === currentStep
                    ? "bg-blue-600 text-white"
                    : index < currentStep
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                )}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  index === currentStep
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 ml-2" />
              )}
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help?{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1" data-testid="link-video-guide">
              <Video className="w-3 h-3" />
              Watch video guide
            </a>
            {" "}or{" "}
            <a href="#" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1" data-testid="link-support-article">
              <FileText className="w-3 h-3" />
              Read support article
            </a>
          </p>
        </div>

        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Choose your texting number
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Country
                </Label>
                <Select value={country} disabled>
                  <SelectTrigger className="w-full" data-testid="select-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">🇺🇸 United States +1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                  Number type
                </Label>
                <RadioGroup
                  value={numberType}
                  onValueChange={(val) => setNumberType(val as "toll-free" | "10dlc")}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="toll-free" id="toll-free" data-testid="radio-toll-free" />
                    <Label htmlFor="toll-free" className="cursor-pointer text-sm">
                      Toll-free number
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="10dlc" id="10dlc" data-testid="radio-10dlc" />
                    <Label htmlFor="10dlc" className="cursor-pointer text-sm">
                      Local 10DLC number
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Choose a number
                </Label>
                {loadingNumbers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading available numbers...</span>
                  </div>
                ) : (
                  <Select value={selectedNumber} onValueChange={setSelectedNumber}>
                    <SelectTrigger className="w-full" data-testid="select-number">
                      <SelectValue placeholder="Select a phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {numbers.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          No numbers available
                        </SelectItem>
                      ) : (
                        numbers.map((num) => (
                          <SelectItem key={num.phone_number} value={num.phone_number}>
                            {formatPhoneNumber(num.phone_number)}
                            {num.region_information?.[0]?.region_name && (
                              <span className="text-gray-500 ml-2">
                                ({num.region_information[0].region_name})
                              </span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Monthly cost</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    1 month free, then $10.00 per month
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  By activating this number, you agree to our{" "}
                  <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="#" className="text-blue-600 hover:underline">Acceptable Use Policy</a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-6">
          <Link href="/getting-started">
            <Button variant="ghost" className="gap-2" data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!selectedNumber || selectedNumber === "_none"}
            data-testid="button-activate"
          >
            Activate number ($0.00)
          </Button>
        </div>
      </div>
    </div>
  );
}
