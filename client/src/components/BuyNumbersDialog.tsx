import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BuyNumbersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNumberPurchased?: () => void;
}

export function BuyNumbersDialog({ open, onOpenChange, onNumberPurchased }: BuyNumbersDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buy Phone Number</DialogTitle>
          <DialogDescription>
            Phone system is being reconfigured. This feature will be available soon.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-buy-numbers">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
