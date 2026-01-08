import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GeoapifyAddressAutocomplete } from "@/components/geoapify-address-autocomplete";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, MapPin, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

const emergencyAddressSchema = z.object({
  streetAddress: z.string().min(1, "Street address is required"),
  extendedAddress: z.string().optional(),
  locality: z.string().min(1, "City is required"),
  administrativeArea: z.string().length(2, "State is required (2-letter code)"),
  postalCode: z.string().min(5, "ZIP code is required"),
  callerName: z.string().min(1, "Caller name is required for 911 dispatch"),
});

type EmergencyAddressFormData = z.infer<typeof emergencyAddressSchema>;

interface NormalizedAddress {
  streetAddress: string;
  extendedAddress?: string;
  locality: string;
  administrativeArea: string;
  postalCode: string;
  countryCode: string;
}

interface EmergencyAddressFormProps {
  phoneNumberId: string;
  phoneNumber: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmergencyAddressForm({
  phoneNumberId,
  phoneNumber,
  onSuccess,
  onCancel,
}: EmergencyAddressFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
  const [suggestedAddress, setSuggestedAddress] = useState<NormalizedAddress | null>(null);
  const [originalAddress, setOriginalAddress] = useState<EmergencyAddressFormData | null>(null);

  const form = useForm<EmergencyAddressFormData>({
    resolver: zodResolver(emergencyAddressSchema),
    defaultValues: {
      streetAddress: "",
      extendedAddress: "",
      locality: "",
      administrativeArea: "",
      postalCode: "",
      callerName: "",
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (data: EmergencyAddressFormData) => {
      const response = await apiRequest("POST", "/api/e911/validate", {
        ...data,
        countryCode: "US",
      });
      return response;
    },
    onSuccess: (result) => {
      if (result.valid) {
        registerMutation.mutate(form.getValues());
      } else if (result.normalizedAddress) {
        setOriginalAddress(form.getValues());
        setSuggestedAddress(result.normalizedAddress);
        setShowSuggestionDialog(true);
      } else if (result.suggestions && result.suggestions.length > 0) {
        setOriginalAddress(form.getValues());
        setSuggestedAddress(result.suggestions[0]);
        setShowSuggestionDialog(true);
      } else {
        toast({
          title: "Address Validation Failed",
          description: result.error || "Could not validate this address. Please check and try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Validation Error",
        description: error.message || "Failed to validate address",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: EmergencyAddressFormData) => {
      const response = await apiRequest("POST", "/api/e911/register", {
        phoneNumberId,
        ...data,
        countryCode: "US",
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "E911 Registered",
        description: "Emergency services address has been registered successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register E911 address",
        variant: "destructive",
      });
    },
  });

  const handleAddressSelect = (address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  }) => {
    form.setValue("streetAddress", address.street);
    form.setValue("locality", address.city);
    form.setValue("administrativeArea", address.state);
    form.setValue("postalCode", address.postalCode);
  };

  const handleUseSuggestedAddress = () => {
    if (suggestedAddress && originalAddress) {
      registerMutation.mutate({
        ...originalAddress,
        streetAddress: suggestedAddress.streetAddress,
        extendedAddress: suggestedAddress.extendedAddress || originalAddress.extendedAddress,
        locality: suggestedAddress.locality,
        administrativeArea: suggestedAddress.administrativeArea,
        postalCode: suggestedAddress.postalCode,
      });
    }
    setShowSuggestionDialog(false);
  };

  const handleUseOriginalAddress = () => {
    if (originalAddress) {
      registerMutation.mutate(originalAddress);
    }
    setShowSuggestionDialog(false);
  };

  const onSubmit = (data: EmergencyAddressFormData) => {
    // Validate phoneNumberId before proceeding
    if (!phoneNumberId || phoneNumberId.length < 10) {
      toast({
        title: "Invalid Phone Number ID",
        description: "The phone number is not ready yet. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    validateMutation.mutate(data);
  };

  const isLoading = validateMutation.isPending || registerMutation.isPending;

  return (
    <>
      <div className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 dark:text-amber-200">
                Emergency Services Registration Required
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                By law, VoIP phone numbers must have a registered physical address for 911 emergency services. 
                This address is sent to emergency dispatchers when you dial 911.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>Registering E911 for: <strong className="text-foreground">{phoneNumber}</strong></span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="callerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Caller Name (Visible to 911 Operator)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., John Smith or ABC Company"
                      {...field}
                      data-testid="input-caller-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="streetAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <GeoapifyAddressAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      onAddressSelect={handleAddressSelect}
                      label=""
                      placeholder="Start typing your address..."
                      testId="input-street-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="extendedAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apt/Suite/Unit (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Apt 4B, Suite 200"
                      {...field}
                      data-testid="input-extended-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="locality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="City"
                        {...field}
                        data-testid="input-city"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="administrativeArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-state">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="12345"
                      maxLength={10}
                      {...field}
                      data-testid="input-zip-code"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                data-testid="button-cancel-e911"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-verify-address"
              >
                {isLoading ? (
                  <LoadingSpinner fullScreen={false} />
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Verify & Register Address
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <Dialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Address Verification
            </DialogTitle>
            <DialogDescription>
              The postal database suggests a slightly different format for your address. 
              Using the standardized format ensures accurate 911 dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground mb-2">Your Address</p>
              {originalAddress && (
                <div className="text-sm">
                  <p>{originalAddress.streetAddress}</p>
                  {originalAddress.extendedAddress && <p>{originalAddress.extendedAddress}</p>}
                  <p>{originalAddress.locality}, {originalAddress.administrativeArea} {originalAddress.postalCode}</p>
                </div>
              )}
            </div>

            <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Suggested Address
              </p>
              {suggestedAddress && (
                <div className="text-sm">
                  <p>{suggestedAddress.streetAddress}</p>
                  {suggestedAddress.extendedAddress && <p>{suggestedAddress.extendedAddress}</p>}
                  <p>{suggestedAddress.locality}, {suggestedAddress.administrativeArea} {suggestedAddress.postalCode}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleUseOriginalAddress}
              disabled={registerMutation.isPending}
              data-testid="button-use-original"
            >
              Use My Address
            </Button>
            <Button
              onClick={handleUseSuggestedAddress}
              disabled={registerMutation.isPending}
              data-testid="button-use-suggested"
            >
              {registerMutation.isPending ? (
                <LoadingSpinner fullScreen={false} />
              ) : (
                "Use Suggested (Recommended)"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
