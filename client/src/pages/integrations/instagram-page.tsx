import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SiInstagram } from "react-icons/si";
import { Plus, ChevronLeft, ChevronRight, MoreVertical, Trash2, RefreshCw, ArrowUpDown, CheckCircle2, User } from "lucide-react";
import type { ChannelConnection } from "@shared/schema";
import instagramPreviewImg from "@assets/image_1766560780707.png";
import { format, isToday } from "date-fns";

interface InstagramAccount {
  id: string | number;
  accountName: string;
  username: string;
  profilePictureUrl: string | null;
  status: "active" | "pending" | "error" | "revoked";
  dateConnected: Date;
}

export default function InstagramPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | number | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/instagram/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active" || connection?.status === "pending";

  const accounts: InstagramAccount[] = connection ? [{
    id: connection.id || 1,
    accountName: connection.pageName || connection.displayName || "Instagram Account",
    username: connection.igUsername || "username",
    profilePictureUrl: (connection as any).igProfilePictureUrl || null,
    status: connection.status as "active" | "pending" | "error" | "revoked",
    dateConnected: connection.createdAt || new Date(),
  }] : [];

  const sortedAccounts = [...accounts].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField as keyof InstagramAccount] || "";
    const bValue = b[sortField as keyof InstagramAccount] || "";
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
      return apiRequest("POST", "/api/integrations/instagram/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/instagram/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "Instagram Disconnected",
        description: "Your Instagram account has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Instagram account.",
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100" data-testid="badge-status-connected">Connected</Badge>;
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

  if (isLoading) {
    return (
      <SettingsLayout activeSection="instagram">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  if (!isConnected) {
    return (
      <SettingsLayout activeSection="instagram">
        <div className="space-y-8" data-testid="page-instagram-landing">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 md:py-8 md:px-[10%]">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Manage Instagram business account messages
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Centralize messages from your Instagram audience. Track, organize, and respond with ease.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">View all chats in a unified inbox</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">See full message history</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Collaborate on chats with your team</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      className="bg-[#E1306C] hover:bg-[#C13584] text-white"
                      onClick={() => setLocation("/settings/instagram/flow")}
                      data-testid="button-get-started-instagram"
                    >
                      Get started
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open("https://help.instagram.com/", "_blank")}
                      data-testid="button-learn-more"
                    >
                      Learn more
                    </Button>
                  </div>
                </div>
                
                <div className="w-full md:w-96 shrink-0">
                  <img 
                    src={instagramPreviewImg} 
                    alt="Instagram DM chat interface preview"
                    className="w-full h-auto rounded-lg"
                    data-testid="img-instagram-preview"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Instagram FAQ</h3>
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
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-what-is">
                  What is the Instagram channel?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  The Instagram channel allows you to receive and respond to direct messages from your Instagram Business or Creator account directly within Curbe. This includes DMs from customers who contact your business.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-help-business">
                  How can Instagram integration help my business?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Instagram integration centralizes your customer communications, allowing your team to respond faster, track conversation history, and collaborate on customer inquiries. This improves response times and customer satisfaction.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-multiple-accounts">
                  Can I connect multiple Instagram accounts?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, you can connect multiple Instagram Business or Creator accounts to Curbe. Each account will appear as a separate channel, allowing you to manage messages from all your accounts in one unified inbox.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-easy-setup">
                  Is Instagram easy to set up with the unified inbox?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, setting up Instagram is straightforward. You just need to log in with Facebook (which manages Instagram Business accounts), select your Instagram account, and grant the necessary permissions. The process takes just a few minutes.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-team">
                  Can my team collaborate on Instagram DMs?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, your entire team can view and respond to Instagram DMs through Curbe. You can assign conversations to specific team members and track who handled each inquiry.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="instagram">
      <div className="space-y-6" data-testid="page-instagram">
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/settings/instagram/flow")}
            data-testid="button-connect-instagram"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect Instagram account
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead>Instagram account</TableHead>
                <TableHead>Username</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Date connected</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No Instagram accounts found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAccounts.map((account) => (
                  <TableRow key={account.id} data-testid={`row-instagram-account-${account.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {account.profilePictureUrl ? (
                            <AvatarImage src={account.profilePictureUrl} alt={account.accountName} />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                            {account.accountName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{account.accountName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SiInstagram className="h-4 w-4 text-[#E1306C]" />
                        <span>{account.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell className="text-slate-500">
                      {isToday(new Date(account.dateConnected)) 
                        ? `Today, ${format(new Date(account.dateConnected), "h:mm a").toLowerCase()}`
                        : format(new Date(account.dateConnected), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-menu-${account.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/instagram/status"] })}
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
              {accounts.length > 0 
                ? `${(currentPage - 1) * parseInt(rowsPerPage) + 1}-${Math.min(currentPage * parseInt(rowsPerPage), accounts.length)} of ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`
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
        <AlertDialogContent data-testid="dialog-disconnect-instagram">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Instagram Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this Instagram account? You will no longer be able to receive or send messages through this account.
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
