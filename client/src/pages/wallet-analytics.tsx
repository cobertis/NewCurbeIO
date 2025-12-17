import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { 
  Wallet, Smartphone, Users, Link, Download, AlertCircle,
  BarChart3, Apple, Chrome, Eye, Plus, RefreshCw, Copy, ExternalLink, ChevronRight, Settings, Upload, Key, FileCheck, Trash2, Bell, Send
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo, useRef, useCallback } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useWebSocket } from "@/hooks/use-websocket";

interface AnalyticsSummary {
  totalMembers: number;
  totalLinks: number;
  totalOpens: number;
  appleDownloads: number;
  appleInstalls: number;
  googleClicks: number;
  googleSaved: number;
  errors: number;
  installedPassesCount: number;
  registeredDevicesCount: number;
}

interface WalletMember {
  id: string;
  fullName: string;
  memberId: string;
  email: string | null;
  phone: string | null;
  plan: string | null;
  memberSince: string | null;
  carrierName: string | null;
  planId: string | null;
  planName: string | null;
  monthlyPremium: string | null;
  contactId: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface WalletEvent {
  id: string;
  type: string;
  os: string | null;
  deviceType: string | null;
  browser: string | null;
  createdAt: string;
}

interface WalletConfig {
  appleConfigured: boolean;
  googleConfigured: boolean;
}

interface WalletSettingsResponse {
  appleTeamId?: string;
  applePassTypeIdentifier?: string;
  appleP12Configured?: boolean;
  appleP12PasswordConfigured?: boolean;
  appleIconConfigured?: boolean;
  googleServiceAccountConfigured?: boolean;
  googleIssuerId?: string;
  encryptionKeyConfigured?: boolean;
}

export default function WalletAnalyticsPage() {
  const { toast } = useToast();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  
  const [appleTeamId, setAppleTeamId] = useState("");
  const [applePassTypeId, setApplePassTypeId] = useState("");
  const [appleP12Password, setAppleP12Password] = useState("");
  const [appleP12File, setAppleP12File] = useState<File | null>(null);
  const [appleIconFile, setAppleIconFile] = useState<File | null>(null);
  const [googleServiceAccountFile, setGoogleServiceAccountFile] = useState<File | null>(null);
  const [googleIssuerId, setGoogleIssuerId] = useState("");
  const [encryptionKey, setEncryptionKey] = useState("");
  
  const appleP12InputRef = useRef<HTMLInputElement>(null);
  const appleIconInputRef = useRef<HTMLInputElement>(null);
  const googleServiceInputRef = useRef<HTMLInputElement>(null);
  
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [createNewMember, setCreateNewMember] = useState(false);
  
  const form = useForm({
    defaultValues: {
      fullName: "",
      memberId: "",
      email: "",
      phone: "",
      plan: "standard",
      carrierName: "",
      planId: "",
      planName: "",
      monthlyPremium: "",
      metalLevel: "",
      planType: "",
      effectiveDate: "",
      expirationDate: "",
      marketplaceId: "",
      contactId: "",
    },
  });

  // Real-time WebSocket updates for analytics
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'wallet_analytics_update') {
      // Invalidate all wallet analytics queries to refresh data in real-time
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/events", { limit: 50 }] });
    }
  }, []);
  
  useWebSocket(handleWebSocketMessage);

  const { data: config, isLoading: configLoading } = useQuery<WalletConfig>({
    queryKey: ["/api/wallet/config"],
  });

  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<WalletSettingsResponse>({
    queryKey: ["/api/wallet/settings"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/wallet/analytics"],
  });

  const { data: members, isLoading: membersLoading } = useQuery<WalletMember[]>({
    queryKey: ["/api/wallet/members"],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<WalletEvent[]>({
    queryKey: ["/api/wallet/events", { limit: 50 }],
  });

  const { data: policiesData } = useQuery<{ items: any[] }>({
    queryKey: ["/api/policies", contactSearch],
    queryFn: async () => {
      const res = await fetch(`/api/policies?searchTerm=${encodeURIComponent(contactSearch)}&limit=10`);
      if (!res.ok) throw new Error("Failed to fetch policies");
      return res.json();
    },
    enabled: contactSearch.length >= 2,
  });

  const filteredContacts = useMemo(() => {
    if (!policiesData?.items || contactSearch.length < 2) return [];
    // Transform policies to contact-like objects using client info
    // Note: These are policy-based entries, NOT real contacts - contactId should be null
    return policiesData.items.map((policy: any) => {
      // selectedPlan contains planData from policy_plans (merged in getPoliciesList)
      // The plan data includes all manual entry fields stored in JSONB
      // CRITICAL: selectedPlan may be a JSON string - parse it if needed
      let plan = policy.selectedPlan || {};
      if (typeof plan === 'string') {
        try {
          plan = JSON.parse(plan);
        } catch (e) {
          plan = {};
        }
      }
      
      // Extract ALL fields from the plan data (stored in planData JSONB)
      const carrierName = plan?.issuer?.name || plan?.carrierName || "";
      const planName = plan?.name || plan?.planName || "";
      const planId = plan?.id || plan?.planId || "";
      const monthlyPremium = plan?.premium_w_credit ?? plan?.premium ?? plan?.monthlyPremium ?? "";
      const memberId = plan?.memberId || "";
      const metalLevel = plan?.metal_level || plan?.metalLevel || "";
      const planType = plan?.type || plan?.plan_type || plan?.planType || "";
      const effectiveDate = plan?.effectiveDate || policy.effectiveDate || "";
      const expirationDate = plan?.expirationDate || "";
      const marketplaceId = plan?.marketplaceId || "";
      
      return {
        id: policy.id, // Policy ID for display purposes only
        isPolicyBased: true, // Flag to indicate this is from a policy, not a real contact
        firstName: policy.clientFirstName || "",
        lastName: policy.clientLastName || "",
        email: policy.clientEmail || "",
        phone: policy.clientPhone || "",
        // Include ALL policy info extracted from selectedPlan (planData JSONB)
        carrierName,
        planName,
        planId,
        monthlyPremium: String(monthlyPremium),
        memberId,
        metalLevel,
        planType,
        effectiveDate,
        expirationDate,
        marketplaceId,
        productType: policy.productType || "",
      };
    }).slice(0, 10);
  }, [policiesData, contactSearch]);

  const chartData = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    const eventsByDay = events.reduce((acc, event) => {
      const day = format(new Date(event.createdAt), "MMM dd");
      if (!acc[day]) {
        acc[day] = { date: day, opens: 0, downloads: 0, installs: 0 };
      }
      if (event.type.includes("open") || event.type.includes("view")) {
        acc[day].opens++;
      }
      if (event.type.includes("download") || event.type.includes("clicked")) {
        acc[day].downloads++;
      }
      if (event.type.includes("registered") || event.type.includes("confirmed") || event.type.includes("saved")) {
        acc[day].installs++;
      }
      return acc;
    }, {} as Record<string, { date: string; opens: number; downloads: number; installs: number }>);
    
    return Object.values(eventsByDay).slice(-7).reverse();
  }, [events]);

  const handleAddMember = async (values: any) => {
    try {
      // If selectedContact is from a policy (isPolicyBased), don't use its ID as contactId
      // because it's a policy ID, not a real contact ID in the contacts table
      const contactId = selectedContact && !(selectedContact as any).isPolicyBased 
        ? selectedContact.id 
        : null;
      
      const memberData = {
        ...values,
        contactId,
      };
      const newMember = await apiRequest("POST", "/api/wallet/members", memberData);
      
      // Auto-generate pass immediately after creating member
      try {
        const passData = await apiRequest("POST", `/api/wallet/members/${newMember.id}/pass`);
        if (passData.link?.url) {
          await navigator.clipboard.writeText(passData.link.url);
          toast({ title: "Member created and pass generated! Link copied to clipboard" });
        } else {
          toast({ title: "Member created and pass generated" });
        }
      } catch (passError) {
        console.error("[Wallet] Error auto-generating pass:", passError);
        toast({ title: "Member created, but pass generation failed", variant: "destructive" });
      }
      
      setShowAddMember(false);
      setSelectedContact(null);
      setContactSearch("");
      setCreateNewMember(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/analytics"] });
    } catch (error) {
      toast({ title: "Failed to create member", variant: "destructive" });
    }
  };

  const handleSelectContact = (contact: Contact & { 
    carrierName?: string; 
    planName?: string; 
    planId?: string; 
    monthlyPremium?: string; 
    memberId?: string; 
    metalLevel?: string;
    planType?: string;
    effectiveDate?: string;
    expirationDate?: string;
    marketplaceId?: string;
  }) => {
    setSelectedContact(contact);
    setContactSearch("");
    form.setValue("fullName", `${contact.firstName} ${contact.lastName}`.trim());
    form.setValue("email", contact.email || "");
    form.setValue("phone", contact.phone || "");
    form.setValue("contactId", contact.id);
    // Auto-fill insurance fields from policy
    if (contact.carrierName) form.setValue("carrierName", contact.carrierName);
    if (contact.planName) form.setValue("planName", contact.planName);
    if (contact.planId) form.setValue("planId", contact.planId);
    if (contact.monthlyPremium) form.setValue("monthlyPremium", String(contact.monthlyPremium));
    if (contact.memberId) form.setValue("memberId", contact.memberId);
    if (contact.metalLevel) form.setValue("metalLevel", contact.metalLevel);
    if (contact.planType) form.setValue("planType", contact.planType);
    if (contact.effectiveDate) form.setValue("effectiveDate", contact.effectiveDate);
    if (contact.expirationDate) form.setValue("expirationDate", contact.expirationDate);
    if (contact.marketplaceId) form.setValue("marketplaceId", contact.marketplaceId);
  };

  const handleGeneratePass = async (memberId: string) => {
    try {
      const data = await apiRequest("POST", `/api/wallet/members/${memberId}/pass`);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/analytics"] });
      if (data.link?.url) {
        await navigator.clipboard.writeText(data.link.url);
        toast({ title: "Pass generated! Link copied to clipboard" });
      } else {
        toast({ title: "Pass generated" });
      }
    } catch (error) {
      console.error("[Wallet] Error generating pass:", error);
      toast({ title: "Failed to generate pass", variant: "destructive" });
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to delete this member? This will also delete their pass and link.")) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/wallet/members/${memberId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/analytics"] });
      toast({ title: "Member deleted" });
    } catch (error) {
      console.error("[Wallet] Error deleting member:", error);
      toast({ title: "Failed to delete member", variant: "destructive" });
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const generateRandomKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEncryptionKey(key);
  };

  const handleSaveSettings = async () => {
    try {
      const payload: Record<string, string | undefined> = {};
      
      if (appleTeamId) payload.appleTeamId = appleTeamId;
      if (applePassTypeId) payload.applePassTypeIdentifier = applePassTypeId;
      if (appleP12Password) payload.appleP12Password = appleP12Password;
      if (googleIssuerId) payload.googleIssuerId = googleIssuerId;
      if (encryptionKey) payload.encryptionKey = encryptionKey;
      
      if (appleP12File) {
        payload.appleP12Base64 = await fileToBase64(appleP12File);
      }
      if (appleIconFile) {
        payload.appleIconBase64 = await fileToBase64(appleIconFile);
      }
      if (googleServiceAccountFile) {
        payload.googleServiceAccountJsonBase64 = await fileToBase64(googleServiceAccountFile);
      }
      
      await apiRequest("PUT", "/api/wallet/settings", payload);
      toast({ title: "Settings saved successfully" });
      setShowSettings(false);
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/settings"] });
      refetchSettings();
    } catch (error) {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  const handleOpenSettings = () => {
    if (settings) {
      setAppleTeamId(settings.appleTeamId || "");
      setApplePassTypeId(settings.applePassTypeIdentifier || "");
      setGoogleIssuerId(settings.googleIssuerId || "");
    }
    setShowSettings(true);
  };

  const [sendingNotification, setSendingNotification] = useState(false);
  
  const handleSendBulkNotification = async () => {
    if (!notificationMessage.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    
    setSendingNotification(true);
    try {
      const result = await apiRequest("POST", "/api/wallet/alerts/bulk", {
        message: notificationMessage.trim(),
      });
      toast({ 
        title: "Notification sent",
        description: result.message || `Updated ${result.passesUpdated} passes, notified ${result.devicesNotified} devices`,
      });
      setShowNotification(false);
      setNotificationMessage("");
    } catch (error: any) {
      console.error("[Wallet] Error sending notification:", error);
      toast({ 
        title: "Failed to send notification", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const getEventTypeIcon = (type: string) => {
    if (type.includes("apple")) return <Apple className="h-4 w-4" />;
    if (type.includes("google")) return <Chrome className="h-4 w-4" />;
    if (type.includes("link") || type.includes("view")) return <Eye className="h-4 w-4" />;
    return <BarChart3 className="h-4 w-4" />;
  };

  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      link_open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      ios_offer_view: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      android_offer_view: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      desktop_offer_view: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      apple_pkpass_download: "bg-gray-900 text-white dark:bg-gray-700",
      apple_device_registered: "bg-gray-900 text-white dark:bg-gray-700",
      google_save_clicked: "bg-blue-500 text-white",
      google_saved_confirmed: "bg-green-500 text-white",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatEventType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const totalDownloads = (summary?.appleDownloads || 0) + (summary?.googleClicks || 0);
  // Use registeredDevicesCount (actual confirmed installs) plus installed passes
  const actualInstalls = (summary?.registeredDevicesCount || 0) + (summary?.installedPassesCount || 0);
  const totalInstalls = actualInstalls > 0 ? actualInstalls : (summary?.appleInstalls || 0) + (summary?.googleSaved || 0);
  const conversionRate = (summary?.totalOpens || 0) > 0 
    ? ((totalInstalls / (summary?.totalOpens || 1)) * 100).toFixed(1) 
    : "0";

  const quickStats = [
    {
      count: summary?.totalMembers || 0,
      title: "Total Members",
      icon: Users,
      iconBg: "bg-blue-100 dark:bg-blue-900",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      count: summary?.totalOpens || 0,
      title: "Link Opens",
      icon: Link,
      iconBg: "bg-purple-100 dark:bg-purple-900",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      count: (summary?.registeredDevicesCount || 0) + (summary?.appleInstalls || 0),
      title: "Apple Installs",
      icon: Apple,
      iconBg: "bg-gray-100 dark:bg-gray-800",
      iconColor: "text-gray-800 dark:text-gray-200",
    },
    {
      count: (summary?.installedPassesCount || 0) + (summary?.googleSaved || 0),
      title: "Google Saved",
      icon: Chrome,
      iconBg: "bg-green-100 dark:bg-green-900",
      iconColor: "text-green-600 dark:text-green-400",
    },
  ];

  if (configLoading || summaryLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="flex flex-col gap-6 bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">Wallet System</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage member passes for Apple Wallet and Google Wallet</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={config?.appleConfigured ? "default" : "secondary"} className="gap-1" data-testid="badge-apple-status">
              <Apple className="h-3 w-3" />
              {config?.appleConfigured ? "Configured" : "Not Configured"}
            </Badge>
            <Badge variant={config?.googleConfigured ? "default" : "secondary"} className="gap-1" data-testid="badge-google-status">
              <Chrome className="h-3 w-3" />
              {config?.googleConfigured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
          <Dialog open={showNotification} onOpenChange={setShowNotification}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-send-notification">
                <Bell className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" aria-describedby="notification-description">
              <DialogHeader>
                <DialogTitle>Send Push Notification</DialogTitle>
              </DialogHeader>
              <p id="notification-description" className="sr-only">Send a push notification to all registered wallet pass holders</p>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="notification-message">Message</Label>
                  <Textarea
                    id="notification-message"
                    placeholder="Enter notification message..."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    rows={3}
                    maxLength={200}
                    data-testid="input-notification-message"
                  />
                  <p className="text-xs text-muted-foreground">{notificationMessage.length}/200 characters</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will update all active passes and send a push notification to registered devices.
                </p>
                <Button 
                  onClick={handleSendBulkNotification} 
                  disabled={sendingNotification || !notificationMessage.trim()}
                  className="w-full gap-2"
                  data-testid="button-confirm-notification"
                >
                  {sendingNotification ? (
                    <LoadingSpinner fullScreen={false} />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send to All Passes
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Sheet open={showSettings} onOpenChange={setShowSettings}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleOpenSettings} data-testid="button-settings">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Wallet Settings</SheetTitle>
                <SheetDescription>Configure your Apple Wallet and Google Wallet credentials</SheetDescription>
              </SheetHeader>
              
              <div className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    <h3 className="font-semibold">Apple Wallet</h3>
                  </div>
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="appleTeamId">Team ID</Label>
                    <Input 
                      id="appleTeamId" 
                      value={appleTeamId} 
                      onChange={(e) => setAppleTeamId(e.target.value)}
                      placeholder="e.g., ABC123DEF4"
                      data-testid="input-apple-team-id"
                    />
                    {settings?.appleTeamId && !appleTeamId && (
                      <p className="text-xs text-muted-foreground">Current: {settings.appleTeamId}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="applePassTypeId">Pass Type Identifier</Label>
                    <Input 
                      id="applePassTypeId" 
                      value={applePassTypeId}
                      onChange={(e) => setApplePassTypeId(e.target.value)}
                      placeholder="e.g., pass.com.example.membership"
                      data-testid="input-apple-pass-type-id"
                    />
                    {settings?.applePassTypeIdentifier && !applePassTypeId && (
                      <p className="text-xs text-muted-foreground">Current: {settings.applePassTypeIdentifier}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appleP12">P12 Certificate File</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        ref={appleP12InputRef}
                        id="appleP12"
                        type="file"
                        accept=".p12,.pfx"
                        onChange={(e) => setAppleP12File(e.target.files?.[0] || null)}
                        className="hidden"
                        data-testid="input-apple-p12"
                      />
                      <Button 
                        variant="outline" 
                        type="button" 
                        className="w-full justify-start gap-2"
                        onClick={() => appleP12InputRef.current?.click()}
                        data-testid="button-upload-p12"
                      >
                        <Upload className="h-4 w-4" />
                        {appleP12File ? appleP12File.name : "Choose P12 file..."}
                      </Button>
                      {settings?.appleP12Configured && !appleP12File && (
                        <FileCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appleP12Password">P12 Password</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        id="appleP12Password"
                        type="password"
                        value={appleP12Password}
                        onChange={(e) => setAppleP12Password(e.target.value)}
                        placeholder="Certificate password"
                        data-testid="input-apple-p12-password"
                      />
                      {settings?.appleP12PasswordConfigured && !appleP12Password && (
                        <FileCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appleIcon">Notification Icon (87x87px PNG)</Label>
                    <p className="text-xs text-muted-foreground">This icon appears on lock screen notifications</p>
                    <div className="flex items-center gap-2">
                      <Input 
                        ref={appleIconInputRef}
                        id="appleIcon"
                        type="file"
                        accept=".png"
                        onChange={(e) => setAppleIconFile(e.target.files?.[0] || null)}
                        className="hidden"
                        data-testid="input-apple-icon"
                      />
                      <Button 
                        variant="outline" 
                        type="button" 
                        className="w-full justify-start gap-2"
                        onClick={() => appleIconInputRef.current?.click()}
                        data-testid="button-upload-icon"
                      >
                        <Upload className="h-4 w-4" />
                        {appleIconFile ? appleIconFile.name : "Choose icon PNG..."}
                      </Button>
                      {settings?.appleIconConfigured && !appleIconFile && (
                        <FileCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Chrome className="h-5 w-5" />
                    <h3 className="font-semibold">Google Wallet</h3>
                  </div>
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="googleServiceAccount">Service Account JSON</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        ref={googleServiceInputRef}
                        id="googleServiceAccount"
                        type="file"
                        accept=".json"
                        onChange={(e) => setGoogleServiceAccountFile(e.target.files?.[0] || null)}
                        className="hidden"
                        data-testid="input-google-service-account"
                      />
                      <Button 
                        variant="outline" 
                        type="button" 
                        className="w-full justify-start gap-2"
                        onClick={() => googleServiceInputRef.current?.click()}
                        data-testid="button-upload-google-service"
                      >
                        <Upload className="h-4 w-4" />
                        {googleServiceAccountFile ? googleServiceAccountFile.name : "Choose JSON file..."}
                      </Button>
                      {settings?.googleServiceAccountConfigured && !googleServiceAccountFile && (
                        <FileCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="googleIssuerId">Issuer ID</Label>
                    <Input 
                      id="googleIssuerId" 
                      value={googleIssuerId}
                      onChange={(e) => setGoogleIssuerId(e.target.value)}
                      placeholder="e.g., 1234567890123456789"
                      data-testid="input-google-issuer-id"
                    />
                    {settings?.googleIssuerId && !googleIssuerId && (
                      <p className="text-xs text-muted-foreground">Current: {settings.googleIssuerId}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <h3 className="font-semibold">Security</h3>
                  </div>
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="encryptionKey">Encryption Key</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="encryptionKey" 
                        value={encryptionKey}
                        onChange={(e) => setEncryptionKey(e.target.value)}
                        placeholder="32-character encryption key"
                        data-testid="input-encryption-key"
                      />
                      <Button 
                        variant="outline" 
                        type="button" 
                        onClick={generateRandomKey}
                        data-testid="button-generate-key"
                      >
                        Generate
                      </Button>
                    </div>
                    {settings?.encryptionKeyConfigured && !encryptionKey && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCheck className="h-3 w-3 text-green-500" /> Encryption key is configured
                      </p>
                    )}
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={handleSaveSettings}
                  data-testid="button-save-settings"
                >
                  Save Settings
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <Card 
            key={index} 
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1"
            data-testid={`card-quick-stat-${index}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-11 h-11 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1" data-testid={`text-stat-count-${index}`}>{stat.count}</h3>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{stat.title}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Wallet Performance Overview
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Downloads, installs and conversion metrics</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg" data-testid="card-total-downloads">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="relative">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Downloads</div>
                  <div className="text-3xl font-bold mt-1">{totalDownloads.toLocaleString()}</div>
                  <div className="text-xs mt-2 opacity-75">Apple + Google combined</div>
                </div>
              </div>
              
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 p-4 text-white shadow-lg" data-testid="card-conversion-rate">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="relative">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Conversion Rate</div>
                  <div className="text-3xl font-bold mt-1">{conversionRate}%</div>
                  <div className="text-xs mt-2 opacity-75">Opens to installs</div>
                </div>
              </div>
              
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg" data-testid="card-active-passes">
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                <div className="relative">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-90">Active Passes</div>
                  <div className="text-3xl font-bold mt-1">{totalInstalls.toLocaleString()}</div>
                  <div className="text-xs mt-2 opacity-75">Installed on devices</div>
                </div>
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} iconType="circle" />
                  <Line 
                    type="monotone" 
                    dataKey="opens" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name="Page Opens"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="downloads" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', r: 4 }}
                    name="Downloads"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="installs" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    name="Installs"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                No event data available yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">Manage wallet pass members</p>
            </div>
            <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1" data-testid="button-add-member">
                  <Plus className="h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Wallet Pass</DialogTitle>
                </DialogHeader>
                
                {!selectedContact && !createNewMember ? (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Search Existing Customer</Label>
                      <Input
                        placeholder="Search by name, email, or phone..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        data-testid="input-contact-search"
                      />
                      {contactSearch.length >= 2 && filteredContacts.length > 0 && (
                        <div className="border rounded-md max-h-60 overflow-y-auto">
                          {filteredContacts.map((contact: any) => (
                            <div
                              key={contact.id}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                              onClick={() => handleSelectContact(contact)}
                              data-testid={`contact-option-${contact.id}`}
                            >
                              <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                              <p className="text-sm text-muted-foreground">{contact.email} {contact.phone && `| ${contact.phone}`}</p>
                              {contact.carrierName && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {contact.carrierName} {contact.planName && `- ${contact.planName}`} {contact.monthlyPremium && `| $${contact.monthlyPremium}/mo`}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {contactSearch.length >= 2 && filteredContacts.length === 0 && (
                        <p className="text-sm text-muted-foreground py-2">No customers found</p>
                      )}
                    </div>
                    <Separator />
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setCreateNewMember(true)}
                      data-testid="button-create-new-member"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Member (Without Customer)
                    </Button>
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddMember)} className="space-y-4">
                      {selectedContact && (
                        <div className="p-3 bg-muted rounded-md flex items-center justify-between">
                          <div>
                            <p className="font-medium">Linked Customer: {selectedContact.firstName} {selectedContact.lastName}</p>
                            <p className="text-sm text-muted-foreground">{selectedContact.email}</p>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedContact(null);
                              form.reset();
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="fullName"
                        rules={{ required: "Name is required" }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-member-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} data-testid="input-member-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-member-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />
                      <p className="text-sm font-medium text-muted-foreground">Insurance Information (for Apple Wallet)</p>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="memberId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Member ID</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., UZ120675001" data-testid="input-member-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="monthlyPremium"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monthly Payment</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., 17.25" data-testid="input-monthly-premium" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="carrierName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Insurance Carrier</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., UnitedHealthcare" data-testid="input-carrier-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="planName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Plan Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Silver HMO $0 Deductible" data-testid="input-plan-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="metalLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Metal Level</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Silver, Gold, Bronze" data-testid="input-metal-level" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="planType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Plan Type</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., HMO, PPO, EPO" data-testid="input-plan-type" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="effectiveDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Effective Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-effective-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="expirationDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Expiration Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-expiration-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        {createNewMember && !selectedContact && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setCreateNewMember(false)}
                          >
                            Back
                          </Button>
                        )}
                        <Button type="submit" className="flex-1" data-testid="button-submit-member">
                          Create Wallet Pass
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <LoadingSpinner fullScreen={false} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Smart Link</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No members yet. Add your first member to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    members?.slice(0, 10).map((member: any) => (
                      <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                        <TableCell className="font-medium">{member.fullName}</TableCell>
                        <TableCell className="font-mono text-sm">{member.memberId}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{member.plan || "standard"}</Badge>
                        </TableCell>
                        <TableCell>
                          {member.link?.url ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(member.link.url);
                                  toast({ title: "Link copied!" });
                                }}
                                data-testid={`button-copy-link-${member.id}`}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                              <a 
                                href={member.link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not generated</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteMember(member.id)}
                            data-testid={`button-delete-member-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Recent Events
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">Latest wallet activity</p>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <LoadingSpinner fullScreen={false} />
            ) : (
              <div className="space-y-3">
                {events?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No events yet. Share wallet links to see activity.
                  </p>
                ) : (
                  events?.slice(0, 10).map((event) => (
                    <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0 border-gray-100 dark:border-gray-700" data-testid={`row-event-${event.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                          {getEventTypeIcon(event.type)}
                        </div>
                        <div>
                          <Badge className={getEventTypeBadge(event.type)} variant="secondary">
                            {formatEventType(event.type)}
                          </Badge>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {event.os && `${event.os} • `}{event.deviceType || "Unknown device"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(event.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!config?.appleConfigured && !config?.googleConfigured && (
        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg rounded-2xl border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-5 w-5" />
              Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-amber-700 dark:text-amber-300">
            <p>To generate wallet passes, you need to configure at least one wallet provider:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Apple Wallet:</strong> Set APPLE_TEAM_ID, APPLE_PASS_TYPE_ID, and APPLE_P12_B64 environment variables</li>
              <li><strong>Google Wallet:</strong> Set GOOGLE_SERVICE_ACCOUNT_JSON_B64 and GOOGLE_ISSUER_ID environment variables</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
