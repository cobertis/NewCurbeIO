import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, MoreVertical, Plus, Trash2, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StripeCardForm } from "@/components/stripe-card-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Card brand logos component
function CardBrandLogo({ brand }: { brand: string }) {
  const brandLower = brand.toLowerCase();
  
  if (brandLower === 'visa') {
    return (
      <div className="flex items-center justify-center w-12 h-8 bg-blue-600 rounded text-white font-bold text-xs">
        VISA
      </div>
    );
  }
  
  if (brandLower === 'mastercard') {
    return (
      <div className="flex items-center justify-center w-12 h-8 bg-gradient-to-r from-red-500 to-orange-400 rounded">
        <div className="flex gap-[-4px]">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <div className="w-3 h-3 rounded-full bg-orange-500 -ml-2" />
        </div>
      </div>
    );
  }
  
  if (brandLower === 'amex' || brandLower === 'american_express') {
    return (
      <div className="flex items-center justify-center w-12 h-8 bg-blue-500 rounded text-white font-bold text-xs">
        AMEX
      </div>
    );
  }
  
  if (brandLower === 'discover') {
    return (
      <div className="flex items-center justify-center w-12 h-8 bg-orange-500 rounded text-white font-bold text-xs">
        DISC
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center w-12 h-8 bg-muted rounded">
      <CreditCard className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface ManagePaymentMethodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethods: PaymentMethod[];
  companyId?: string;
}

export function ManagePaymentMethodsDialog({
  open,
  onOpenChange,
  paymentMethods,
  companyId,
}: ManagePaymentMethodsDialogProps) {
  const [showAddCard, setShowAddCard] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSetDefault = async (paymentMethodId: string) => {
    setIsSettingDefault(paymentMethodId);
    try {
      const response = await apiRequest("POST", "/api/billing/set-default-payment-method", {
        paymentMethodId,
        companyId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to set default payment method");
      }

      toast({
        title: "Success",
        description: "Default payment method updated successfully",
      });

      // Refresh payment methods
      queryClient.invalidateQueries({ queryKey: ["/api/billing/payment-methods"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to set default payment method",
        variant: "destructive",
      });
    } finally {
      setIsSettingDefault(null);
    }
  };

  const handleDeleteCard = async (paymentMethodId: string) => {
    setIsDeletingCard(paymentMethodId);
    try {
      const response = await apiRequest("DELETE", `/api/billing/payment-method/${paymentMethodId}`, {
        companyId,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete payment method");
      }

      toast({
        title: "Success",
        description: "Payment method deleted successfully",
      });

      // Refresh payment methods
      queryClient.invalidateQueries({ queryKey: ["/api/billing/payment-methods"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment method",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCard(null);
    }
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    toast({
      title: "Success",
      description: "Payment method added successfully",
    });
    // Refresh payment methods
    queryClient.invalidateQueries({ queryKey: ["/api/billing/payment-methods"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-manage-payment-methods">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl">Manage your payment methods</DialogTitle>
          <DialogDescription>
            Set primary card or add/delete cards
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className="flex items-center gap-4 p-4 rounded-lg border bg-card hover-elevate"
              data-testid={`card-payment-method-${pm.id}`}
            >
              <CardBrandLogo brand={pm.brand} />
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize" data-testid={`text-card-brand-${pm.id}`}>
                    {pm.brand}
                  </span>
                  <span className="text-muted-foreground" data-testid={`text-card-last4-${pm.id}`}>
                    **** {pm.last4}
                  </span>
                  {pm.isDefault && (
                    <Badge variant="default" className="ml-2" data-testid={`badge-primary-${pm.id}`}>
                      Primary Card
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground" data-testid={`text-card-expiry-${pm.id}`}>
                  Expires {pm.expMonth}/{pm.expYear}
                </p>
              </div>

              {!pm.isDefault && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-card-options-${pm.id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleSetDefault(pm.id)}
                      disabled={isSettingDefault === pm.id}
                      data-testid={`button-set-default-${pm.id}`}
                    >
                      {isSettingDefault === pm.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Setting as primary...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Set as Primary
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteCard(pm.id)}
                      disabled={isDeletingCard === pm.id}
                      className="text-destructive focus:text-destructive"
                      data-testid={`button-delete-${pm.id}`}
                    >
                      {isDeletingCard === pm.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Card
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}

          {paymentMethods.length === 0 && !showAddCard && (
            <Alert>
              <AlertDescription>
                No payment methods found. Add a card to get started.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {showAddCard ? (
          <div className="mt-4 p-4 rounded-lg border bg-card">
            <h3 className="font-medium mb-4">Add New Card</h3>
            <StripeCardForm
              onSuccess={handleCardAdded}
              onError={(error) => {
                toast({
                  title: "Error",
                  description: error,
                  variant: "destructive",
                });
              }}
              companyId={companyId}
            />
            <Button
              variant="ghost"
              onClick={() => setShowAddCard(false)}
              className="mt-2"
              data-testid="button-cancel-add-card"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowAddCard(true)}
            className="w-full mt-4"
            data-testid="button-add-new-card"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Card
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
