import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { MessageSquare, Plus, ChevronLeft, ChevronRight, MoreVertical, Trash2, RefreshCw, ArrowUpDown, CheckCircle2, Settings, Code } from "lucide-react";
import chatWidgetPreviewImg from "@assets/image_1766561911546.png";
import { format } from "date-fns";

interface ChatWidgetConfig {
  id: string | number;
  name: string;
  domain: string;
  status: "active" | "pending" | "inactive";
  dateCreated: Date;
}

export default function ChatWidgetPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [rowsPerPage, setRowsPerPage] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | number | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: widgetsData, isLoading } = useQuery<{ widgets: ChatWidgetConfig[] }>({
    queryKey: ["/api/integrations/chat-widget/list"],
  });

  const widgets = widgetsData?.widgets || [];
  const hasWidgets = widgets.length > 0;

  const sortedWidgets = [...widgets].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField as keyof ChatWidgetConfig] || "";
    const bValue = b[sortField as keyof ChatWidgetConfig] || "";
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sortedWidgets.length / parseInt(rowsPerPage));
  const paginatedWidgets = sortedWidgets.slice(
    (currentPage - 1) * parseInt(rowsPerPage),
    currentPage * parseInt(rowsPerPage)
  );

  const deleteMutation = useMutation({
    mutationFn: async (widgetId: string | number) => {
      return apiRequest("DELETE", `/api/integrations/chat-widget/${widgetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget/list"] });
      setDeleteDialogOpen(false);
      toast({
        title: "Widget Deleted",
        description: "The chat widget has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message || "Failed to delete chat widget.",
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
        return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100" data-testid="badge-status-active">Active</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100" data-testid="badge-status-pending">Pending</Badge>;
      case "inactive":
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100" data-testid="badge-status-inactive">Inactive</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-status-unknown">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <SettingsLayout activeSection="chat-widget">
        <LoadingSpinner />
      </SettingsLayout>
    );
  }

  if (!hasWidgets) {
    return (
      <SettingsLayout activeSection="chat-widget">
        <div className="space-y-8" data-testid="page-chat-widget-landing">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Chat widget</h1>
          
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 md:py-8 md:px-[10%]">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Connect with website visitors in real time
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Add a multi-channel widget to your website so customers can reach you the moment they need help—via Chat widget, SMS, email, phone, or social channels.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Chat with visitors in real time</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Offer multiple channels to connect</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Match the widget to your brand</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => setLocation("/settings/chat-widget/flow")}
                      data-testid="button-get-started-chat-widget"
                    >
                      Get started
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open("https://help.curbe.io/chat-widget", "_blank")}
                      data-testid="button-learn-more"
                    >
                      Learn more
                    </Button>
                  </div>
                </div>
                
                <div className="w-full md:w-96 shrink-0">
                  <img 
                    src={chatWidgetPreviewImg} 
                    alt="Chat widget interface preview"
                    className="w-full h-auto rounded-lg"
                    data-testid="img-chat-widget-preview"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Chat widget FAQ</h3>
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
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-why-use">
                  Why use the Curbe chat widget?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  The Curbe chat widget allows you to engage with website visitors in real-time, providing instant support and capturing leads. It integrates seamlessly with all your communication channels in one unified inbox.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-2" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-channels">
                  Can I choose which communication channels are available on my widget?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, you can customize which channels appear on your widget. Options include live chat, SMS, email, phone calls, WhatsApp, and other social channels. Configure them based on your team's availability.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-3" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-target">
                  How do I target specific audiences with my chat widget?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  You can configure the widget to appear based on visitor behavior, page URL, time on site, or other triggers. This allows you to target specific audiences with personalized messages.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-4" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-edit">
                  Can I edit the widget after it has been embedded?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, you can edit your widget settings at any time from the Curbe dashboard. Changes will be reflected immediately on your website without needing to update the embed code.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="item-5" className="border border-slate-200 dark:border-slate-800 rounded-lg mb-2 px-4">
                <AccordionTrigger className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:no-underline" data-testid="faq-test">
                  Can I test how the widget looks before going live?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 dark:text-slate-400">
                  Yes, the widget builder includes a live preview that shows exactly how your widget will appear. You can also test it on a staging environment before deploying to production.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="chat-widget">
      <div className="space-y-6" data-testid="page-chat-widget">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Chat widget</h1>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/settings/chat-widget/flow")}
            data-testid="button-create-widget"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create new widget
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                <TableHead>Widget name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Date created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWidgets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No chat widgets found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedWidgets.map((widget) => (
                  <TableRow key={widget.id} data-testid={`row-chat-widget-${widget.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{widget.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{widget.domain}</TableCell>
                    <TableCell>{getStatusBadge(widget.status)}</TableCell>
                    <TableCell className="text-slate-500">
                      {format(new Date(widget.dateCreated), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-menu-${widget.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setLocation(`/settings/chat-widget/${widget.id}/settings`)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLocation(`/settings/chat-widget/${widget.id}/embed`)}
                          >
                            <Code className="h-4 w-4 mr-2" />
                            Get embed code
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/integrations/chat-widget/list"] })}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedWidgetId(widget.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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
              {widgets.length > 0 
                ? `${(currentPage - 1) * parseInt(rowsPerPage) + 1}-${Math.min(currentPage * parseInt(rowsPerPage), widgets.length)} of ${widgets.length} widget${widgets.length !== 1 ? 's' : ''}`
                : "0 widgets"
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-widget">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Widget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat widget? This action cannot be undone and the widget will stop working on your website.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedWidgetId && deleteMutation.mutate(selectedWidgetId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
