import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { SiWhatsapp } from "react-icons/si";
import { Plus, Search, ChevronLeft, ChevronRight, MoreVertical, Trash2, RefreshCw, ArrowUpDown, CheckCircle2, PlayCircle, AlertCircle, Zap, UserCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { ChannelConnection } from "@shared/schema";
import whatsappPreviewImg from "@assets/image_1766559979785.png";

interface WhatsAppAccount {
  id: string | number;
  businessName: string;
  phoneNumber: string;
  wabaId: string;
  status: "active" | "pending" | "error" | "revoked";
  countryCode?: string;
}

interface PhoneStatus {
  phoneNumberId: string;
  wabaId: string;
  displayPhoneNumber: string;
  status: string;
  qualityRating: string;
  nameStatus: string;
  verifiedName: string;
  codeVerificationStatus: string;
  accountMode: string;
  needsRegistration: boolean;
  isFullyActivated: boolean;
}

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | number | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  
  // Connection status query - must be declared before profile query
  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/whatsapp/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active" || connection?.status === "pending";

  // Business Profile state
  const [profileForm, setProfileForm] = useState({
    about: "",
    address: "",
    description: "",
    email: "",
    vertical: "UNDEFINED",
    websites: ["", ""] as string[]
  });

  // Query to fetch business profile
  const { data: profileData, isLoading: isLoadingProfile, refetch: refetchProfile } = useQuery<{
    about: string;
    address: string;
    description: string;
    email: string;
    profilePictureUrl: string;
    websites: string[];
    vertical: string;
  }>({
    queryKey: ["/api/integrations/whatsapp/profile"],
    enabled: isConnected,
  });

  // Effect to populate form when profile data loads
  useEffect(() => {
    if (profileData) {
      setProfileForm({
        about: profileData.about || "",
        address: profileData.address || "",
        description: profileData.description || "",
        email: profileData.email || "",
        vertical: profileData.vertical || "UNDEFINED",
        websites: [
          profileData.websites?.[0] || "",
          profileData.websites?.[1] || ""
        ]
      });
    }
  }, [profileData]);

  // Mutation to update profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      return apiRequest("POST", "/api/integrations/whatsapp/profile", {
        about: data.about,
        address: data.address,
        description: data.description,
        email: data.email,
        vertical: data.vertical,
        websites: data.websites.filter(w => w && w.trim())
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/profile"] });
      toast({
        title: "Profile Updated",
        description: "Your WhatsApp Business profile has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update business profile.",
      });
    }
  });

  // Mutation to upload profile photo
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("photo", file);
      const response = await fetch("/api/integrations/whatsapp/profile/photo", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload photo");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/profile"] });
      toast({
        title: "Photo Updated",
        description: "Your profile photo has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Failed to upload profile photo.",
      });
    }
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: "Profile photo must be less than 5MB.",
        });
        return;
      }
      uploadPhotoMutation.mutate(file);
    }
  };

  const accounts: WhatsAppAccount[] = connection ? [{
    id: connection.id || 1,
    businessName: connection.displayName || "Business Account",
    phoneNumber: connection.phoneNumberE164 || "",
    wabaId: connection.wabaId || "",
    status: connection.status as "active" | "pending" | "error" | "revoked",
    countryCode: "US",
  }] : [];

  const filteredAccounts = accounts.filter(account => 
    account.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.phoneNumber.includes(searchQuery) ||
    account.wabaId.includes(searchQuery)
  );

  const sortedAccounts = [...filteredAccounts].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField as keyof WhatsAppAccount] || "";
    const bValue = b[sortField as keyof WhatsAppAccount] || "";
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedAccounts.length / parseInt(rowsPerPage));
  const paginatedAccounts = sortedAccounts.slice(
    (currentPage - 1) * parseInt(rowsPerPage),
    currentPage * parseInt(rowsPerPage)
  );

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/whatsapp/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "WhatsApp Disconnected",
        description: "Your WhatsApp Business account has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect WhatsApp Business account.",
      });
    },
  });

  // Query to check phone number status from Meta API
  const { data: phoneStatusData, isLoading: isCheckingStatus, refetch: refetchPhoneStatus } = useQuery<PhoneStatus>({
    queryKey: ["/api/integrations/whatsapp/phone-status"],
    enabled: isConnected,
    refetchOnWindowFocus: false,
  });

  // Retry activation mutation
  const retryActivationMutation = useMutation({
    mutationFn: async (pinCode?: string) => {
      return apiRequest("POST", "/api/integrations/whatsapp/retry-activation", { pin: pinCode });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/phone-status"] });
      
      if (response.isFullyActivated) {
        setActivationDialogOpen(false);
        setPin(["", "", "", "", "", ""]);
        toast({
          title: "Phone number activated",
          description: "Your WhatsApp number is now fully activated and ready to use.",
        });
      } else if (response.action === "pin_required") {
        setActivationDialogOpen(true);
        toast({
          title: "PIN required",
          description: "Please enter your 6-digit PIN to complete activation.",
        });
      } else if (response.action === "registered") {
        setActivationDialogOpen(false);
        setPin(["", "", "", "", "", ""]);
        toast({
          title: "Registration submitted",
          description: "Your phone number is being activated. Status: " + response.currentStatus,
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Activation failed",
        description: error.message || "Failed to activate phone number. Please try again.",
      });
    },
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const formatPhoneNumber = (phone: string, countryCode?: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100" data-testid="badge-status-approved">Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100" data-testid="badge-status-pending">Pending</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100" data-testid="badge-status-error">Error</Badge>;
      case "revoked":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100" data-testid="badge-status-revoked">Revoked</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-unknown">Unknown</Badge>;
    }
  };

  const getCountryFlag = (countryCode?: string) => {
    if (countryCode === "US") {
      return "🇺🇸";
    }
    return "🌐";
  };

  if (isLoading) {
    return (
      <SettingsLayout activeSection="whatsapp">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  if (!isConnected) {
    return (
      <SettingsLayout activeSection="whatsapp">
        <div className="space-y-8" data-testid="page-whatsapp-landing">
          <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-whatsapp">
            <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">WhatsApp</span>
          </div>
          
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 md:py-8 md:px-[10%]">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Connect with customers on WhatsApp
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Handle customer-initiated conversations on WhatsApp channel. Respond faster, improve customer service, and keep all your chats in one place.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Link your WhatsApp in minutes</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Send and receive messages instantly</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Share images, videos, and files easily</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
                      onClick={() => setLocation("/settings/whatsapp/flow")}
                      data-testid="button-get-started-whatsapp"
                    >
                      Get started
                    </Button>
                    <Button 
                      variant="outline"
                      className="gap-2"
                      onClick={() => window.open("https://www.facebook.com/business/help/447934475640650", "_blank")}
                      data-testid="button-watch-tutorial"
                    >
                      <PlayCircle className="h-4 w-4" />
                      Watch tutorial
                    </Button>
                  </div>
                </div>
                
                <div className="w-full md:w-96 shrink-0">
                  <img 
                    src={whatsappPreviewImg} 
                    alt="WhatsApp Business chat interface preview"
                    className="w-full h-auto rounded-lg"
                    data-testid="img-whatsapp-preview"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">WhatsApp FAQ</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Haven't found what you were looking for?{" "}
                <a 
                  href="https://support.curbe.io/contact" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  data-testid="link-contact-us"
                >
                  Contact us
                </a>
              </p>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-features">
                  What WhatsApp Business Platform features are supported by Curbe?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Curbe supports receiving and sending WhatsApp messages, including text, images, videos, documents, and voice messages. You can manage all conversations from your Curbe inbox and respond to customers in real-time.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-24-hour">
                  Why am I limited to 24-hour messaging sessions?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  WhatsApp's business messaging policy requires that businesses respond to customer-initiated conversations within a 24-hour window. After this period, you can only send pre-approved template messages. This helps protect users from spam and ensures timely responses.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-connect">
                  How do I connect my WhatsApp Business?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Click "Get started" and you'll be redirected to Meta's authentication page. Log in with your Facebook account that has access to your WhatsApp Business account, select your WhatsApp Business profile, and approve the required permissions. Your connection will be active immediately after.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-data-transfer">
                  Will my WhatsApp data get transferred to the Curbe app?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  No, existing conversation history is not transferred. Curbe will only receive new messages sent after the connection is established. Your previous WhatsApp conversations remain in your WhatsApp app.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-virtual-number">
                  Can I use the Curbe virtual number with WhatsApp Business?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  No, WhatsApp Business requires its own verified phone number. You need to have a WhatsApp Business account with a verified phone number to connect with Curbe. Curbe virtual numbers are for SMS and voice calls only.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="whatsapp">
      <div className="space-y-6" data-testid="page-whatsapp">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-whatsapp">
          <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">Settings</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">WhatsApp</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/settings/whatsapp/flow")}
            data-testid="button-new-whatsapp"
          >
            <Plus className="h-4 w-4 mr-2" />
            New WhatsApp number
          </Button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search accounts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-accounts"
            />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("businessName")}
                >
                  <div className="flex items-center gap-1">
                    WhatsApp Business account
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Numbers linked</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("wabaId")}
                >
                  <div className="flex items-center gap-1">
                    WhatsApp Account ID
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No WhatsApp accounts found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((account) => (
                  <TableRow key={account.id} data-testid={`row-whatsapp-account-${account.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SiWhatsapp className="h-4 w-4 text-[#25D366]" />
                        <span className="font-medium">{account.businessName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getCountryFlag(account.countryCode)}</span>
                        <span>{formatPhoneNumber(account.phoneNumber, account.countryCode)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{account.wabaId}</TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setProfileSheetOpen(true)}
                          title="Edit Profile"
                          data-testid={`button-profile-${account.id}`}
                        >
                          <UserCircle className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-menu-${account.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
                                refetchPhoneStatus();
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Refresh status
                            </DropdownMenuItem>
                            {account.status === "pending" && (
                              <DropdownMenuItem
                                onClick={() => retryActivationMutation.mutate(undefined)}
                                disabled={retryActivationMutation.isPending}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                {retryActivationMutation.isPending ? "Checking..." : "Activate number"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedAccountId(account.id);
                                setDisconnectDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Disconnect
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-500">
              {filteredAccounts.length > 0 
                ? `${(currentPage - 1) * parseInt(rowsPerPage) + 1}-${Math.min(currentPage * parseInt(rowsPerPage), filteredAccounts.length)} of ${filteredAccounts.length} account${filteredAccounts.length !== 1 ? 's' : ''}`
                : "0 accounts"
              }
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Show on page</span>
            <Select value={rowsPerPage} onValueChange={(value) => { setRowsPerPage(value); setCurrentPage(1); }}>
              <SelectTrigger className="w-20" data-testid="select-rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>


      {/* Business Profile Section */}
      <Card className="border-slate-200 dark:border-slate-800 mt-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Business Profile</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Manage your WhatsApp Business profile information that customers see</p>
            </div>
            <Button
              onClick={() => refetchProfile()}
              variant="ghost"
              size="sm"
              disabled={isLoadingProfile}
              data-testid="button-refresh-profile"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingProfile ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Photo */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profileData?.profilePictureUrl ? (
                    <img
                      src={profileData.profilePictureUrl}
                      alt="Business profile"
                      className="w-20 h-20 rounded-full object-cover"
                      data-testid="img-profile-photo"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <SiWhatsapp className="h-10 w-10 text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="profile-photo-upload"
                    data-testid="input-profile-photo"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('profile-photo-upload')?.click()}
                    disabled={uploadPhotoMutation.isPending}
                    data-testid="button-upload-photo"
                  >
                    {uploadPhotoMutation.isPending ? "Uploading..." : "Change Photo"}
                  </Button>
                  <p className="text-xs text-slate-500 mt-1">JPEG or PNG, max 5MB</p>
                </div>
              </div>

              {/* About */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  About <span className="text-slate-400">({profileForm.about.length}/139)</span>
                </label>
                <Input
                  value={profileForm.about}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, about: e.target.value.slice(0, 139) }))}
                  placeholder="Brief status text for your business"
                  maxLength={139}
                  data-testid="input-profile-about"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description <span className="text-slate-400">({profileForm.description.length}/512)</span>
                </label>
                <textarea
                  value={profileForm.description}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value.slice(0, 512) }))}
                  placeholder="Describe your business to customers"
                  maxLength={512}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-800"
                  data-testid="input-profile-description"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Address <span className="text-slate-400">({profileForm.address.length}/256)</span>
                </label>
                <Input
                  value={profileForm.address}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value.slice(0, 256) }))}
                  placeholder="Your business address"
                  maxLength={256}
                  data-testid="input-profile-address"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email <span className="text-slate-400">({profileForm.email.length}/128)</span>
                </label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value.slice(0, 128) }))}
                  placeholder="contact@business.com"
                  maxLength={128}
                  data-testid="input-profile-email"
                />
              </div>

              {/* Websites */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Websites (max 2)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={profileForm.websites[0] || ""}
                      onChange={(e) => {
                        const newWebsites = [...profileForm.websites];
                        newWebsites[0] = e.target.value.slice(0, 256);
                        setProfileForm(prev => ({ ...prev, websites: newWebsites }));
                      }}
                      placeholder="https://www.example.com"
                      maxLength={256}
                      data-testid="input-profile-website-1"
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">({(profileForm.websites[0] || "").length}/256)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={profileForm.websites[1] || ""}
                      onChange={(e) => {
                        const newWebsites = [...profileForm.websites];
                        newWebsites[1] = e.target.value.slice(0, 256);
                        setProfileForm(prev => ({ ...prev, websites: newWebsites }));
                      }}
                      placeholder="https://shop.example.com"
                      maxLength={256}
                      data-testid="input-profile-website-2"
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">({(profileForm.websites[1] || "").length}/256)</span>
                  </div>
                </div>
              </div>

              {/* Category/Vertical */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Industry Category</label>
                <Select value={profileForm.vertical} onValueChange={(value) => setProfileForm(prev => ({ ...prev, vertical: value }))}>
                  <SelectTrigger data-testid="select-profile-vertical">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNDEFINED">Not Specified</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                    <SelectItem value="AUTO">Automotive</SelectItem>
                    <SelectItem value="BEAUTY">Beauty & Personal Care</SelectItem>
                    <SelectItem value="APPAREL">Apparel & Clothing</SelectItem>
                    <SelectItem value="EDU">Education</SelectItem>
                    <SelectItem value="ENTERTAIN">Entertainment</SelectItem>
                    <SelectItem value="EVENT_PLAN">Event Planning</SelectItem>
                    <SelectItem value="FINANCE">Finance</SelectItem>
                    <SelectItem value="GROCERY">Grocery</SelectItem>
                    <SelectItem value="GOVT">Government</SelectItem>
                    <SelectItem value="HOTEL">Hotel & Lodging</SelectItem>
                    <SelectItem value="HEALTH">Health</SelectItem>
                    <SelectItem value="NONPROFIT">Nonprofit</SelectItem>
                    <SelectItem value="PROF_SERVICES">Professional Services</SelectItem>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="TRAVEL">Travel</SelectItem>
                    <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                    <SelectItem value="NOT_A_BIZ">Not a Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  onClick={() => updateProfileMutation.mutate(profileForm)}
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent data-testid="dialog-disconnect-whatsapp">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this WhatsApp Business account? You will no longer be able to receive or send messages through this number.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-disconnect">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-confirm-disconnect"
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={activationDialogOpen} onOpenChange={(open) => {
        setActivationDialogOpen(open);
        if (!open) setPin(["", "", "", "", "", ""]);
      }}>
        <DialogContent data-testid="dialog-activate-whatsapp">
          <DialogHeader>
            <DialogTitle>Activate WhatsApp Number</DialogTitle>
            <DialogDescription>
              Enter your 6-digit two-factor authentication PIN to complete the phone number activation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {phoneStatusData && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone Number</span>
                  <span className="font-medium">{phoneStatusData.displayPhoneNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-medium ${phoneStatusData.status === "CONNECTED" ? "text-green-600" : "text-yellow-600"}`}>
                    {phoneStatusData.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verification</span>
                  <span className={`font-medium ${phoneStatusData.codeVerificationStatus === "VERIFIED" ? "text-green-600" : "text-yellow-600"}`}>
                    {phoneStatusData.codeVerificationStatus || "Pending"}
                  </span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="activate-pin-0" className="text-sm font-medium">Enter 6-digit PIN</label>
              <p className="text-xs text-slate-500 sr-only">Enter each digit of your 6-digit PIN in the fields below</p>
              <div className="flex items-center justify-center gap-2" role="group" aria-label="6-digit PIN entry">
                {pin.slice(0, 3).map((digit, index) => (
                  <Input
                    key={index}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    autoComplete="one-time-code"
                    aria-label={`PIN digit ${index + 1} of 6`}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const newPin = [...pin];
                      newPin[index] = val;
                      setPin(newPin);
                      if (val && index < 5) {
                        const nextInput = document.getElementById(`activate-pin-${index + 1}`);
                        nextInput?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digit && index > 0) {
                        const prevInput = document.getElementById(`activate-pin-${index - 1}`);
                        prevInput?.focus();
                      }
                    }}
                    id={`activate-pin-${index}`}
                    className="w-12 h-12 text-center text-lg font-medium"
                    data-testid={`input-activate-pin-${index}`}
                  />
                ))}
                <span className="text-slate-400 text-lg" aria-hidden="true">-</span>
                {pin.slice(3).map((digit, index) => (
                  <Input
                    key={index + 3}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    autoComplete="one-time-code"
                    aria-label={`PIN digit ${index + 4} of 6`}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const newPin = [...pin];
                      newPin[index + 3] = val;
                      setPin(newPin);
                      if (val && index + 3 < 5) {
                        const nextInput = document.getElementById(`activate-pin-${index + 4}`);
                        nextInput?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !digit && index + 3 > 0) {
                        const prevInput = document.getElementById(`activate-pin-${index + 2}`);
                        prevInput?.focus();
                      }
                    }}
                    id={`activate-pin-${index + 3}`}
                    className="w-12 h-12 text-center text-lg font-medium"
                    data-testid={`input-activate-pin-${index + 3}`}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActivationDialogOpen(false);
                setPin(["", "", "", "", "", ""]);
              }}
              data-testid="button-cancel-activation"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const pinCode = pin.join("");
                if (pinCode.length === 6) {
                  retryActivationMutation.mutate(pinCode);
                } else {
                  toast({
                    variant: "destructive",
                    title: "Invalid PIN",
                    description: "Please enter a 6-digit PIN.",
                  });
                }
              }}
              disabled={retryActivationMutation.isPending}
              data-testid="button-confirm-activation"
            >
              {retryActivationMutation.isPending ? "Activating..." : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-edit-profile">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Edit Business Profile
            </SheetTitle>
            <SheetDescription>
              Update your WhatsApp Business profile information that customers see
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6 mt-6">
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner fullScreen={false} />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {profileData?.profilePictureUrl ? (
                      <img
                        src={profileData.profilePictureUrl}
                        alt="Business profile"
                        className="w-16 h-16 rounded-full object-cover"
                        data-testid="img-sheet-profile-photo"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <SiWhatsapp className="h-8 w-8 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('profile-photo-upload')?.click()}
                      disabled={uploadPhotoMutation.isPending}
                      data-testid="button-sheet-upload-photo"
                    >
                      {uploadPhotoMutation.isPending ? "Uploading..." : "Change Photo"}
                    </Button>
                    <p className="text-xs text-slate-500 mt-1">JPEG or PNG, max 5MB</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    About <span className="text-slate-400">({profileForm.about.length}/139)</span>
                  </label>
                  <Input
                    value={profileForm.about}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, about: e.target.value.slice(0, 139) }))}
                    placeholder="Brief status text for your business"
                    maxLength={139}
                    data-testid="input-sheet-profile-about"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Description <span className="text-slate-400">({profileForm.description.length}/512)</span>
                  </label>
                  <textarea
                    value={profileForm.description}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, description: e.target.value.slice(0, 512) }))}
                    placeholder="Describe your business to customers"
                    maxLength={512}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-sm bg-white dark:bg-slate-800"
                    data-testid="input-sheet-profile-description"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Address <span className="text-slate-400">({profileForm.address.length}/256)</span>
                  </label>
                  <Input
                    value={profileForm.address}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, address: e.target.value.slice(0, 256) }))}
                    placeholder="Your business address"
                    maxLength={256}
                    data-testid="input-sheet-profile-address"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email <span className="text-slate-400">({profileForm.email.length}/128)</span>
                  </label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value.slice(0, 128) }))}
                    placeholder="contact@business.com"
                    maxLength={128}
                    data-testid="input-sheet-profile-email"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Websites (max 2)
                  </label>
                  <div className="space-y-2">
                    <Input
                      value={profileForm.websites[0] || ""}
                      onChange={(e) => {
                        const newWebsites = [...profileForm.websites];
                        newWebsites[0] = e.target.value.slice(0, 256);
                        setProfileForm(prev => ({ ...prev, websites: newWebsites }));
                      }}
                      placeholder="https://www.example.com"
                      maxLength={256}
                      data-testid="input-sheet-profile-website-1"
                    />
                    <Input
                      value={profileForm.websites[1] || ""}
                      onChange={(e) => {
                        const newWebsites = [...profileForm.websites];
                        newWebsites[1] = e.target.value.slice(0, 256);
                        setProfileForm(prev => ({ ...prev, websites: newWebsites }));
                      }}
                      placeholder="https://shop.example.com"
                      maxLength={256}
                      data-testid="input-sheet-profile-website-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Industry Category</label>
                  <Select value={profileForm.vertical} onValueChange={(value) => setProfileForm(prev => ({ ...prev, vertical: value }))}>
                    <SelectTrigger data-testid="select-sheet-profile-vertical">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNDEFINED">Not Specified</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="AUTO">Automotive</SelectItem>
                      <SelectItem value="BEAUTY">Beauty & Personal Care</SelectItem>
                      <SelectItem value="APPAREL">Apparel & Clothing</SelectItem>
                      <SelectItem value="EDU">Education</SelectItem>
                      <SelectItem value="ENTERTAIN">Entertainment</SelectItem>
                      <SelectItem value="EVENT_PLAN">Event Planning</SelectItem>
                      <SelectItem value="FINANCE">Finance</SelectItem>
                      <SelectItem value="GROCERY">Grocery</SelectItem>
                      <SelectItem value="GOVT">Government</SelectItem>
                      <SelectItem value="HOTEL">Hotel & Lodging</SelectItem>
                      <SelectItem value="HEALTH">Health</SelectItem>
                      <SelectItem value="NONPROFIT">Nonprofit</SelectItem>
                      <SelectItem value="PROF_SERVICES">Professional Services</SelectItem>
                      <SelectItem value="RETAIL">Retail</SelectItem>
                      <SelectItem value="TRAVEL">Travel</SelectItem>
                      <SelectItem value="RESTAURANT">Restaurant</SelectItem>
                      <SelectItem value="NOT_A_BIZ">Not a Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    onClick={() => setProfileSheetOpen(false)}
                    data-testid="button-sheet-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateProfileMutation.mutate(profileForm);
                      setProfileSheetOpen(false);
                    }}
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-sheet-save-profile"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </SettingsLayout>
  );
}
