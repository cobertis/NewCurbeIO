import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BuyNumbersDialog } from "@/components/WebPhoneFloatingWindow";
import { E911ConfigDialog } from "@/components/E911ConfigDialog";
import { CallForwardingDialog } from "@/components/CallForwardingDialog";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SettingsLayout } from "@/components/settings-layout";
import { 
  Phone, 
  Plus,
  Search,
  MoreHorizontal,
  PhoneForwarded,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addMonths } from "date-fns";
import { formatPhoneNumber, type SmsVoiceNumber } from "@/pages/sms-voice";

// Check if a phone number is toll-free (800, 833, 844, 855, 866, 877, 888)
function isTollFreeNumber(phoneNumber: string): boolean {
  const digits = phoneNumber.replace(/\D/g, '');
  // US toll-free area codes
  const tollFreePrefixes = ['800', '833', '844', '855', '866', '877', '888'];
  // Check if starts with 1 + toll-free, or just toll-free
  const areaCode = digits.startsWith('1') ? digits.slice(1, 4) : digits.slice(0, 3);
  return tollFreePrefixes.includes(areaCode);
}

function USFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="18" fill="#B22234"/>
      <rect y="1.38" width="24" height="1.38" fill="white"/>
      <rect y="4.15" width="24" height="1.38" fill="white"/>
      <rect y="6.92" width="24" height="1.38" fill="white"/>
      <rect y="9.69" width="24" height="1.38" fill="white"/>
      <rect y="12.46" width="24" height="1.38" fill="white"/>
      <rect y="15.23" width="24" height="1.38" fill="white"/>
      <rect width="9.6" height="9.69" fill="#3C3B6E"/>
    </svg>
  );
}

