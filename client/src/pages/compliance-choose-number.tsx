import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
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

const usAreaCodes = [
  { code: "201", state: "NJ", name: "New Jersey" },
  { code: "202", state: "DC", name: "Washington DC" },
  { code: "203", state: "CT", name: "Connecticut" },
  { code: "205", state: "AL", name: "Alabama" },
  { code: "206", state: "WA", name: "Washington" },
  { code: "207", state: "ME", name: "Maine" },
  { code: "208", state: "ID", name: "Idaho" },
  { code: "209", state: "CA", name: "California" },
  { code: "210", state: "TX", name: "Texas" },
  { code: "212", state: "NY", name: "New York" },
  { code: "213", state: "CA", name: "California" },
  { code: "214", state: "TX", name: "Texas" },
  { code: "215", state: "PA", name: "Pennsylvania" },
  { code: "216", state: "OH", name: "Ohio" },
  { code: "217", state: "IL", name: "Illinois" },
  { code: "218", state: "MN", name: "Minnesota" },
  { code: "219", state: "IN", name: "Indiana" },
  { code: "224", state: "IL", name: "Illinois" },
  { code: "225", state: "LA", name: "Louisiana" },
  { code: "228", state: "MS", name: "Mississippi" },
  { code: "229", state: "GA", name: "Georgia" },
  { code: "231", state: "MI", name: "Michigan" },
  { code: "234", state: "OH", name: "Ohio" },
  { code: "239", state: "FL", name: "Florida" },
  { code: "240", state: "MD", name: "Maryland" },
  { code: "248", state: "MI", name: "Michigan" },
  { code: "251", state: "AL", name: "Alabama" },
  { code: "252", state: "NC", name: "North Carolina" },
  { code: "253", state: "WA", name: "Washington" },
  { code: "254", state: "TX", name: "Texas" },
  { code: "256", state: "AL", name: "Alabama" },
  { code: "260", state: "IN", name: "Indiana" },
  { code: "262", state: "WI", name: "Wisconsin" },
  { code: "267", state: "PA", name: "Pennsylvania" },
  { code: "269", state: "MI", name: "Michigan" },
  { code: "270", state: "KY", name: "Kentucky" },
  { code: "281", state: "TX", name: "Texas" },
  { code: "301", state: "MD", name: "Maryland" },
  { code: "302", state: "DE", name: "Delaware" },
  { code: "303", state: "CO", name: "Colorado" },
  { code: "304", state: "WV", name: "West Virginia" },
  { code: "305", state: "FL", name: "Florida" },
  { code: "307", state: "WY", name: "Wyoming" },
  { code: "308", state: "NE", name: "Nebraska" },
  { code: "309", state: "IL", name: "Illinois" },
  { code: "310", state: "CA", name: "California" },
  { code: "312", state: "IL", name: "Illinois" },
  { code: "313", state: "MI", name: "Michigan" },
  { code: "314", state: "MO", name: "Missouri" },
  { code: "315", state: "NY", name: "New York" },
  { code: "316", state: "KS", name: "Kansas" },
  { code: "317", state: "IN", name: "Indiana" },
  { code: "318", state: "LA", name: "Louisiana" },
  { code: "319", state: "IA", name: "Iowa" },
  { code: "320", state: "MN", name: "Minnesota" },
  { code: "321", state: "FL", name: "Florida" },
  { code: "323", state: "CA", name: "California" },
  { code: "330", state: "OH", name: "Ohio" },
  { code: "331", state: "IL", name: "Illinois" },
  { code: "334", state: "AL", name: "Alabama" },
  { code: "336", state: "NC", name: "North Carolina" },
  { code: "337", state: "LA", name: "Louisiana" },
  { code: "339", state: "MA", name: "Massachusetts" },
  { code: "346", state: "TX", name: "Texas" },
  { code: "347", state: "NY", name: "New York" },
  { code: "351", state: "MA", name: "Massachusetts" },
  { code: "352", state: "FL", name: "Florida" },
  { code: "360", state: "WA", name: "Washington" },
  { code: "361", state: "TX", name: "Texas" },
  { code: "385", state: "UT", name: "Utah" },
  { code: "386", state: "FL", name: "Florida" },
  { code: "401", state: "RI", name: "Rhode Island" },
  { code: "402", state: "NE", name: "Nebraska" },
  { code: "404", state: "GA", name: "Georgia" },
  { code: "405", state: "OK", name: "Oklahoma" },
  { code: "406", state: "MT", name: "Montana" },
  { code: "407", state: "FL", name: "Florida" },
  { code: "408", state: "CA", name: "California" },
  { code: "409", state: "TX", name: "Texas" },
  { code: "410", state: "MD", name: "Maryland" },
  { code: "412", state: "PA", name: "Pennsylvania" },
  { code: "413", state: "MA", name: "Massachusetts" },
  { code: "414", state: "WI", name: "Wisconsin" },
  { code: "415", state: "CA", name: "California" },
  { code: "417", state: "MO", name: "Missouri" },
  { code: "419", state: "OH", name: "Ohio" },
  { code: "423", state: "TN", name: "Tennessee" },
  { code: "424", state: "CA", name: "California" },
  { code: "425", state: "WA", name: "Washington" },
  { code: "430", state: "TX", name: "Texas" },
  { code: "432", state: "TX", name: "Texas" },
  { code: "434", state: "VA", name: "Virginia" },
  { code: "435", state: "UT", name: "Utah" },
  { code: "440", state: "OH", name: "Ohio" },
  { code: "443", state: "MD", name: "Maryland" },
  { code: "469", state: "TX", name: "Texas" },
  { code: "470", state: "GA", name: "Georgia" },
  { code: "475", state: "CT", name: "Connecticut" },
  { code: "478", state: "GA", name: "Georgia" },
  { code: "479", state: "AR", name: "Arkansas" },
  { code: "480", state: "AZ", name: "Arizona" },
  { code: "484", state: "PA", name: "Pennsylvania" },
  { code: "501", state: "AR", name: "Arkansas" },
  { code: "502", state: "KY", name: "Kentucky" },
  { code: "503", state: "OR", name: "Oregon" },
  { code: "504", state: "LA", name: "Louisiana" },
  { code: "505", state: "NM", name: "New Mexico" },
  { code: "507", state: "MN", name: "Minnesota" },
  { code: "508", state: "MA", name: "Massachusetts" },
  { code: "509", state: "WA", name: "Washington" },
  { code: "510", state: "CA", name: "California" },
  { code: "512", state: "TX", name: "Texas" },
  { code: "513", state: "OH", name: "Ohio" },
  { code: "515", state: "IA", name: "Iowa" },
  { code: "516", state: "NY", name: "New York" },
  { code: "517", state: "MI", name: "Michigan" },
  { code: "518", state: "NY", name: "New York" },
  { code: "520", state: "AZ", name: "Arizona" },
  { code: "530", state: "CA", name: "California" },
  { code: "531", state: "NE", name: "Nebraska" },
  { code: "534", state: "WI", name: "Wisconsin" },
  { code: "539", state: "OK", name: "Oklahoma" },
  { code: "540", state: "VA", name: "Virginia" },
  { code: "541", state: "OR", name: "Oregon" },
  { code: "551", state: "NJ", name: "New Jersey" },
  { code: "559", state: "CA", name: "California" },
  { code: "561", state: "FL", name: "Florida" },
  { code: "562", state: "CA", name: "California" },
  { code: "563", state: "IA", name: "Iowa" },
  { code: "567", state: "OH", name: "Ohio" },
  { code: "571", state: "VA", name: "Virginia" },
  { code: "573", state: "MO", name: "Missouri" },
  { code: "574", state: "IN", name: "Indiana" },
  { code: "575", state: "NM", name: "New Mexico" },
  { code: "580", state: "OK", name: "Oklahoma" },
  { code: "585", state: "NY", name: "New York" },
  { code: "586", state: "MI", name: "Michigan" },
  { code: "601", state: "MS", name: "Mississippi" },
  { code: "602", state: "AZ", name: "Arizona" },
  { code: "603", state: "NH", name: "New Hampshire" },
  { code: "605", state: "SD", name: "South Dakota" },
  { code: "606", state: "KY", name: "Kentucky" },
  { code: "607", state: "NY", name: "New York" },
  { code: "608", state: "WI", name: "Wisconsin" },
  { code: "609", state: "NJ", name: "New Jersey" },
  { code: "610", state: "PA", name: "Pennsylvania" },
  { code: "612", state: "MN", name: "Minnesota" },
  { code: "614", state: "OH", name: "Ohio" },
  { code: "615", state: "TN", name: "Tennessee" },
  { code: "616", state: "MI", name: "Michigan" },
  { code: "617", state: "MA", name: "Massachusetts" },
  { code: "618", state: "IL", name: "Illinois" },
  { code: "619", state: "CA", name: "California" },
  { code: "620", state: "KS", name: "Kansas" },
  { code: "623", state: "AZ", name: "Arizona" },
  { code: "626", state: "CA", name: "California" },
  { code: "628", state: "CA", name: "California" },
  { code: "629", state: "TN", name: "Tennessee" },
  { code: "630", state: "IL", name: "Illinois" },
  { code: "631", state: "NY", name: "New York" },
  { code: "636", state: "MO", name: "Missouri" },
  { code: "641", state: "IA", name: "Iowa" },
  { code: "646", state: "NY", name: "New York" },
  { code: "650", state: "CA", name: "California" },
  { code: "651", state: "MN", name: "Minnesota" },
  { code: "657", state: "CA", name: "California" },
  { code: "660", state: "MO", name: "Missouri" },
  { code: "661", state: "CA", name: "California" },
  { code: "662", state: "MS", name: "Mississippi" },
  { code: "669", state: "CA", name: "California" },
  { code: "678", state: "GA", name: "Georgia" },
  { code: "681", state: "WV", name: "West Virginia" },
  { code: "682", state: "TX", name: "Texas" },
  { code: "701", state: "ND", name: "North Dakota" },
  { code: "702", state: "NV", name: "Nevada" },
  { code: "703", state: "VA", name: "Virginia" },
  { code: "704", state: "NC", name: "North Carolina" },
  { code: "706", state: "GA", name: "Georgia" },
  { code: "707", state: "CA", name: "California" },
  { code: "708", state: "IL", name: "Illinois" },
  { code: "712", state: "IA", name: "Iowa" },
  { code: "713", state: "TX", name: "Texas" },
  { code: "714", state: "CA", name: "California" },
  { code: "715", state: "WI", name: "Wisconsin" },
  { code: "716", state: "NY", name: "New York" },
  { code: "717", state: "PA", name: "Pennsylvania" },
  { code: "718", state: "NY", name: "New York" },
  { code: "719", state: "CO", name: "Colorado" },
  { code: "720", state: "CO", name: "Colorado" },
  { code: "724", state: "PA", name: "Pennsylvania" },
  { code: "725", state: "NV", name: "Nevada" },
  { code: "727", state: "FL", name: "Florida" },
  { code: "731", state: "TN", name: "Tennessee" },
  { code: "732", state: "NJ", name: "New Jersey" },
  { code: "734", state: "MI", name: "Michigan" },
  { code: "737", state: "TX", name: "Texas" },
  { code: "740", state: "OH", name: "Ohio" },
  { code: "747", state: "CA", name: "California" },
  { code: "754", state: "FL", name: "Florida" },
  { code: "757", state: "VA", name: "Virginia" },
  { code: "760", state: "CA", name: "California" },
  { code: "762", state: "GA", name: "Georgia" },
  { code: "763", state: "MN", name: "Minnesota" },
  { code: "765", state: "IN", name: "Indiana" },
  { code: "769", state: "MS", name: "Mississippi" },
  { code: "770", state: "GA", name: "Georgia" },
  { code: "772", state: "FL", name: "Florida" },
  { code: "773", state: "IL", name: "Illinois" },
  { code: "774", state: "MA", name: "Massachusetts" },
  { code: "775", state: "NV", name: "Nevada" },
  { code: "779", state: "IL", name: "Illinois" },
  { code: "781", state: "MA", name: "Massachusetts" },
  { code: "785", state: "KS", name: "Kansas" },
  { code: "786", state: "FL", name: "Florida" },
  { code: "801", state: "UT", name: "Utah" },
  { code: "802", state: "VT", name: "Vermont" },
  { code: "803", state: "SC", name: "South Carolina" },
  { code: "804", state: "VA", name: "Virginia" },
  { code: "805", state: "CA", name: "California" },
  { code: "806", state: "TX", name: "Texas" },
  { code: "808", state: "HI", name: "Hawaii" },
  { code: "810", state: "MI", name: "Michigan" },
  { code: "812", state: "IN", name: "Indiana" },
  { code: "813", state: "FL", name: "Florida" },
  { code: "814", state: "PA", name: "Pennsylvania" },
  { code: "815", state: "IL", name: "Illinois" },
  { code: "816", state: "MO", name: "Missouri" },
  { code: "817", state: "TX", name: "Texas" },
  { code: "818", state: "CA", name: "California" },
  { code: "828", state: "NC", name: "North Carolina" },
  { code: "830", state: "TX", name: "Texas" },
  { code: "831", state: "CA", name: "California" },
  { code: "832", state: "TX", name: "Texas" },
  { code: "843", state: "SC", name: "South Carolina" },
  { code: "845", state: "NY", name: "New York" },
  { code: "847", state: "IL", name: "Illinois" },
  { code: "848", state: "NJ", name: "New Jersey" },
  { code: "850", state: "FL", name: "Florida" },
  { code: "856", state: "NJ", name: "New Jersey" },
  { code: "857", state: "MA", name: "Massachusetts" },
  { code: "858", state: "CA", name: "California" },
  { code: "859", state: "KY", name: "Kentucky" },
  { code: "860", state: "CT", name: "Connecticut" },
  { code: "862", state: "NJ", name: "New Jersey" },
  { code: "863", state: "FL", name: "Florida" },
  { code: "864", state: "SC", name: "South Carolina" },
  { code: "865", state: "TN", name: "Tennessee" },
  { code: "870", state: "AR", name: "Arkansas" },
  { code: "878", state: "PA", name: "Pennsylvania" },
  { code: "901", state: "TN", name: "Tennessee" },
  { code: "903", state: "TX", name: "Texas" },
  { code: "904", state: "FL", name: "Florida" },
  { code: "906", state: "MI", name: "Michigan" },
  { code: "907", state: "AK", name: "Alaska" },
  { code: "908", state: "NJ", name: "New Jersey" },
  { code: "909", state: "CA", name: "California" },
  { code: "910", state: "NC", name: "North Carolina" },
  { code: "912", state: "GA", name: "Georgia" },
  { code: "913", state: "KS", name: "Kansas" },
  { code: "914", state: "NY", name: "New York" },
  { code: "915", state: "TX", name: "Texas" },
  { code: "916", state: "CA", name: "California" },
  { code: "917", state: "NY", name: "New York" },
  { code: "918", state: "OK", name: "Oklahoma" },
  { code: "919", state: "NC", name: "North Carolina" },
  { code: "920", state: "WI", name: "Wisconsin" },
  { code: "925", state: "CA", name: "California" },
  { code: "928", state: "AZ", name: "Arizona" },
  { code: "929", state: "NY", name: "New York" },
  { code: "931", state: "TN", name: "Tennessee" },
  { code: "936", state: "TX", name: "Texas" },
  { code: "937", state: "OH", name: "Ohio" },
  { code: "938", state: "AL", name: "Alabama" },
  { code: "940", state: "TX", name: "Texas" },
  { code: "941", state: "FL", name: "Florida" },
  { code: "947", state: "MI", name: "Michigan" },
  { code: "949", state: "CA", name: "California" },
  { code: "951", state: "CA", name: "California" },
  { code: "952", state: "MN", name: "Minnesota" },
  { code: "954", state: "FL", name: "Florida" },
  { code: "956", state: "TX", name: "Texas" },
  { code: "959", state: "CT", name: "Connecticut" },
  { code: "970", state: "CO", name: "Colorado" },
  { code: "971", state: "OR", name: "Oregon" },
  { code: "972", state: "TX", name: "Texas" },
  { code: "973", state: "NJ", name: "New Jersey" },
  { code: "978", state: "MA", name: "Massachusetts" },
  { code: "979", state: "TX", name: "Texas" },
  { code: "980", state: "NC", name: "North Carolina" },
  { code: "984", state: "NC", name: "North Carolina" },
  { code: "985", state: "LA", name: "Louisiana" },
  { code: "989", state: "MI", name: "Michigan" },
];

