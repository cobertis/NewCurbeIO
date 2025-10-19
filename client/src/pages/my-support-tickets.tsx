import { useQuery } from "@tanstack/react-query";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Ticket,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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

export default function MySupportTicketsPage() {
  const [selectedTicket, setSelectedTicket] = useState<FinancialSupportTicket | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);

  // Fetch user's own tickets
  const { data: ticketsData, isLoading } = useQuery<{ tickets: FinancialSupportTicket[] }>({
    queryKey: ['/api/my-support-tickets'],
  });

  const tickets = ticketsData?.tickets || [];

  const handleViewTicket = (ticket: FinancialSupportTicket) => {
    setSelectedTicket(ticket);
    setShowTicketDialog(true);
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
      <Badge variant={config.variant} className="gap-1" data-testid={`badge-status-${status}`}>
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
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-8 w-8" />
            My Support Requests
          </h1>
          <p className="text-muted-foreground">View your financial support requests and responses</p>
        </div>
      </div>

      {/* Support Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Support Requests</CardTitle>
          <CardDescription>
            {tickets.length} {tickets.length === 1 ? 'request' : 'requests'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : tickets.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id} data-testid={`ticket-row-${ticket.id}`}>
                      <TableCell data-testid={`status-ticket-${ticket.id}`}>{getStatusBadge(ticket.status)}</TableCell>
                      <TableCell data-testid={`text-created-${ticket.id}`}>{formatDate(ticket.createdAt)}</TableCell>
                      <TableCell data-testid={`text-updated-${ticket.id}`}>{formatDate(ticket.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTicket(ticket)}
                          data-testid={`button-view-ticket-${ticket.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
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
              <h3 className="text-lg font-semibold mb-2">No Support Requests</h3>
              <p className="text-sm text-muted-foreground">
                You haven't submitted any financial support requests yet.
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
              Support Request Details
            </DialogTitle>
            <DialogDescription>
              View your support request and our team's response
            </DialogDescription>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-6 py-4">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Submitted</Label>
                  <p className="text-sm font-medium mt-1" data-testid="text-dialog-created">{formatDate(selectedTicket.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1" data-testid="status-dialog-ticket">{getStatusBadge(selectedTicket.status)}</div>
                </div>
              </div>

              <Separator />

              {/* User's Request */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Your Financial Situation</Label>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-dialog-situation">{selectedTicket.situation}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Your Proposed Solution</Label>
                  <div className="mt-2 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-dialog-solution">{selectedTicket.proposedSolution}</p>
                  </div>
                </div>
              </div>

              {/* Admin Response Section */}
              {selectedTicket.adminResponse && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Team Response</Label>
                    <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm whitespace-pre-wrap" data-testid="text-dialog-response">{selectedTicket.adminResponse}</p>
                      {selectedTicket.respondedBy && selectedTicket.responder && (
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-muted-foreground">
                            Responded by {getUserName(selectedTicket.responder)} on {formatDate(selectedTicket.respondedAt!)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {!selectedTicket.adminResponse && selectedTicket.status === 'pending' && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-900 dark:text-yellow-100">
                      <strong>Pending Review:</strong> Our team is reviewing your request. We'll respond as soon as possible.
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowTicketDialog(false)}
                  data-testid="button-close-dialog"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
