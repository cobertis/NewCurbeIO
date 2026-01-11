import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Phone, MessageSquare, Headphones, Save } from "lucide-react";
import { SettingsLayout } from "@/components/settings-layout";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  capabilities?: string[];
}

interface TelephonySettings {
  defaultSmsNumberId: string | null;
  defaultVoiceNumberId: string | null;
  webphoneRingNumberIds: string[];
  smsRoutingMode: "default" | "per_user" | "round_robin";
  voiceRoutingMode: "default" | "per_user" | "round_robin";
}

interface PhoneRoutingData {
  telephonySettings: TelephonySettings;
  phoneNumbers: PhoneNumber[];
  voiceCapableNumbers: PhoneNumber[];
  smsCapableNumbers: PhoneNumber[];
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const areaCode = cleaned.slice(1, 4);
    const exchange = cleaned.slice(4, 7);
    const subscriber = cleaned.slice(7);
    return `+1 (${areaCode}) ${exchange}-${subscriber}`;
  }
  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const exchange = cleaned.slice(3, 6);
    const subscriber = cleaned.slice(6);
    return `+1 (${areaCode}) ${exchange}-${subscriber}`;
  }
  return phone;
}

function getPhoneDisplayLabel(pn: PhoneNumber): string {
  const formattedNumber = formatPhoneNumber(pn.phoneNumber);
  return pn.displayName ? `${formattedNumber} - ${pn.displayName}` : formattedNumber;
}