export default function SmsVoiceNumbers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editLabelNumber, setEditLabelNumber] = useState<SmsVoiceNumber | null>(null);
  const [labelValue, setLabelValue] = useState("");
  const [editCallerIdNumber, setEditCallerIdNumber] = useState<SmsVoiceNumber | null>(null);
  const [callerIdValue, setCallerIdValue] = useState("");
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [releaseNumber, setReleaseNumber] = useState<SmsVoiceNumber | null>(null);
  const [e911ConfigNumber, setE911ConfigNumber] = useState<SmsVoiceNumber | null>(null);
  const [callForwardingNumber, setCallForwardingNumber] = useState<SmsVoiceNumber | null>(null);
  const { toast } = useToast();

  const { data: numbersData, isLoading, refetch } = useQuery<{ numbers: SmsVoiceNumber[] }>({
    queryKey: ["/api/sms-voice/numbers"],
  });

  const updateLabelMutation = useMutation({
    mutationFn: async ({ numberId, displayName }: { numberId: string; displayName: string }) => {
      return await apiRequest("PATCH", `/api/telnyx/my-numbers/${numberId}`, { displayName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-voice/numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      toast({ title: "Label updated", description: "The phone number label has been updated." });
      setEditLabelNumber(null);
      setLabelValue("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update label", variant: "destructive" });
    },
  });

  const handleEditLabel = (number: SmsVoiceNumber) => {
    setEditLabelNumber(number);
    setLabelValue(number.displayName || "");
  };

  const handleSaveLabel = () => {
    if (editLabelNumber) {
      updateLabelMutation.mutate({ numberId: editLabelNumber.id, displayName: labelValue.trim() });
    }
  };

  const updateCallerIdMutation = useMutation({
    mutationFn: async ({ phoneNumber, callerIdName }: { phoneNumber: string; callerIdName: string }) => {
      return await apiRequest("PATCH", `/api/telnyx/caller-id`, { phoneNumber, callerIdName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-voice/numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      toast({ title: "Caller ID updated", description: "The caller ID name has been submitted. It may take 3-5 business days to propagate." });
      setEditCallerIdNumber(null);
      setCallerIdValue("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update caller ID", variant: "destructive" });
    },
  });

  const handleEditCallerId = (number: SmsVoiceNumber) => {
    setEditCallerIdNumber(number);
    setCallerIdValue("");
  };

  const handleSaveCallerId = () => {
    if (editCallerIdNumber) {
      updateCallerIdMutation.mutate({ phoneNumber: editCallerIdNumber.phoneNumber, callerIdName: callerIdValue.trim() });
    }
  };

  const releaseNumberMutation = useMutation({
    mutationFn: async (numberId: string) => {
      return await apiRequest("DELETE", `/api/telnyx/my-numbers/${numberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-voice/numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telnyx/my-numbers"] });
      toast({ title: "Number released", description: "The phone number has been released. Monthly billing has stopped." });
      setReleaseNumber(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to release phone number", variant: "destructive" });
    },
  });

  const handleConfirmRelease = () => {
    if (releaseNumber) {
      releaseNumberMutation.mutate(releaseNumber.id);
    }
  };

  const numbers = numbersData?.numbers || [];

  const filteredNumbers = useMemo(() => {
    if (!searchQuery.trim()) return numbers;
    const query = searchQuery.toLowerCase();
    return numbers.filter(n => 
      n.phoneNumber.toLowerCase().includes(query) ||
      n.displayName?.toLowerCase().includes(query) ||
      formatPhoneNumber(n.phoneNumber).toLowerCase().includes(query)
    );
  }, [numbers, searchQuery]);

  const totalNumbers = filteredNumbers.length;
  const totalPages = Math.ceil(totalNumbers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalNumbers);
  const paginatedNumbers = filteredNumbers.slice(startIndex, endIndex);

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen={true} message="Loading numbers..." />;
  }

  return (
    <SettingsLayout activeSection="sms-voice">
      <div className="space-y-6" data-testid="page-sms-voice-numbers">
        <div className="flex items-center gap-2 text-sm" data-testid="breadcrumb-sms-numbers">
          <Link href="/settings/sms-voice" className="text-muted-foreground hover:text-foreground transition-colors">SMS & Voice</Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">My Numbers</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search numbers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
              data-testid="input-search-numbers"
            />
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowBuyDialog(true)} data-testid="button-buy-number">
            <Plus className="h-4 w-4" />
            Buy a new number
          </Button>
        </div>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {paginatedNumbers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Phone className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                  {searchQuery ? "No matching numbers" : "No numbers yet"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery 
                    ? "Try adjusting your search terms." 
                    : "Purchase your first number to start sending messages."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-xs font-medium text-slate-500">Number</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">CNAM</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">E911</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Label</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Price / month</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Next renewal</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500">Forward calls to</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedNumbers.map((number) => (
                    <TableRow 
                      key={number.id} 
                      className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      data-testid={`row-number-${number.id}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <USFlagIcon className="h-4 w-5 rounded-sm shadow-sm" />
                          <span data-testid={`text-phone-${number.id}`}>
                            {formatPhoneNumber(number.phoneNumber)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {isTollFreeNumber(number.phoneNumber) ? (
                          <div className="flex items-center gap-1">
                            <span 
                              className="text-slate-400 dark:text-slate-500 text-sm"
                              data-testid={`text-cnam-na-${number.id}`}
                            >
                              N/A
                            </span>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <span className="cursor-default">
                                  <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p>Toll-free numbers do not support CNAM (Caller ID Name). This is a carrier limitation.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ) : number.cnam ? (
                          <button 
                            onClick={() => handleEditCallerId(number)}
                            className="hover:text-slate-900 dark:hover:text-slate-100"
                            data-testid={`text-cnam-${number.id}`}
                          >
                            {number.cnam}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleEditCallerId(number)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm hover:underline"
                            data-testid={`button-add-cnam-${number.id}`}
                          >
                            Add
                          </button>
                        )}
                      </TableCell>
                      <TableCell>
                        {number.e911Enabled ? (
                          <Link 
                            href="/settings/compliance"
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
                            data-testid={`link-e911-enabled-${number.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Enabled</span>
                          </Link>
                        ) : (
                          <button 
                            onClick={() => setE911ConfigNumber(number)}
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
                            data-testid={`button-e911-config-${number.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm">Not Set</span>
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {number.displayName ? (
                          <button 
                            onClick={() => handleEditLabel(number)}
                            className="hover:text-slate-900 dark:hover:text-slate-100"
                            data-testid={`text-label-${number.id}`}
                          >
                            {number.displayName}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleEditLabel(number)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm hover:underline"
                            data-testid={`button-add-label-${number.id}`}
                          >
                            Add
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-price-${number.id}`}>
                        ${number.monthlyFee || "10.00"}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-renewal-${number.id}`}>
                        {number.purchasedAt 
                          ? format(addMonths(new Date(number.purchasedAt), 1), "d MMM yyyy")
                          : format(addMonths(new Date(), 1), "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {number.callForwardingEnabled ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                            onClick={() => setCallForwardingNumber(number)}
                            data-testid={`button-forwarding-active-${number.id}`}
                          >
                            <PhoneForwarded className="h-3 w-3 mr-1" />
                            Active
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setCallForwardingNumber(number)}
                            data-testid={`button-activate-forward-${number.id}`}
                          >
                            Activate
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              data-testid={`button-actions-${number.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onClick={() => handleEditLabel(number)}
                              data-testid={`menu-edit-label-${number.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit label
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setCallForwardingNumber(number)}
                              data-testid={`menu-forward-calls-${number.id}`}
                            >
                              <PhoneForwarded className="h-4 w-4 mr-2" />
                              Forward calls
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600 dark:text-red-400"
                              onClick={() => setReleaseNumber(number)}
                              data-testid={`menu-release-${number.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Release number
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalNumbers > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span data-testid="text-pagination-info">
                {startIndex + 1}-{endIndex} of {totalNumbers} number{totalNumbers !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <span>Show on page</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-16 h-8" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        <Dialog open={!!editLabelNumber} onOpenChange={(open) => !open && setEditLabelNumber(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit label</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="phone-number">Phone number</Label>
                <Input 
                  id="phone-number"
                  value={editLabelNumber ? formatPhoneNumber(editLabelNumber.phoneNumber) : ""}
                  disabled
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input 
                  id="label"
                  placeholder="Enter a label for this number..."
                  value={labelValue}
                  onChange={(e) => setLabelValue(e.target.value)}
                  data-testid="input-edit-label"
                />
                <p className="text-xs text-slate-500">A friendly name to identify this number (e.g., "Main Office", "Support Line")</p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setEditLabelNumber(null)}
                data-testid="button-cancel-label"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveLabel}
                disabled={updateLabelMutation.isPending}
                data-testid="button-save-label"
              >
                {updateLabelMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editCallerIdNumber} onOpenChange={(open) => !open && setEditCallerIdNumber(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set Caller ID Name</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="caller-phone">Phone number</Label>
                <Input 
                  id="caller-phone"
                  value={editCallerIdNumber ? formatPhoneNumber(editCallerIdNumber.phoneNumber) : ""}
                  disabled
                  className="bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="caller-id-name">Caller ID Name (CNAM)</Label>
                <Input 
                  id="caller-id-name"
                  placeholder="e.g., MY COMPANY"
                  value={callerIdValue}
                  onChange={(e) => setCallerIdValue(e.target.value.toUpperCase().slice(0, 15))}
                  maxLength={15}
                  data-testid="input-caller-id"
                />
                <p className="text-xs text-slate-500">
                  Max 15 characters. This name will appear on recipient's caller ID display. 
                  Changes take 3-5 business days to propagate.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setEditCallerIdNumber(null)}
                data-testid="button-cancel-caller-id"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveCallerId}
                disabled={updateCallerIdMutation.isPending || callerIdValue.trim().length === 0}
                data-testid="button-save-caller-id"
              >
                {updateCallerIdMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <BuyNumbersDialog 
          open={showBuyDialog} 
          onOpenChange={setShowBuyDialog} 
          onNumberPurchased={() => {
            refetch();
            setShowBuyDialog(false);
          }}
        />

        <AlertDialog open={!!releaseNumber} onOpenChange={(open) => !open && setReleaseNumber(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Release Phone Number</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to release {releaseNumber ? formatPhoneNumber(releaseNumber.phoneNumber) : ""}?
                <br /><br />
                This will permanently delete the number from your account. The $10/month billing will stop immediately.
                <br /><br />
                <strong>This action cannot be undone.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-release">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmRelease}
                disabled={releaseNumberMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
                data-testid="button-confirm-release"
              >
                {releaseNumberMutation.isPending ? "Releasing..." : "Release Number"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <E911ConfigDialog
          open={!!e911ConfigNumber}
          onOpenChange={(open) => !open && setE911ConfigNumber(null)}
          phoneNumber={e911ConfigNumber?.phoneNumber || ""}
          phoneNumberId={e911ConfigNumber?.id || ""}
          onSuccess={() => {
            refetch();
            setE911ConfigNumber(null);
          }}
        />

        <CallForwardingDialog
          open={!!callForwardingNumber}
          onOpenChange={(open) => !open && setCallForwardingNumber(null)}
          phoneNumber={callForwardingNumber?.phoneNumber || ""}
          phoneNumberId={callForwardingNumber?.id || ""}
          telnyxPhoneNumberId={callForwardingNumber?.telnyxPhoneNumberId || ""}
          currentSettings={{
            enabled: callForwardingNumber?.callForwardingEnabled || false,
            destination: callForwardingNumber?.callForwardingDestination || null,
            keepCallerId: callForwardingNumber?.callForwardingKeepCallerId !== false,
          }}
          onSuccess={() => {
            refetch();
            setCallForwardingNumber(null);
          }}
        />
      </div>
    </SettingsLayout>
  );
}
