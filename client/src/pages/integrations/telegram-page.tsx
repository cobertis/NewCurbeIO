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
import { SiTelegram } from "react-icons/si";
import { Plus, ChevronLeft, ChevronRight, MoreVertical, Trash2, RefreshCw, ArrowUpDown, CheckCircle2 } from "lucide-react";
import type { ChannelConnection } from "@shared/schema";
import telegramPreviewImg from "@assets/Telegram_CRM_Interface_1766561393470.png";
import { format } from "date-fns";

interface TelegramBot {
  id: string | number;
  botName: string;
  username: string;
  status: "active" | "pending" | "error" | "revoked";
  dateConnected: Date;
}

export default function TelegramPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | number | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: connectionData, isLoading } = useQuery<{ connection: ChannelConnection | null }>({
    queryKey: ["/api/integrations/telegram/status"],
  });

  const connection = connectionData?.connection;
  const isConnected = connection?.status === "active" || connection?.status === "pending";

  const metadata = connection?.metadata as { botUsername?: string } | null;
  const bots: TelegramBot[] = connection ? [{
    id: connection.id || 1,
    botName: connection.displayName || "Telegram Bot",
    username: metadata?.botUsername || connection.displayName || "bot_username",
    status: connection.status as "active" | "pending" | "error" | "revoked",
    dateConnected: connection.createdAt || new Date(),
  }] : [];

  const sortedBots = [...bots].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField as keyof TelegramBot] || "";
    const bValue = b[sortField as keyof TelegramBot] || "";
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedBots.length / parseInt(rowsPerPage));
  const paginatedBots = sortedBots.slice(
    (currentPage - 1) * parseInt(rowsPerPage),
    currentPage * parseInt(rowsPerPage)
  );

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/telegram/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/status"] });
      setDisconnectDialogOpen(false);
      toast({
        title: "Telegram Bot Disconnected",
        description: "Your Telegram bot has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect Telegram bot.",
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
      <SettingsLayout activeSection="telegram">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  if (!isConnected) {
    return (
      <SettingsLayout activeSection="telegram">
        <div className="space-y-8" data-testid="page-telegram-landing">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 md:py-8 md:px-[10%]">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Connect your Telegram bot to manage messages
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Centralize messages from your Telegram bot. Track, organize, and respond with ease.
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
                      className="bg-[#0088CC] hover:bg-[#006699] text-white"
                      onClick={() => setLocation("/settings/telegram/flow")}
                      data-testid="button-get-started-telegram"
                    >
                      Get started
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open("https://core.telegram.org/bots", "_blank")}
                      data-testid="button-learn-more"
                    >
                      Learn more
                    </Button>
                  </div>
                </div>
                
                <div className="w-full md:w-96 shrink-0">
                  <img 
                    src={telegramPreviewImg} 
                    alt="Telegram chat interface preview"
                    className="w-full h-auto rounded-lg"
                    data-testid="img-telegram-preview"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Telegram FAQ</h3>
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
                  What is the Telegram channel?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  The Telegram channel allows you to receive and respond to messages from your Telegram bot directly within Curbe. This includes all messages customers send to your bot.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-help-business">
                  How can Telegram integration help my business?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Telegram integration centralizes your customer communications, allowing your team to respond faster, track conversation history, and collaborate on customer inquiries. Telegram bots provide 24/7 availability for your customers.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-create-bot">
                  How do I create a Telegram bot?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  To create a Telegram bot, message @BotFather on Telegram and use the /newbot command. Follow the prompts to name your bot and get a unique bot token. You'll use this token to connect your bot to Curbe.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-multiple-bots">
                  Can I connect multiple Telegram bots?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, you can connect multiple Telegram bots to Curbe. Each bot will appear as a separate channel, allowing you to manage messages from all your bots in one unified inbox.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-team">
                  Can my team collaborate on Telegram messages?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, your entire team can view and respond to Telegram messages through Curbe. You can assign conversations to specific team members and track who handled each inquiry.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="telegram">
      <div className="space-y-6" data-testid="page-telegram">
        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/settings/telegram/flow")}
            data-testid="button-connect-telegram"
          >
            <Plus className="h-4 w-4 mr-2" />
            Connect Telegram bot
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead>Bot name</TableHead>
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
              {paginatedBots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No Telegram bots found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBots.map((bot) => (
                  <TableRow key={bot.id} data-testid={`row-telegram-bot-${bot.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bot.botName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SiTelegram className="h-4 w-4 text-[#0088CC]" />
                        <span>@{bot.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(bot.status)}</TableCell>
                    <TableCell className="text-slate-500">
                      {format(new Date(bot.dateConnected), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-menu-${bot.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/telegram/status"] })}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh status
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedBotId(bot.id);
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
              {bots.length > 0 
                ? `${(currentPage - 1) * parseInt(rowsPerPage) + 1}-${Math.min(currentPage * parseInt(rowsPerPage), bots.length)} of ${bots.length} bot${bots.length !== 1 ? 's' : ''}`
                : "0 bots"
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
        <AlertDialogContent data-testid="dialog-disconnect-telegram">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Telegram Bot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this Telegram bot? You will no longer be able to receive or send messages through this bot.
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
