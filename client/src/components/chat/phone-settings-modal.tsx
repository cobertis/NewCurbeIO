import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Calendar, DollarSign, CheckCircle2, XCircle, Edit2, Save, X } from "lucide-react";
import type { BulkvsPhoneNumber } from "@shared/schema";

interface PhoneSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: BulkvsPhoneNumber;
}

export function PhoneSettingsModal({ open, onOpenChange, phoneNumber }: PhoneSettingsModalProps) {
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(phoneNumber.displayName || "");

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const match = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
      }
    }
    return phone;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  };

  const updateNameMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/bulkvs/numbers/${phoneNumber.id}`, {
        displayName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "Name updated",
        description: "Display name has been updated successfully.",
      });
      setIsEditingName(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deactivateNumberMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/bulkvs/numbers/${phoneNumber.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "Number deactivated",
        description: "Phone number has been deactivated and billing has been cancelled.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Deactivation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveName = () => {
    if (displayName.trim() === "") {
      toast({
        title: "Invalid name",
        description: "Display name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    updateNameMutation.mutate();
  };

  const handleCancelEdit = () => {
    setDisplayName(phoneNumber.displayName || "");
    setIsEditingName(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="phone-settings-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="modal-title">
            <Phone className="h-5 w-5" />
            Phone Number Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Phone Number Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phone Number</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Number</Label>
                <p className="text-2xl font-bold" data-testid="phone-number">
                  {formatPhoneNumber(phoneNumber.did)}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="area-code">
                  Area Code: {phoneNumber.areaCode}
                </p>
              </div>

              <Separator />

              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Display Name</Label>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter display name"
                      data-testid="input-display-name"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveName}
                      disabled={updateNameMutation.isPending}
                      data-testid="button-save-name"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-medium" data-testid="display-name">
                      {phoneNumber.displayName}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingName(true)}
                      data-testid="button-edit-name"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">10DLC Campaign ID</span>
                <Badge variant="secondary" data-testid="campaign-id">
                  {phoneNumber.campaignId || "N/A"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SMS Enabled</span>
                {phoneNumber.smsEnabled ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" data-testid="sms-enabled" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" data-testid="sms-disabled" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">MMS Enabled</span>
                {phoneNumber.mmsEnabled ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" data-testid="mms-enabled" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" data-testid="mms-disabled" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant={phoneNumber.status === "active" ? "default" : "secondary"}
                  data-testid="phone-status"
                >
                  {phoneNumber.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Billing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Cost</span>
                <span className="text-lg font-bold" data-testid="monthly-cost">
                  ${phoneNumber.monthlyPrice}/month
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next Billing Date</span>
                <span className="text-sm font-medium" data-testid="next-billing-date">
                  {formatDate(phoneNumber.nextBillingDate)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Billing Status</span>
                <Badge 
                  variant={phoneNumber.billingStatus === "active" ? "default" : "secondary"}
                  data-testid="billing-status"
                >
                  {phoneNumber.billingStatus}
                </Badge>
              </div>

              {phoneNumber.stripeSubscriptionId && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Stripe Subscription ID: {phoneNumber.stripeSubscriptionId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Deactivate this phone number and cancel the subscription. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm("Are you sure you want to deactivate this number? All conversations will be lost.")) {
                    deactivateNumberMutation.mutate();
                  }
                }}
                disabled={deactivateNumberMutation.isPending}
                data-testid="button-deactivate"
              >
                {deactivateNumberMutation.isPending ? "Deactivating..." : "Deactivate Number"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
