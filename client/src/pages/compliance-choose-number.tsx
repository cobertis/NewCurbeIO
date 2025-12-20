import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const title = numberType === "toll-free" 
    ? "Get started with toll-free texting" 
    : "Get started with 10DLC texting";

  const subtitle = numberType === "toll-free"
    ? "Please choose the desired virtual toll-free number for your business."
    : "Please choose the desired virtual local number for your business.";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
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

        {/* Steps */}
        <div className="flex items-center justify-center gap-12 mb-10">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2",
                  index === currentStep
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                )}
              >
                {index + 1}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  index === currentStep
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Card */}
        <Card className="bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
          <CardContent className="p-8">
            {/* Card Header */}
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Choose your texting number
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {subtitle}
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-6 max-w-xl mx-auto">
              {/* Country */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                  Country
                </Label>
                <Select value={country} disabled>
                  <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-900" data-testid="select-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">
                      <span className="flex items-center gap-2">
                        <span>🇺🇸</span>
                        <span>United States (+1)</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Number Type */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                  Number type
                </Label>
                <RadioGroup
                  value={numberType}
                  onValueChange={(val) => setNumberType(val as "toll-free" | "10dlc")}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="toll-free" id="toll-free" data-testid="radio-toll-free" />
                    <Label htmlFor="toll-free" className="cursor-pointer text-sm font-normal">
                      Toll-free number
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="10dlc" id="10dlc" data-testid="radio-10dlc" />
                    <Label htmlFor="10dlc" className="cursor-pointer text-sm font-normal">
                      Local 10DLC number
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Choose Number */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                  Choose number
                </Label>
                {loadingNumbers ? (
                  <div className="flex items-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                    <span className="text-sm text-gray-500">Loading...</span>
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
                            {formatPhoneNumber(num.phone_number)} (Two-way SMS, MMS & calls)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Price */}
              <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right pt-1">
                  Price
                </Label>
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    <span className="font-semibold">1 month free,</span> then $10.00 per month
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                    We will deduct this amount from your account balance each month. If your account balance becomes too low to renew the dedicated number, we leave right to cancel it permanently. You can cancel this number at any time.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-between mt-8">
          <Link href="/getting-started">
            <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium cursor-pointer" data-testid="button-back">
              Back
            </span>
          </Link>
          <Button
            className="bg-blue-600 hover:bg-blue-700 px-6"
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
