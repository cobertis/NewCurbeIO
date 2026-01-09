import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Download,
  Send,
  Loader2,
  User,
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
  currentCarrierPin?: string | null;
  currentCarrierAccountNumber?: string | null;
  oldServiceProviderOcn?: string | null;
  parentSupportKey?: string | null;
  portingFrom?: string | null;
}

interface Comment {
  id: string;
  body: string;
  user_id?: string;
  user_type?: string;
  created_at: string;
}

interface Event {
  id: string;
  event_type: string;
  description?: string;
  payload?: any;
  occurred_at: string;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1${cleaned.slice(1, 4)}${cleaned.slice(4, 7)}${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  return phone;
}

function getStatusValue(status: string | { value: string; details?: any[] }): string {
  return typeof status === 'object' ? status.value : status;
}

function getStatusBadge(status: string | { value: string; details?: any[] }) {
  const statusValue = getStatusValue(status);
  
  switch (statusValue) {
    case "completed":
    case "ported":
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "submitted":
    case "in_process":
    case "in-process":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <Clock className="h-3 w-3 mr-1" />
          In Process
        </Badge>
      );
    case "exception":
    case "port-in-exception":
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Exception
        </Badge>
      );
    case "cancelled":
    case "cancel-pending":
      return (
        <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    case "draft":
    default:
      return (
        <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">
          Draft
        </Badge>
      );
  }
}

interface PortingOrderDetailsProps {
  order: PortingOrder;
  onBack: () => void;
}