export default function SmsVoiceSenderSettings() {
  const { toast } = useToast();

  const [defaultSmsNumberId, setDefaultSmsNumberId] = useState<string | null>(null);
  const [defaultVoiceNumberId, setDefaultVoiceNumberId] = useState<string | null>(null);
  const [webphoneRingNumberIds, setWebphoneRingNumberIds] = useState<string[]>([]);
  const [smsRoutingMode, setSmsRoutingMode] = useState<"default" | "per_user" | "round_robin">("default");
  const [voiceRoutingMode, setVoiceRoutingMode] = useState<"default" | "per_user" | "round_robin">("default");
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading, error } = useQuery<PhoneRoutingData>({
    queryKey: ["/api/company-settings/phone-number-routing"],
  });

  useEffect(() => {
    if (data?.telephonySettings) {
      const ts = data.telephonySettings;
      setDefaultSmsNumberId(ts.defaultSmsNumberId);
      setDefaultVoiceNumberId(ts.defaultVoiceNumberId);
      setWebphoneRingNumberIds(ts.webphoneRingNumberIds || []);
      setSmsRoutingMode(ts.smsRoutingMode || "default");
      setVoiceRoutingMode(ts.voiceRoutingMode || "default");
      setIsDirty(false);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<TelephonySettings>) => {
      return apiRequest("PUT", "/api/company-settings/phone-number-routing", payload);
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Phone number routing settings have been updated.",
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings/phone-number-routing"] });
      setIsDirty(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      defaultSmsNumberId,
      defaultVoiceNumberId,
      webphoneRingNumberIds,
      smsRoutingMode,
      voiceRoutingMode,
    });
  };

  const handleWebphoneNumberToggle = (numberId: string, checked: boolean) => {
    setIsDirty(true);
    if (checked) {
      setWebphoneRingNumberIds(prev => [...prev, numberId]);
    } else {
      setWebphoneRingNumberIds(prev => prev.filter(id => id !== numberId));
    }
  };

  if (isLoading) {
    return (
      <SettingsLayout activeSection="sms-voice">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner message="Loading phone routing settings..." />
        </div>
      </SettingsLayout>
    );
  }

  if (error) {
    return (
      <SettingsLayout activeSection="sms-voice">
        <div className="space-y-6" data-testid="page-sms-voice-sender-settings">
          <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-sms-sender">
            <Link href="/settings/sms-voice" className="text-muted-foreground hover:text-foreground transition-colors">SMS & Voice</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Sender Settings</span>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive">Failed to load settings: {(error as Error).message}</p>
            </CardContent>
          </Card>
        </div>
      </SettingsLayout>
    );
  }

  const smsNumbers = data?.smsCapableNumbers || [];
  const voiceNumbers = data?.voiceCapableNumbers || [];

  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-sender-settings">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-sms-sender">
            <Link href="/settings/sms-voice" className="text-muted-foreground hover:text-foreground transition-colors">SMS & Voice</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Sender Settings</span>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending || !isDirty}
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? (
              <LoadingSpinner fullScreen={false} className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Default Sender Numbers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default-sms-number">Default SMS Number</Label>
                <Select
                  value={defaultSmsNumberId || "none"}
                  onValueChange={(value) => {
                    setDefaultSmsNumberId(value === "none" ? null : value);
                    setIsDirty(true);
                  }}
                  data-testid="select-default-sms"
                >
                  <SelectTrigger id="default-sms-number" data-testid="select-trigger-default-sms">
                    <SelectValue placeholder="Select default SMS number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default</SelectItem>
                    {smsNumbers.map((pn) => (
                      <SelectItem key={pn.id} value={pn.id}>
                        {getPhoneDisplayLabel(pn)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for outbound SMS when no specific number is assigned
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-voice-number">Default Voice Number</Label>
                <Select
                  value={defaultVoiceNumberId || "none"}
                  onValueChange={(value) => {
                    setDefaultVoiceNumberId(value === "none" ? null : value);
                    setIsDirty(true);
                  }}
                  data-testid="select-default-voice"
                >
                  <SelectTrigger id="default-voice-number" data-testid="select-trigger-default-voice">
                    <SelectValue placeholder="Select default voice number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default</SelectItem>
                    {voiceNumbers.map((pn) => (
                      <SelectItem key={pn.id} value={pn.id}>
                        {getPhoneDisplayLabel(pn)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for outbound calls when no specific number is assigned
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              WebPhone Ring Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select which phone numbers should ring on the WebPhone for incoming calls
            </p>
            {voiceNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No voice-capable numbers available</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {voiceNumbers.map((pn) => (
                  <div key={pn.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`webphone-${pn.id}`}
                      checked={webphoneRingNumberIds.includes(pn.id)}
                      onCheckedChange={(checked) => handleWebphoneNumberToggle(pn.id, !!checked)}
                      data-testid={`checkbox-webphone-${pn.id}`}
                    />
                    <Label 
                      htmlFor={`webphone-${pn.id}`} 
                      className="text-sm font-normal cursor-pointer"
                    >
                      {getPhoneDisplayLabel(pn)}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Routing Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label>SMS Routing Mode</Label>
                <RadioGroup
                  value={smsRoutingMode}
                  onValueChange={(value: "default" | "per_user" | "round_robin") => {
                    setSmsRoutingMode(value);
                    setIsDirty(true);
                  }}
                  className="space-y-2"
                  data-testid="radio-group-sms-routing"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="default" id="sms-default" data-testid="radio-sms-default" />
                    <Label htmlFor="sms-default" className="font-normal cursor-pointer">Use Default</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="per_user" id="sms-per-user" data-testid="radio-sms-per-user" />
                    <Label htmlFor="sms-per-user" className="font-normal cursor-pointer">Per User Assignment</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="round_robin" id="sms-round-robin" data-testid="radio-sms-round-robin" />
                    <Label htmlFor="sms-round-robin" className="font-normal cursor-pointer">Round Robin</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Voice Routing Mode</Label>
                <RadioGroup
                  value={voiceRoutingMode}
                  onValueChange={(value: "default" | "per_user" | "round_robin") => {
                    setVoiceRoutingMode(value);
                    setIsDirty(true);
                  }}
                  className="space-y-2"
                  data-testid="radio-group-voice-routing"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="default" id="voice-default" data-testid="radio-voice-default" />
                    <Label htmlFor="voice-default" className="font-normal cursor-pointer">Use Default</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="per_user" id="voice-per-user" data-testid="radio-voice-per-user" />
                    <Label htmlFor="voice-per-user" className="font-normal cursor-pointer">Per User Assignment</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="round_robin" id="voice-round-robin" data-testid="radio-voice-round-robin" />
                    <Label htmlFor="voice-round-robin" className="font-normal cursor-pointer">Round Robin</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsLayout>
  );
}
