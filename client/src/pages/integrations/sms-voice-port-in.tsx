import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { PortingWizard } from "@/components/PortingWizard";
import { PortingOrderDetails } from "@/components/PortingOrderDetails";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, 
  Phone, 
  Eye, 
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  Loader2,
  Pencil,
  RefreshCw,
  ChevronRight
} from "lucide-react";

interface PortingOrder {
  id: string;
  companyId: string;
  createdBy: string;
  telnyxPortingOrderId: string | null;
  phoneNumbers: string[];
  status: string | { value: string; details?: any[] };
  supportKey: string | null;
  focDatetimeRequested: string | null;
  focDatetimeActual: string | null;
  endUserEntityName: string | null;
  endUserAuthPersonName: string | null;
  streetAddress: string | null;
  locality: string | null;
  administrativeArea: string | null;
  postalCode: string | null;
  loaDocumentId: string | null;
  invoiceDocumentId: string | null;
  requirements: any | null;
  requirementsStatus: string | null;
  lastError: string | null;
  submittedAt: string | null;
  portedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.slice(1, 4);
    const exchange = cleaned.slice(4, 7);
    const subscriber = cleaned.slice(7, 11);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const exchange = cleaned.slice(3, 6);
    const subscriber = cleaned.slice(6, 10);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  return phone;
}

function getStatusBadge(status: string | { value: string; details?: any[] }) {
  const statusValue = typeof status === 'object' ? status.value : status;
  
  switch (statusValue) {
    case "completed":
    case "ported":
      return (
        <Badge data-testid="badge-status-completed" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "submitted":
    case "in_process":
    case "in-process":
      return (
        <Badge data-testid="badge-status-in-process" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" />
          In Process
        </Badge>
      );
    case "exception":
    case "port-in-exception":
      return (
        <Badge data-testid="badge-status-exception" className="bg-red-500/10 text-red-600 border-red-500/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Exception
        </Badge>
      );
    case "cancelled":
    case "cancel-pending":
      return (
        <Badge data-testid="badge-status-cancelled" className="bg-slate-500/10 text-slate-500 border-slate-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case "draft":
    default:
      return (
        <Badge data-testid="badge-status-draft" className="bg-slate-500/10 text-slate-500 border-slate-500/20">
          Draft
        </Badge>
      );
  }
}

export default function SmsVoicePortIn() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PortingOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<PortingOrder | null>(null);
  const { toast } = useToast();

  const { data: ordersData, isLoading, refetch } = useQuery<{ orders: PortingOrder[] }>({
    refetchInterval: 30000, // Auto-refresh every 30 seconds for real-time updates
    queryKey: ["/api/telnyx/porting/orders"],
  });

  const orders = ordersData?.orders || [];

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/telnyx/porting/sync");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sync complete",
        description: `Synced ${data.synced || 0} new orders, updated ${data.updated || 0} existing orders.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/porting/orders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync porting orders from Telnyx.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await apiRequest("DELETE", `/api/telnyx/porting/orders/${orderId}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Order deleted",
        description: "The draft porting order has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/porting/orders"] });
      setOrderToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete the porting order.",
        variant: "destructive",
      });
      setOrderToDelete(null);
    },
  });

  const handleViewOrder = (order: PortingOrder) => {
    setSelectedOrder(order);
  };

  const handleBackToList = () => {
    setSelectedOrder(null);
  };

  const handleDeleteOrder = (order: PortingOrder) => {
    setOrderToDelete(order);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      deleteMutation.mutate(orderToDelete.id);
    }
  };

  const handleWizardClose = () => {
    setWizardOpen(false);
    refetch();
  };

  if (isLoading) {
    return (
      <SettingsLayout activeSection="sms-voice">
        <LoadingSpinner fullScreen={false} message="Loading porting orders..." />
      </SettingsLayout>
    );
  }

  if (selectedOrder) {
    return (
      <SettingsLayout activeSection="sms-voice">
        <PortingOrderDetails order={selectedOrder} onBack={handleBackToList} />
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-port-in">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-port-in">
          <Link href="/settings/sms-voice" className="text-muted-foreground hover:text-foreground transition-colors">
            SMS & Voice
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Number Port-In</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Number Port-In</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Port your existing phone numbers from other carriers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-telnyx"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync with Telnyx
            </Button>
            <Button onClick={() => setWizardOpen(true)} data-testid="button-new-port-request">
              <Plus className="h-4 w-4 mr-2" />
              New Port Request
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="py-16 text-center" data-testid="empty-state">
                <Phone className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                  No porting orders yet
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                  Start a new port request to transfer your existing phone numbers from another carrier.
                </p>
                <Button onClick={() => setWizardOpen(true)} data-testid="button-start-port-request">
                  <Plus className="h-4 w-4 mr-2" />
                  Start Port Request
                </Button>
              </div>
            ) : (
              <Table data-testid="table-porting-orders">
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Request #</TableHead>
                    <TableHead>Porting Order ID</TableHead>
                    <TableHead>Total TNs</TableHead>
                    <TableHead>FOC Date</TableHead>
                    <TableHead>End User</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow 
                      key={order.id} 
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      data-testid={`row-order-${order.id}`}
                    >
                      <TableCell data-testid={`cell-status-${order.id}`}>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell data-testid={`cell-request-${order.id}`}>
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                          {order.supportKey || '-'}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`cell-porting-id-${order.id}`}>
                        {order.telnyxPortingOrderId ? (
                          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            <div>{order.telnyxPortingOrderId.slice(0, 18)}-</div>
                            <div>{order.telnyxPortingOrderId.slice(19)}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-tns-${order.id}`}>
                        <span className="text-sm">{order.phoneNumbers?.length || 0}</span>
                      </TableCell>
                      <TableCell data-testid={`cell-foc-${order.id}`}>
                        {order.focDatetimeActual ? (
                          <div className="text-sm">
                            {format(new Date(order.focDatetimeActual), "MMM d, yyyy")}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">Unconfirmed</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-enduser-${order.id}`}>
                        <span className="text-sm">{order.endUserEntityName || '-'}</span>
                      </TableCell>
                      <TableCell data-testid={`cell-submitted-${order.id}`}>
                        {order.submittedAt ? (
                          <div>
                            <div className="text-sm">
                              {format(new Date(order.submittedAt), "MMM d, yyyy")}
                            </div>
                            <div className="text-xs text-slate-500">
                              {format(new Date(order.submittedAt), "HH:mm")} (local)
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewOrder(order)}
                            data-testid={`button-view-order-${order.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          {order.status === "draft" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.location.href = `/porting/transfer?orderId=${order.id}&edit=true`}
                                data-testid={`button-edit-order-${order.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-order-${order.id}`}
                              >
                                {deleteMutation.isPending && orderToDelete?.id === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <PortingWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen}
        onOrderCreated={handleWizardClose}
      />

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this draft porting order? This action cannot be undone.
              {orderToDelete && orderToDelete.phoneNumbers.length > 0 && (
                <div className="mt-2 text-sm font-mono">
                  {orderToDelete.phoneNumbers.slice(0, 3).map((phone, idx) => (
                    <div key={idx}>{formatPhoneNumber(phone)}</div>
                  ))}
                  {orderToDelete.phoneNumbers.length > 3 && (
                    <div>+{orderToDelete.phoneNumbers.length - 3} more</div>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