export default function ComplianceChooseNumber() {
  const [location, setLocation] = useLocation();

  const [currentStep] = useState(0);
  const [country] = useState("US");
  const [numberType, setNumberType] = useState<"toll-free" | "10dlc">("toll-free");
  const [selectedNumber, setSelectedNumber] = useState<string>("");
  const [selectedAreaCode, setSelectedAreaCode] = useState<string>("");
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [pendingType, setPendingType] = useState<"toll-free" | "10dlc" | null>(null);

  const handleNumberTypeChange = (val: string) => {
    const newType = val as "toll-free" | "10dlc";
    if (numberType === "toll-free" && newType === "10dlc") {
      setPendingType("10dlc");
      setShowSwitchDialog(true);
    } else if (numberType === "10dlc" && newType === "toll-free") {
      setPendingType("toll-free");
      setShowSwitchDialog(true);
    }
  };

  const confirmSwitch = () => {
    if (pendingType) {
      setNumberType(pendingType);
    }
    setShowSwitchDialog(false);
    setPendingType(null);
  };

  const cancelSwitch = () => {
    setShowSwitchDialog(false);
    setPendingType(null);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get("type");
    if (typeParam === "10dlc") {
      setNumberType("10dlc");
    }
  }, []);

  const phoneNumberType = numberType === "toll-free" ? "toll_free" : "local";
  const areaCodeParam = numberType === "10dlc" && selectedAreaCode ? `&npa=${selectedAreaCode}` : "";
  const { data: numbersData, isLoading: loadingNumbers } = useQuery<{ numbers: AvailableNumber[] }>({
    queryKey: [`/api/telnyx/available-numbers?phone_number_type=${phoneNumberType}&limit=20${areaCodeParam}`],
    enabled: numberType === "toll-free" || (numberType === "10dlc" && !!selectedAreaCode),
  });

  const numbers = numbersData?.numbers || [];

  useEffect(() => {
    setSelectedNumber("");
    setSelectedAreaCode("");
  }, [numberType]);

  useEffect(() => {
    setSelectedNumber("");
  }, [selectedAreaCode]);

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
    : "Please choose the area code and the desired virtual number for your business.";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
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
          <CardContent className="p-10">
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
            <div className="space-y-6 max-w-2xl mx-auto">
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
                  onValueChange={handleNumberTypeChange}
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

              {/* Area Code - Only for 10DLC */}
              {numberType === "10dlc" && (
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                    Area code
                  </Label>
                  <Select value={selectedAreaCode} onValueChange={setSelectedAreaCode}>
                    <SelectTrigger className="w-full" data-testid="select-area-code">
                      <SelectValue placeholder="Select an area code" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {usAreaCodes.map((ac) => (
                        <SelectItem key={ac.code} value={ac.code}>
                          {ac.code} – {ac.name} ({ac.state})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Available Number */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                  {numberType === "10dlc" ? "Available number" : "Choose number"}
                </Label>
                {numberType === "10dlc" && !selectedAreaCode ? (
                  <div className="flex items-center py-2">
                    <span className="text-sm text-gray-500">Select an area code first</span>
                  </div>
                ) : loadingNumbers ? (
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

      {/* Switch Confirmation Dialog */}
      <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="flex flex-row items-start justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {pendingType === "10dlc" 
                ? "Switch to the 10DLC number flow" 
                : "Switch to the toll-free number flow"}
            </DialogTitle>
            <button
              onClick={cancelSwitch}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              data-testid="button-close-dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogHeader>
          <div className="mt-4">
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {pendingType === "10dlc"
                ? "Are you sure that you want to move away from the toll-free registration flow, and instead get started with a 10DLC number? All your progress will be restarted."
                : "Are you sure that you want to move away from the 10DLC registration flow, and instead get started with a toll-free number? All your progress will be restarted."}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={cancelSwitch}
              data-testid="button-stay"
            >
              {numberType === "toll-free" ? "Stay on toll-free" : "Stay on 10DLC"}
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={confirmSwitch}
              data-testid="button-continue-switch"
            >
              {pendingType === "10dlc" ? "Continue with 10DLC" : "Continue with toll-free"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
