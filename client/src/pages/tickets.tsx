import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  MessageSquare,
  Building2,
  User,
  Calendar,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FinancialSupportTicket {
  id: string;
  companyId: string;
  userId: string;
  situation: string;
  proposedSolution: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'closed';
  adminResponse: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  responder?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

export default function TicketsPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [selectedTicket, setSelectedTicket] = useState<FinancialSupportTicket | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [adminResponse, setAdminResponse] = useState("");
  const [ticketStatus, setTicketStatus] = useState<string>("");

  // Fetch all tickets
  const { data: ticketsData, isLoading } = useQuery<{ tickets: FinancialSupportTicket[] }>({
    queryKey: ['/api/tickets'],
  });

  const tickets = ticketsData?.tickets || [];

  // Open ticket from URL parameter
  useEffect(() => {
    if (tickets.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const ticketId = params.get('ticketId');
      
      if (ticketId) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
          setSelectedTicket(ticket);
          setTicketStatus(ticket.status);
          setAdminResponse(ticket.adminResponse || "");
          setShowTicketDialog(true);
          
          // Clean up URL
          window.history.replaceState({}, '', '/tickets');
        }
      }
    }
  }, [tickets]);

  // Filter tickets by status
  const filteredTickets = filterStatus === "all" 
    ? tickets 
    : tickets.filter(t => t.status === filterStatus);

  // Update ticket mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status, adminResponse }: { id: string; status?: string; adminResponse?: string }) => {
      return apiRequest("PATCH", `/api/tickets/${id}`, { status, adminResponse });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: "Success",
        description: "Ticket updated successfully",
      });
      setShowTicketDialog(false);
      setAdminResponse("");
      setTicketStatus("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  // Delete ticket mutation
  const deleteTicketMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tickets/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: "Success",
        description: "Ticket deleted successfully",
      });
      setShowDeleteDialog(false);
      setShowTicketDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete ticket",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
    },
  });

  const handleViewTicket = (ticket: FinancialSupportTicket) => {
    setSelectedTicket(ticket);
    setTicketStatus(ticket.status);
    setAdminResponse(ticket.adminResponse || "");
    setShowTicketDialog(true);
  };

  const handleUpdateTicket = () => {
    if (!selectedTicket) return;

    const updateData: any = {};
    
    if (ticketStatus && ticketStatus !== selectedTicket.status) {
      updateData.status = ticketStatus;
    }
    
    if (adminResponse && adminResponse !== selectedTicket.adminResponse) {
      updateData.adminResponse = adminResponse;
    }

    if (Object.keys(updateData).length > 0) {
      updateTicketMutation.mutate({
        id: selectedTicket.id,
        ...updateData,
      });
    } else {
      setShowTicketDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
      pending: { label: "Pending", variant: "secondary", icon: Clock },
      under_review: { label: "Under Review", variant: "default", icon: Eye },
      approved: { label: "Approved", variant: "default", icon: CheckCircle },
      rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
      closed: { label: "Closed", variant: "outline", icon: AlertCircle },
    };

    const config = statusConfig[status] || { label: status, variant: "outline", icon: AlertCircle };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getUserName = (user: { firstName: string | null; lastName: string | null; email: string }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Ticket className="h-8 w-8" />
            Financial Support Tickets
          </h1>
          <p className="text-muted-foreground">Manage all financial support requests from companies</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="sr-only">Filter by status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter" id="status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-filter-all">All Tickets</SelectItem>
              <SelectItem value="pending" data-testid="option-filter-pending">Pending</SelectItem>
              <SelectItem value="under_review" data-testid="option-filter-under-review">Under Review</SelectItem>
              <SelectItem value="approved" data-testid="option-filter-approved">Approved</SelectItem>
              <SelectItem value="rejected" data-testid="option-filter-rejected">Rejected</SelectItem>
              <SelectItem value="closed" data-testid="option-filter-closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-tickets">{tickets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-tickets">
              {tickets.filter(t => t.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-under-review-tickets">
              {tickets.filter(t => t.status === 'under_review').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-approved-tickets">
              {tickets.filter(t => t.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-rejected-tickets">
              {tickets.filter(t => t.status === 'rejected').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>
            {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
            {filterStatus !== "all" && ` with status: ${filterStatus.replace('_', ' ')}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredTickets.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Responded By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id} data-testid={`ticket-row-${ticket.id}`}>
                      <TableCell className="font-medium" data-testid={`text-company-${ticket.id}`}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {ticket.company.name}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-user-${ticket.id}`}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{getUserName(ticket.user)}</div>
                            <div className="text-xs text-muted-foreground">{ticket.user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`status-ticket-${ticket.id}`}>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell data-testid={`text-created-${ticket.id}`}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(ticket.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-responder-${ticket.id}`}>
                        {ticket.responder ? (
                          <div className="text-sm">
                            {getUserName(ticket.responder)}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTicket(ticket)}
                          data-testid={`button-view-ticket-${ticket.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Tickets Found</h3>
              <p className="text-sm text-muted-foreground">
                {filterStatus === "all" 
                  ? "No financial support tickets have been submitted yet."
                  : `No tickets with status: ${filterStatus.replace('_', ' ')}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Ticket Details
            </DialogTitle>
            <DialogDescription>
              View and respond to this financial support request
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-6 py-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Company</Label>
                  <p className="text-sm font-medium mt-1" data-testid="text-dialog-company">{selectedTicket.company.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">User</Label>
                  <p className="text-sm font-medium mt-1" data-testid="text-dialog-user">{getUserName(selectedTicket.user)}</p>
                  <p className="text-xs text-muted-foreground">{selectedTicket.user.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm font-medium mt-1" data-testid="text-dialog-created">{formatDate(selectedTicket.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Current Status</Label>
                  <div className="mt-1" data-testid="status-dialog-ticket">{getStatusBadge(selectedTicket.status)}</div>
                </div>
              </div>

              <Separator />

              {/* User's Request */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Financial Situation</Label>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-dialog-situation">{selectedTicket.situation}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Proposed Solution</Label>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-dialog-solution">{selectedTicket.proposedSolution}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Admin Response Section */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ticket-status">Update Status</Label>
                  <Select value={ticketStatus} onValueChange={setTicketStatus}>
                    <SelectTrigger id="ticket-status" data-testid="select-ticket-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending" data-testid="option-status-pending">Pending</SelectItem>
                      <SelectItem value="under_review" data-testid="option-status-under-review">Under Review</SelectItem>
                      <SelectItem value="approved" data-testid="option-status-approved">Approved</SelectItem>
                      <SelectItem value="rejected" data-testid="option-status-rejected">Rejected</SelectItem>
                      <SelectItem value="closed" data-testid="option-status-closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="admin-response">Your Response</Label>
                  <Textarea
                    id="admin-response"
                    placeholder="Write your response to the user..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    rows={6}
                    className="resize-none"
                    data-testid="textarea-admin-response"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The user will be notified when you submit a response
                  </p>
                </div>

                {selectedTicket.responder && (
                  <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Previously responded by:</strong> {getUserName(selectedTicket.responder)}
                    </p>
                    {selectedTicket.respondedAt && (
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {formatDate(selectedTicket.respondedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between items-center">
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteTicketMutation.isPending}
              data-testid="button-delete-ticket"
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowTicketDialog(false)}
                data-testid="button-cancel-ticket"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateTicket}
                disabled={updateTicketMutation.isPending}
                data-testid="button-update-ticket"
              >
                {updateTicketMutation.isPending ? "Updating..." : "Update Ticket"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this financial support ticket. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTicket) {
                  deleteTicketMutation.mutate(selectedTicket.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTicketMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteTicketMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
