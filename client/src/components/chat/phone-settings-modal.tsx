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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Phone, Calendar, DollarSign, CheckCircle2, XCircle, Edit2, Save, X, PhoneForwarded, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [callForwardEnabled, setCallForwardEnabled] = useState(phoneNumber.callForwardEnabled || false);
  const [callForwardNumber, setCallForwardNumber] = useState(phoneNumber.callForwardNumber || "");
  const [isEditingCallForward, setIsEditingCallForward] = useState(false);

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

  const updateCallForwardMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/bulkvs/numbers/${phoneNumber.id}`, {
        callForwardEnabled,
        callForwardNumber: callForwardEnabled ? callForwardNumber : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "Call Forward updated",
        description: "Call forwarding settings have been updated successfully.",
      });
      setIsEditingCallForward(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveCallForward = () => {
    if (callForwardEnabled && !callForwardNumber.trim()) {
      toast({
        title: "Invalid number",
        description: "Please enter a phone number for call forwarding.",
        variant: "destructive",
      });
      return;
    }
    updateCallForwardMutation.mutate();
  };

  const handleCancelCallForward = () => {
    setCallForwardEnabled(phoneNumber.callForwardEnabled || false);
    setCallForwardNumber(phoneNumber.callForwardNumber || "");
    setIsEditingCallForward(false);
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

          {/* Call Forward Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PhoneForwarded className="h-5 w-5" />
                Call Forwarding
              </CardTitle>
              <CardDescription>
                Forward incoming calls to another phone number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Call forwarding must also be configured in the BulkVS portal under Trunk Groups. This setting stores your preference but requires portal configuration to activate.
                </AlertDescription>
              </Alert>

              {isEditingCallForward ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="call-forward-enabled">Enable Call Forwarding</Label>
                    <Switch
                      id="call-forward-enabled"
                      checked={callForwardEnabled}
                      onCheckedChange={setCallForwardEnabled}
                      data-testid="switch-call-forward-enabled"
                    />
                  </div>

                  {callForwardEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="call-forward-number">Forward To Number</Label>
                      <Input
                        id="call-forward-number"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={callForwardNumber}
                        onChange={(e) => setCallForwardNumber(e.target.value)}
                        data-testid="input-call-forward-number"
                      />
                      <p className="text-sm text-muted-foreground">
                        Enter the phone number where calls should be forwarded
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveCallForward}
                      disabled={updateCallForwardMutation.isPending}
                      data-testid="button-save-call-forward"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateCallForwardMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleCancelCallForward}
                      data-testid="button-cancel-call-forward"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={phoneNumber.callForwardEnabled ? "default" : "secondary"} data-testid="call-forward-status">
                      {phoneNumber.callForwardEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>

                  {phoneNumber.callForwardEnabled && phoneNumber.callForwardNumber && (
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm text-muted-foreground">Forward To</span>
                      <span className="font-medium" data-testid="call-forward-number-display">
                        {phoneNumber.callForwardNumber}
                      </span>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setIsEditingCallForward(true)}
                    className="w-full"
                    data-testid="button-edit-call-forward"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Configure Call Forwarding
                  </Button>
                </div>
              )}
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
