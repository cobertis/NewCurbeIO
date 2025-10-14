import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User as UserIcon, Building2, Bell, Shield, Mail, FileText } from "lucide-react";
import type { User, CompanySettings } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmailTemplatesManager } from "@/components/email-templates-manager";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: userData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data: preferencesData } = useQuery<{ preferences: any }>({
    queryKey: ["/api/settings/preferences"],
  });

  const { data: companySettingsData } = useQuery<{ settings: CompanySettings }>({
    queryKey: ["/api/settings/company"],
    enabled: userData?.user?.role === "admin" || userData?.user?.role === "superadmin",
  });

  const [emailTestAddress, setEmailTestAddress] = useState("");
  
  const user = userData?.user;
  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      });
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string }) => {
      return apiRequest("PATCH", "/api/settings/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", "/api/settings/preferences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/preferences"] });
      toast({
        title: "Preferences updated",
        description: "Your preferences have been saved.",
      });
    },
  });

  // Send test email mutation
  const sendTestEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest("POST", "/api/email/send-test", { to: email });
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: "Check your inbox for the test email.",
      });
      setEmailTestAddress("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test email. Check SMTP configuration.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailTestAddress) {
      sendTestEmailMutation.mutate(emailTestAddress);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and system preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 lg:w-auto">
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <UserIcon className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2" data-testid="tab-preferences">
            <Bell className="h-4 w-4" />
            Preferences
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="company" className="gap-2" data-testid="tab-company">
              <Building2 className="h-4 w-4" />
              Company
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="system" className="gap-2" data-testid="tab-system">
              <Mail className="h-4 w-4" />
              System
            </TabsTrigger>
          )}
          <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and contact details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                      data-testid="input-firstname"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                      data-testid="input-lastname"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    data-testid="input-email-settings"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={user?.role || ""}
                    disabled
                    className="bg-muted"
                    data-testid="input-role"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications" className="text-base">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email updates about your account activity.
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  defaultChecked={preferencesData?.preferences?.emailNotifications}
                  onCheckedChange={(checked) => {
                    updatePreferencesMutation.mutate({
                      ...preferencesData?.preferences,
                      emailNotifications: checked,
                    });
                  }}
                  data-testid="switch-email-notifications"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="marketingEmails" className="text-base">
                    Marketing Emails
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive emails about new features and updates.
                  </p>
                </div>
                <Switch
                  id="marketingEmails"
                  defaultChecked={preferencesData?.preferences?.marketingEmails}
                  onCheckedChange={(checked) => {
                    updatePreferencesMutation.mutate({
                      ...preferencesData?.preferences,
                      marketingEmails: checked,
                    });
                  }}
                  data-testid="switch-marketing-emails"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="invoiceAlerts" className="text-base">
                    Invoice Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when new invoices are generated.
                  </p>
                </div>
                <Switch
                  id="invoiceAlerts"
                  defaultChecked={true}
                  data-testid="switch-invoice-alerts"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Settings Tab */}
        {isAdmin && (
          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Manage your company's configuration and preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={companySettingsData?.settings?.companyId || ""}
                    disabled
                    className="bg-muted"
                    data-testid="input-company-name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        defaultValue={companySettingsData?.settings?.primaryColor || "#2196F3"}
                        className="h-10 w-20"
                        data-testid="input-primary-color"
                      />
                      <Input
                        defaultValue={companySettingsData?.settings?.primaryColor || "#2196F3"}
                        className="flex-1"
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        defaultValue={companySettingsData?.settings?.secondaryColor || "#1976D2"}
                        className="h-10 w-20"
                        data-testid="input-secondary-color"
                      />
                      <Input
                        defaultValue={companySettingsData?.settings?.secondaryColor || "#1976D2"}
                        className="flex-1"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                <Button data-testid="button-save-company">Save Company Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* System Settings Tab (Superadmin only) */}
        {isSuperAdmin && (
          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email & SMTP Configuration</CardTitle>
                  <CardDescription>
                    Configure system-wide email notification settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="p-4 border border-border rounded-md bg-muted/50">
                      <h4 className="text-sm font-medium mb-2">SMTP Status</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        SMTP credentials are configured via environment variables.
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SMTP Host:</span>
                          <span className="font-mono">Configured</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SMTP Port:</span>
                          <span className="font-mono">Configured</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">From Email:</span>
                          <span className="font-mono">Configured</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="testEmail">Test Email Configuration</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Send a test email to verify your SMTP configuration is working.
                      </p>
                      <form onSubmit={handleSendTestEmail} className="flex gap-2">
                        <Input
                          id="testEmail"
                          type="email"
                          placeholder="test@example.com"
                          value={emailTestAddress}
                          onChange={(e) => setEmailTestAddress(e.target.value)}
                          data-testid="input-test-email"
                          required
                        />
                        <Button
                          type="submit"
                          disabled={sendTestEmailMutation.isPending}
                          data-testid="button-send-test-email"
                        >
                          {sendTestEmailMutation.isPending ? "Sending..." : "Send Test"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Notifications</CardTitle>
                  <CardDescription>
                    Configure system-wide notification behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="systemNotifications" className="text-base">
                        Enable System Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Send automated notifications for system events.
                      </p>
                    </div>
                    <Switch
                      id="systemNotifications"
                      defaultChecked={true}
                      data-testid="switch-system-notifications"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="batchNotifications" className="text-base">
                        Batch Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Group multiple notifications into digest emails.
                      </p>
                    </div>
                    <Switch
                      id="batchNotifications"
                      defaultChecked={false}
                      data-testid="switch-batch-notifications"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <EmailTemplatesManager />
          </TabsContent>
        )}

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    data-testid="input-current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    data-testid="input-new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button
                  type="submit"
                  variant="destructive"
                  data-testid="button-change-password"
                >
                  Change Password
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Management</CardTitle>
              <CardDescription>
                Manage your active sessions and devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-md">
                  <div>
                    <p className="text-sm font-medium">Current Session</p>
                    <p className="text-xs text-muted-foreground">Active now</p>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-logout-session">
                    Logout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
