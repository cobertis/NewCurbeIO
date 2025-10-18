import { useState } from "react";
import {
  useStripe,
  useElements,
  CardElement,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Load Stripe with public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

// Card element styling options
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      letterSpacing: '0.025em',
      fontFamily: 'Source Code Pro, monospace',
      '::placeholder': {
        color: '#aab7c4',
      },
      padding: '10px 14px',
    },
    invalid: {
      color: '#9e2146',
      iconColor: '#9e2146'
    },
  },
  hidePostalCode: false,
};

interface StripeCardFormInnerProps {
  onSuccess: () => void;
  onError: (error: string) => void;
  companyId?: string;
}

function StripeCardFormInner({ onSuccess, onError, companyId }: StripeCardFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create SetupIntent on the backend
      const setupIntentResponse = await apiRequest("POST", "/api/billing/create-setup-intent", {
        companyId
      });
      const { clientSecret } = await setupIntentResponse.json();

      if (!clientSecret) {
        throw new Error("Failed to create setup intent");
      }

      // Step 2: Confirm the SetupIntent with the card element
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card element not found");
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          }
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message || "Failed to confirm card setup");
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error("Setup intent confirmation failed");
      }

      // Step 3: Attach the payment method and set as default
      const attachResponse = await apiRequest("POST", "/api/billing/attach-payment-method", {
        paymentMethodId: setupIntent.payment_method,
        companyId
      });

      const result = await attachResponse.json();
      
      if (!attachResponse.ok) {
        throw new Error(result.message || "Failed to attach payment method");
      }

      // Success!
      onSuccess();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to add payment method";
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Card Information
        </label>
        <div className="border rounded-lg p-4 bg-background">
          <CardElement 
            options={CARD_ELEMENT_OPTIONS}
            className="py-2"
          />
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
          <Lock className="h-3 w-3" />
          Your payment info is securely processed by Stripe
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3 justify-end">
        <Button
          type="submit"
          disabled={!stripe || isLoading}
          className="min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Add Card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Wrapper component with Stripe Elements provider
export function StripeCardForm({ onSuccess, onError, companyId }: StripeCardFormInnerProps) {
  return (
    <Elements stripe={stripePromise}>
      <StripeCardFormInner onSuccess={onSuccess} onError={onError} companyId={companyId} />
    </Elements>
  );
}