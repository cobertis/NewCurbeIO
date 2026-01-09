import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { PortingWizard } from "@/components/PortingWizard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ChevronRight, 
  Plus, 
  Phone, 
  Eye, 
  Calendar, 
  Building2, 
  User, 
  MapPin,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Trash2,
  Loader2,
  Pencil
} from "lucide-react";

interface PortingOrder {
  id: string;
  companyId: string;
  createdBy: string;
  telnyxPortingOrderId: string | null;
  phoneNumbers: string[];
  status: string | { value: string; details?: any[] };
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

function OrderDetailsSheet({ 
  order, 
  open, 
  onOpenChange 
}: { 
  order: PortingOrder | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { data: orderDetails, isLoading } = useQuery<{ order: PortingOrder; telnyxOrder: any }>({
    queryKey: ["/api/telnyx/porting/orders", order?.id],
    enabled: !!order?.id && open,
  });

  if (!order) return null;

  const details = orderDetails?.order || order;
  const telnyxOrder = orderDetails?.telnyxOrder;

  const handleEditOrder = () => {
    onOpenChange(false);
    window.location.href = `/porting/transfer?orderId=${details.id}&edit=true`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-order-details">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Port-In Order Details
          </SheetTitle>
          <SheetDescription>
            Order ID: {details.id.slice(0, 8)}...
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="py-8">
            <LoadingSpinner fullScreen={false} message="Loading order details..." />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Status</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusBadge(details.status)}
                  {details.lastError && (
                    <span className="text-sm text-red-600" data-testid="text-last-error">{details.lastError}</span>
                  )}
                </div>
                {details.status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditOrder}
                    data-testid="button-edit-order-sheet"
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Numbers ({details.phoneNumbers?.length || 0})
              </h4>
              <div className="space-y-1">
                {details.phoneNumbers?.map((phone, idx) => (
                  <div 
                    key={idx} 
                    className="text-sm text-slate-600 dark:text-slate-400 font-mono"
                    data-testid={`text-phone-${idx}`}
                  >
                    {formatPhoneNumber(phone)}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Important Dates
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">FOC Requested</span>
                  <p className="font-medium" data-testid="text-foc-requested">
                    {details.focDatetimeRequested 
                      ? format(new Date(details.focDatetimeRequested), "MMM d, yyyy")
                      : "Not set"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">FOC Actual</span>
                  <p className="font-medium" data-testid="text-foc-actual">
                    {details.focDatetimeActual 
                      ? format(new Date(details.focDatetimeActual), "MMM d, yyyy")
                      : "Pending"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Created</span>
                  <p className="font-medium" data-testid="text-created">
                    {format(new Date(details.createdAt), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Last Updated</span>
                  <p className="font-medium" data-testid="text-updated">
                    {format(new Date(details.updatedAt), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                {details.submittedAt && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Submitted</span>
                    <p className="font-medium" data-testid="text-submitted">
                      {format(new Date(details.submittedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                )}
                {details.portedAt && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Ported</span>
                    <p className="font-medium text-green-600" data-testid="text-ported">
                      {format(new Date(details.portedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                )}
                {details.cancelledAt && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Cancelled</span>
                    <p className="font-medium text-red-600" data-testid="text-cancelled">
                      {format(new Date(details.cancelledAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(details.endUserEntityName || details.endUserAuthPersonName) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    End User Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    {details.endUserEntityName && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span data-testid="text-entity-name">{details.endUserEntityName}</span>
                      </div>
                    )}
                    {details.endUserAuthPersonName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span data-testid="text-auth-person">{details.endUserAuthPersonName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {(details.streetAddress || details.locality) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Service Address
                  </h4>
                  <div className="text-sm text-slate-600 dark:text-slate-400" data-testid="text-address">
                    {details.streetAddress && <div>{details.streetAddress}</div>}
                    {(details.locality || details.administrativeArea || details.postalCode) && (
                      <div>
                        {details.locality}{details.locality && details.administrativeArea ? ", " : ""}
                        {details.administrativeArea} {details.postalCode}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {(details.loaDocumentId || details.invoiceDocumentId) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documents
                  </h4>
                  <div className="space-y-2 text-sm">
                    {details.loaDocumentId && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        LOA Document Uploaded
                      </div>
                    )}
                    {details.invoiceDocumentId && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Invoice Document Uploaded
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {details.requirementsStatus && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Requirements Status</h4>
                  <Badge 
                    className={details.requirementsStatus === "met" 
                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    }
                    data-testid="badge-requirements-status"
                  >
                    {details.requirementsStatus === "met" ? "All Requirements Met" : details.requirementsStatus}
                  </Badge>
                </div>
              </>
            )}

            {telnyxOrder && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">Telnyx Order ID</h4>
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded" data-testid="text-telnyx-order-id">
                    {details.telnyxPortingOrderId}
                  </code>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SmsVoicePortIn() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PortingOrder | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PortingOrder | null>(null);
  const { toast } = useToast();

  const { data: ordersData, isLoading, refetch } = useQuery<{ orders: PortingOrder[] }>({
    queryKey: ["/api/telnyx/porting/orders"],
  });

  const orders = ordersData?.orders || [];

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
    setDetailsOpen(true);
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
          <Button onClick={() => setWizardOpen(true)} data-testid="button-new-port-request">
            <Plus className="h-4 w-4 mr-2" />
            New Port Request
          </Button>
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
                    <TableHead className="w-[250px]">Phone Numbers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>FOC Date</TableHead>
                    <TableHead>Created</TableHead>
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
                      <TableCell>
                        <div className="space-y-1">
                          {order.phoneNumbers?.slice(0, 2).map((phone, idx) => (
                            <div 
                              key={idx} 
                              className="text-sm font-mono"
                              data-testid={`text-phone-${order.id}-${idx}`}
                            >
                              {formatPhoneNumber(phone)}
                            </div>
                          ))}
                          {(order.phoneNumbers?.length || 0) > 2 && (
                            <div className="text-xs text-slate-500">
                              +{order.phoneNumbers.length - 2} more
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`cell-status-${order.id}`}>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell data-testid={`cell-foc-${order.id}`}>
                        {order.focDatetimeRequested || order.focDatetimeActual ? (
                          <div className="text-sm">
                            {order.focDatetimeActual 
                              ? format(new Date(order.focDatetimeActual), "MMM d, yyyy")
                              : order.focDatetimeRequested 
                                ? format(new Date(order.focDatetimeRequested), "MMM d, yyyy")
                                : "-"
                            }
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`cell-created-${order.id}`}>
                        <div className="text-sm">
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-slate-500">
                          {format(new Date(order.createdAt), "h:mm a")}
                        </div>
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

      <OrderDetailsSheet
        order={selectedOrder}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
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
