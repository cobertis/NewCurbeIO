import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatForDisplay } from "@shared/phone";

// Extended type with display properties added by backend
interface PhoneNumberWithDisplay extends BulkvsPhoneNumber {
  didDisplay?: string;
  callForwardNumberDisplay?: string | null;
}

interface PhoneSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: PhoneNumberWithDisplay;
}

export function PhoneSettingsModal({ open, onOpenChange, phoneNumber }: PhoneSettingsModalProps) {
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(phoneNumber.displayName || "");
  const [callForwardEnabled, setCallForwardEnabled] = useState(phoneNumber.callForwardEnabled || false);
  const [callForwardNumber, setCallForwardNumber] = useState(phoneNumber.callForwardNumber || "");
  const [isEditingCallForward, setIsEditingCallForward] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [isEditingCNAM, setIsEditingCNAM] = useState(false);
  const [cnamValue, setCnamValue] = useState(phoneNumber.cnam || "");

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

  // CNAM Validation: Max 15 alphanumeric characters
  const sanitizeCNAM = (value: string): string => {
    // Remove any non-alphanumeric characters and limit to 15 chars
    return value.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 15);
  };

  const isCNAMValid = cnamValue.length > 0 && cnamValue.length <= 15;

  const updateCNAMMutation = useMutation({
    mutationFn: async () => {
      if (!isCNAMValid) {
        throw new Error("CNAM must be 1-15 alphanumeric characters");
      }
      return apiRequest("PATCH", `/api/bulkvs/numbers/${phoneNumber.id}/cnam`, {
        cnam: cnamValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bulkvs/numbers"] });
      toast({
        title: "CNAM updated",
        description: "Caller ID name has been updated successfully.",
      });
      setIsEditingCNAM(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveCNAM = () => {
    if (!isCNAMValid) {
      toast({
        title: "Invalid CNAM",
        description: "CNAM must be 1-15 alphanumeric characters.",
        variant: "destructive",
      });
      return;
    }
    updateCNAMMutation.mutate();
  };

  const handleCancelCNAM = () => {
    setCnamValue(phoneNumber.cnam || "");
    setIsEditingCNAM(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="phone-settings-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="modal-title">
            <Phone className="h-5 w-5" />
            Phone Number Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* My Number - Full Width */}
          <div className="space-y-2 text-center border-b pb-4">
            <h1 className="text-3xl font-bold tracking-tight" data-testid="my-number-title">
              My Number
            </h1>
            <p className="text-2xl font-semibold" data-testid="phone-number">
              {phoneNumber.didDisplay || formatForDisplay(phoneNumber.did)}
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
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

              {/* CNAM (Caller ID Name) Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Caller ID Name (CNAM)</CardTitle>
                  <CardDescription>
                    Set the caller ID name that appears when you call someone
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      CNAM must be 1-15 alphanumeric characters. Special characters will be removed automatically.
                    </AlertDescription>
                  </Alert>

                  {isEditingCNAM ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnam-value">Caller ID Name</Label>
                        <Input
                          id="cnam-value"
                          type="text"
                          placeholder="Your Company Name"
                          maxLength={15}
                          value={cnamValue}
                          onChange={(e) => setCnamValue(sanitizeCNAM(e.target.value))}
                          className={!isCNAMValid && cnamValue.length > 0 ? "border-red-500" : ""}
                          data-testid="input-cnam"
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {cnamValue.length}/15 characters
                          </p>
                          {!isCNAMValid && cnamValue.length > 0 && (
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                              Must be 1-15 characters
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveCNAM}
                          disabled={updateCNAMMutation.isPending || !isCNAMValid}
                          data-testid="button-save-cnam"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {updateCNAMMutation.isPending ? "Updating..." : "Update CNAM"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={handleCancelCNAM}
                          data-testid="button-cancel-cnam"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <span className="text-sm text-muted-foreground">Current CNAM</span>
                        <span className="font-medium" data-testid="cnam-display">
                          {phoneNumber.cnam || "Not set"}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => setIsEditingCNAM(true)}
                        className="w-full"
                        data-testid="button-edit-cnam"
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Update Caller ID Name
                      </Button>
                    </div>
                  )}
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
                      Call forwarding will be automatically configured via BulkVS API. Changes may take a few moments to propagate.
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
                            {phoneNumber.callForwardNumberDisplay || formatForDisplay(phoneNumber.callForwardNumber)}
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
            </div>

            {/* Right Column */}
            <div className="space-y-6">
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
                    onClick={() => setShowDeactivateDialog(true)}
                    disabled={deactivateNumberMutation.isPending}
                    data-testid="button-deactivate"
                  >
                    {deactivateNumberMutation.isPending ? "Deactivating..." : "Deactivate Number"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Deactivating this phone number will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Cancel your subscription immediately</li>
                <li>Delete all conversations and message history</li>
                <li>Release the phone number permanently</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-deactivate">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deactivateNumberMutation.mutate();
                setShowDeactivateDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-deactivate"
            >
              Deactivate Number
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
