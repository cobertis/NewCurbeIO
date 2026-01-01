import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wallet, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";

interface WalletTopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function WalletTopupDialog({ open, onOpenChange }: WalletTopupDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("25");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(25);

  const { data: paymentMethods, isLoading: isLoadingPaymentMethods } = useQuery<any[]>({
    queryKey: ['/api/billing/payment-methods'],
    enabled: open,
  });

  const defaultMethod = paymentMethods?.find(pm => pm.isDefault) || paymentMethods?.[0];

  const topupMutation = useMutation({
    mutationFn: async (topupAmount: number) => {
      const response = await apiRequest("POST", "/api/wallet/top-up", { amount: topupAmount });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Credits Added",
        description: `$${parseFloat(amount).toFixed(2)} has been added to your wallet.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/transactions'] });
      onOpenChange(false);
      setAmount("25");
      setSelectedPreset(25);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Credits",
        description: error.message || "Please try again or update your payment method.",
        variant: "destructive",
      });
    },
  });

  const handleAmountChange = (value: string) => {
    const numValue = value.replace(/[^0-9.]/g, '');
    setAmount(numValue);
    const parsed = parseFloat(numValue);
    if (PRESET_AMOUNTS.includes(parsed)) {
      setSelectedPreset(parsed);
    } else {
      setSelectedPreset(null);
    }
  };

  const handlePresetClick = (preset: number) => {
    setAmount(preset.toString());
    setSelectedPreset(preset);
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 5 || numAmount > 500) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be between $5 and $500.",
        variant: "destructive",
      });
      return;
    }
    topupMutation.mutate(numAmount);
  };

  const numAmount = parseFloat(amount) || 0;
  const isValidAmount = numAmount >= 5 && numAmount <= 500;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Add Phone Credits
          </DialogTitle>
          <DialogDescription>
            Add funds to your wallet for calls, SMS, and other services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Amount Buttons */}
          <div className="space-y-2">
            <Label>Select Amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={selectedPreset === preset ? "default" : "outline"}
                  onClick={() => handlePresetClick(preset)}
                  className="h-12"
                  data-testid={`button-preset-${preset}`}
                >
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Or Enter Custom Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="custom-amount"
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-7"
                placeholder="25.00"
                data-testid="input-topup-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Min: $5 | Max: $500
            </p>
          </div>

          {/* Payment Method Info */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            {isLoadingPaymentMethods ? (
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/30">
                <LoadingSpinner fullScreen={false} />
              </div>
            ) : defaultMethod ? (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">
                    {defaultMethod.brand} •••• {defaultMethod.last4}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {defaultMethod.expMonth}/{defaultMethod.expYear}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-md border border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    No payment method found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Please add a card in Billing settings first.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-topup"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidAmount || !defaultMethod || topupMutation.isPending}
            data-testid="button-confirm-topup"
          >
            {topupMutation.isPending ? (
              <LoadingSpinner fullScreen={false} />
            ) : (
              <>Add ${numAmount.toFixed(2)}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}