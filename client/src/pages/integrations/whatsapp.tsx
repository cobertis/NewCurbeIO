import { useState } from "react";
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
import { Plus, Search, ChevronLeft, ChevronRight, MoreVertical, Trash2, RefreshCw, ArrowUpDown, CheckCircle2, PlayCircle } from "lucide-react";
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

export default function WhatsAppPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | number | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/whatsapp/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active" || connection?.status === "pending";

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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">WhatsApp</h1>
          
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 md:p-8">
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">WhatsApp</h1>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-menu-${account.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] })}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh status
                          </DropdownMenuItem>
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
    </SettingsLayout>
  );
}