export function PortingOrderDetails({ order, onBack }: PortingOrderDetailsProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();

  const { data: orderDetails, isLoading: loadingDetails } = useQuery<{ order: PortingOrder; telnyxOrder: any }>({
    queryKey: ["/api/telnyx/porting/orders", order.id],
  });

  const { data: commentsData, isLoading: loadingComments } = useQuery<{ comments: Comment[] }>({
    queryKey: ["/api/telnyx/porting/orders", order.id, "comments"],
    enabled: activeTab === "communications",
  });

  const { data: eventsData, isLoading: loadingEvents } = useQuery<{ events: Event[] }>({
    queryKey: ["/api/telnyx/porting/orders", order.id, "events"],
    enabled: activeTab === "timeline",
  });

  const { data: documentsData, isLoading: loadingDocs } = useQuery<{ documents: any[] }>({
    queryKey: ["/api/telnyx/porting/orders", order.id, "documents"],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      return apiRequest("POST", `/api/telnyx/porting/orders/${order.id}/comments`, { body });
    },
    onSuccess: () => {
      toast({ title: "Comment added", description: "Your comment has been submitted." });
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/porting/orders", order.id, "comments"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add comment", description: error.message, variant: "destructive" });
    },
  });

  const details = orderDetails?.order || order;
  const telnyxOrder = orderDetails?.telnyxOrder;
  const comments = commentsData?.comments || [];
  const events = eventsData?.events || [];
  const documents = documentsData?.documents || [];

  const invoiceDoc = documents.find((doc: any) => 
    doc.document_type === 'invoice' || doc.type === 'invoice'
  );
  const loaDoc = documents.find((doc: any) => 
    doc.document_type === 'loa' || doc.type === 'loa'
  );
  const otherDocs = documents.filter((doc: any) => 
    doc.document_type !== 'invoice' && doc.type !== 'invoice' &&
    doc.document_type !== 'loa' && doc.type !== 'loa'
  );

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  return (
    <div className="space-y-6" data-testid="porting-order-details">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <button
          onClick={onBack}
          className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to porting requests
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Porting request details
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto p-0 bg-transparent gap-6 border-b w-full justify-start rounded-none">
          <TabsTrigger 
            value="details" 
            className="px-0 pb-3 pt-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            data-testid="tab-details"
          >
            Order Details
          </TabsTrigger>
          <TabsTrigger 
            value="requirements"
            className="px-0 pb-3 pt-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            data-testid="tab-requirements"
          >
            Requirements
          </TabsTrigger>
          <TabsTrigger 
            value="phone-numbers"
            className="px-0 pb-3 pt-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            data-testid="tab-phone-numbers"
          >
            Phone Numbers
          </TabsTrigger>
          <TabsTrigger 
            value="communications"
            className="px-0 pb-3 pt-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            data-testid="tab-communications"
          >
            Communications
          </TabsTrigger>
          <TabsTrigger 
            value="timeline"
            className="px-0 pb-3 pt-4 rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-slate-100 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            data-testid="tab-timeline"
          >
            Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          {loadingDetails ? (
            <LoadingSpinner fullScreen={false} message="Loading order details..." />
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Order Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Request #</div>
                      <div className="font-mono text-sm">{details.supportKey || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Status</div>
                      <div className="mt-1">{getStatusBadge(details.status)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Porting Order ID</div>
                      <div className="font-mono text-xs">{details.telnyxPortingOrderId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Request Submitted At</div>
                      <div className="text-sm">
                        {details.submittedAt 
                          ? format(new Date(details.submittedAt), "MMM d, yyyy, HH:mm") + " (local)"
                          : '-'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activation Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {telnyxOrder?.misc?.type && (
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Port Type</div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={telnyxOrder.misc.type === 'full'} readOnly className="h-4 w-4" />
                          <span className="text-sm">Full Port</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" checked={telnyxOrder.misc.type === 'partial'} readOnly className="h-4 w-4" />
                          <span className="text-sm">Partial Port</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Requested FOC Date</div>
                      <div className="text-sm">
                        {details.focDatetimeRequested 
                          ? format(new Date(details.focDatetimeRequested), "MMM d, yyyy, HH:mm") + " (local)"
                          : 'Not set'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Actual FOC Date</div>
                      <div className="text-sm">
                        {details.focDatetimeActual 
                          ? format(new Date(details.focDatetimeActual), "MMM d, yyyy, HH:mm") + " (local)"
                          : 'Pending confirmation'}
                      </div>
                    </div>
                    {telnyxOrder?.activation_settings?.activation_status && (
                      <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">Activation Type</div>
                        <div className="text-sm">{telnyxOrder.activation_settings.activation_status}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">End user account details</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This information must match what is on file with the existing carrier.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">End user name (business name)</div>
                      <div className="text-sm font-medium">{details.endUserEntityName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Authorized person name (billing contact)</div>
                      <div className="text-sm font-medium">{details.endUserAuthPersonName || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">PIN/passcode</div>
                      <div className="text-sm font-medium">{details.currentCarrierPin || telnyxOrder?.end_user?.admin?.pin_passcode || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Customer reference</div>
                      <div className="text-sm font-medium">{details.currentCarrierAccountNumber || telnyxOrder?.end_user?.admin?.account_number || '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service Address</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    The physical location of the phone number on record with the current carrier.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Address</div>
                      <div className="text-sm font-medium">{details.streetAddress || telnyxOrder?.end_user?.location?.street_address || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Extended Address</div>
                      <div className="text-sm font-medium">{telnyxOrder?.end_user?.location?.extended_address || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">City</div>
                      <div className="text-sm font-medium">{details.locality || telnyxOrder?.end_user?.location?.locality || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">State/Province/Region</div>
                      <div className="text-sm font-medium">{details.administrativeArea || telnyxOrder?.end_user?.location?.administrative_area || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">ZIP/Postal Code</div>
                      <div className="text-sm font-medium">{details.postalCode || telnyxOrder?.end_user?.location?.postal_code || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">Country</div>
                      <div className="text-sm font-medium">{telnyxOrder?.end_user?.location?.country_code || 'United States of America'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requirements" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingDocs ? (
                <LoadingSpinner fullScreen={false} message="Loading documents..." />
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Latest Invoice</div>
                      {invoiceDoc ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-normal">
                            {invoiceDoc.filename || invoiceDoc.name || 'Invoice uploaded'}
                          </Badge>
                          {invoiceDoc.download_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(invoiceDoc.download_url, '_blank')}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download Document
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">No invoice uploaded</span>
                      )}
                    </div>

                    <div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Letter of Authorization</div>
                      {loaDoc ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-normal">
                            {loaDoc.filename || loaDoc.name || 'LOA uploaded'}
                          </Badge>
                          {loaDoc.download_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(loaDoc.download_url, '_blank')}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download Document
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">No LOA uploaded</span>
                      )}
                    </div>
                  </div>

                  {otherDocs.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-4">Additional Documents</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Filename</TableHead>
                              <TableHead>Created At</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {otherDocs.map((doc: any) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-mono text-sm">{doc.filename || doc.name || doc.id}</TableCell>
                                <TableCell>{doc.created_at ? format(new Date(doc.created_at), "MMM d, yyyy") : '-'}</TableCell>
                                <TableCell>{doc.document_type || doc.type || '-'}</TableCell>
                                <TableCell>
                                  {doc.download_url && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => window.open(doc.download_url, '_blank')}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phone-numbers" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Phone Numbers ({details.phoneNumbers?.length || 0} total)</CardTitle>
              <Button variant="outline" size="sm" data-testid="button-export-numbers">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Bundle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.phoneNumbers?.map((phone, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{formatPhoneNumber(phone)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">Assign Bundle</Button>
                      </TableCell>
                    </TableRow>
                  )) || (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-slate-500">No phone numbers</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leave a comment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Add comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-comment"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || addCommentMutation.isPending}
                  data-testid="button-save-comment"
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
                <Button variant="outline" onClick={() => setNewComment("")} data-testid="button-cancel-comment">
                  Cancel
                </Button>
              </div>

              <Separator className="my-6" />

              <div>
                <h4 className="text-sm font-medium mb-4">Comment history</h4>
                {loadingComments ? (
                  <LoadingSpinner fullScreen={false} message="Loading comments..." />
                ) : comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {comment.user_type === 'telnyx' ? 'Telnyx Admin' : 'You'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {format(new Date(comment.created_at), "MMM d, yyyy, h:mm a")}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {loadingEvents ? (
                <LoadingSpinner fullScreen={false} message="Loading timeline..." />
              ) : events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="capitalize">
                          {event.event_type?.replace(/_/g, ' ').replace(/-/g, ' ') || 'Event'}
                        </TableCell>
                        <TableCell>
                          {event.description || `${event.event_type?.replace(/_/g, ' ')}` || '-'}
                        </TableCell>
                        <TableCell>
                          {event.occurred_at 
                            ? format(new Date(event.occurred_at), "MMM d, yyyy, h:mm:ss a")
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Rebroadcast</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">No events recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
