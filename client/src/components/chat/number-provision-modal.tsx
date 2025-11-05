import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Search, ChevronLeft } from "lucide-react";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

interface AvailableNumber {
  did: string;
  npa?: string;
  nxx?: string;
  state?: string;
  ratecenter?: string;
  price?: number;
}

interface NumberProvisionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "search" | "select" | "confirm";

export function NumberProvisionModal({ open, onOpenChange }: NumberProvisionModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("search");
  const [selectedState, setSelectedState] = useState<string>("");
  const [areaCode, setAreaCode] = useState<string>("");
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [selectedDID, setSelectedDID] = useState<string | null>(null);

  const selectedNumber = availableNumbers.find((num) => num.did === selectedDID);

  const searchMutation = useMutation({
    mutationFn: async () => {
      if (!areaCode || areaCode.length !== 3) {
        throw new Error("Please enter a valid 3-digit area code");
      }

      const params = new URLSearchParams();
      params.append("npa", areaCode); // BulkVS requires area code (npa)

      const response = await fetch(`/api/bulkvs/numbers/available?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to search numbers");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setAvailableNumbers(data);
        setStep("select");
      } else {
        toast({
          title: "No numbers available",
          description: "No numbers available for this area code. Try a different area code.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDID) {
        throw new Error("No number selected");
      }

      return apiRequest("POST", "/api/bulkvs/numbers/provision", {
        did: selectedDID,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "Success!",
        description: "Your phone number has been provisioned successfully.",
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Provision failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    searchMutation.mutate();
  };

  const handleNext = () => {
    if (!selectedDID) {
      toast({
        title: "No number selected",
        description: "Please select a phone number to continue.",
        variant: "destructive",
      });
      return;
    }
    setStep("confirm");
  };

  const handlePurchase = () => {
    provisionMutation.mutate();
  };

  const handleClose = () => {
    setStep("search");
    setSelectedState("");
    setAreaCode("");
    setAvailableNumbers([]);
    setSelectedDID(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === "confirm") {
      setStep("select");
    } else if (step === "select") {
      setStep("search");
    }
  };

  const formatPhoneNumber = (did: string): string => {
    const cleaned = did.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const number = cleaned.slice(1);
      return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return did;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="number-provision-modal">
        <DialogHeader className="text-center">
          <DialogTitle className="flex items-center justify-center gap-2" data-testid="modal-title">
            <Phone className="h-5 w-5" />
            Get Your Phone Number
          </DialogTitle>
          <DialogDescription data-testid="modal-description">
            Search and purchase a dedicated phone number for SMS/MMS messaging
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-left">
          {step === "search" && !searchMutation.isPending && (
            <div className="space-y-4" data-testid="step-search">
              <div className="space-y-2">
                <Label htmlFor="area-code" data-testid="label-area-code">
                  Area Code *
                </Label>
                <Input
                  id="area-code"
                  type="text"
                  placeholder="e.g., 305 for Miami, 212 for New York"
                  maxLength={3}
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-area-code"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the 3-digit area code where you want a phone number
                </p>
              </div>

              <Button
                onClick={handleSearch}
                disabled={!areaCode || areaCode.length !== 3}
                className="w-full"
                data-testid="button-search-numbers"
              >
                <Search className="h-4 w-4 mr-2" />
                Search Numbers
              </Button>
            </div>
          )}

          {step === "search" && searchMutation.isPending && (
            <LoadingSpinner message="Searching for available numbers..." fullScreen={false} />
          )}

          {step === "select" && (
            <div className="space-y-4" data-testid="step-select">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="mb-2"
                  data-testid="button-back-to-search"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to Search
                </Button>
                <p className="text-sm text-muted-foreground font-medium">
                  {availableNumbers.length.toLocaleString()} number{availableNumbers.length !== 1 ? 's' : ''} found
                </p>
              </div>

              <RadioGroup value={selectedDID || ""} onValueChange={setSelectedDID}>
                <div className="space-y-2 max-h-[600px] overflow-y-auto" data-testid="numbers-list">
                  {availableNumbers.map((number) => (
                    <Card
                      key={number.did}
                      className={`cursor-pointer transition-colors ${
                        selectedDID === number.did ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedDID(number.did)}
                      data-testid={`number-card-${number.did}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value={number.did} id={number.did} data-testid={`radio-${number.did}`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold" data-testid={`number-display-${number.did}`}>
                                  {formatPhoneNumber(number.did)}
                                </p>
                                <p className="text-sm text-muted-foreground" data-testid={`number-details-${number.did}`}>
                                  {number.npa && `Area Code: ${number.npa}`}
                                  {number.state && ` • ${number.state}`}
                                  {number.ratecenter && ` • ${number.ratecenter}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium" data-testid={`number-price-${number.did}`}>
                                  {number.price ? `$${number.price.toFixed(2)}/mo` : "Contact for pricing"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </RadioGroup>

              <Button
                onClick={handleNext}
                disabled={!selectedDID}
                className="w-full"
                data-testid="button-next-to-confirm"
              >
                Next
              </Button>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4" data-testid="step-confirm">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="mb-2"
                data-testid="button-back-to-select"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Selection
              </Button>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Selected Number</Label>
                    <p className="text-2xl font-bold" data-testid="confirm-selected-number">
                      {selectedNumber && formatPhoneNumber(selectedNumber.did)}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="confirm-number-details">
                      {selectedNumber?.state && `${selectedNumber.state}`}
                      {selectedNumber?.npa && ` • Area Code: ${selectedNumber.npa}`}
                    </p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-md space-y-2">
                    <p className="text-sm font-medium">Automatic Configuration:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ SMS/MMS enabled</li>
                      <li>✓ 10DLC Campaign assigned (C3JXHXH)</li>
                      <li>✓ Webhook configured for messaging</li>
                    </ul>
                  </div>

                  {selectedNumber?.price && (
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Monthly Cost:</span>
                        <span className="text-lg font-bold" data-testid="confirm-price">
                          ${selectedNumber.price.toFixed(2)}/month
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  data-testid="button-cancel-purchase"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePurchase}
                  disabled={provisionMutation.isPending}
                  className="flex-1"
                  data-testid="button-purchase-number"
                >
                  {provisionMutation.isPending ? (
                    <>
                      <LoadingSpinner />
                      Purchasing...
                    </>
                  ) : (
                    "Purchase Number"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
