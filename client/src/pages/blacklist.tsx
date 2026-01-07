import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
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
import { Search, Plus, Shield, Ban, CheckCircle2, XCircle } from "lucide-react";
import { formatForDisplay } from "@shared/phone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBlacklistEntrySchema, type BlacklistEntry } from "@shared/schema";
import type { z } from "zod";

type AddBlacklistValues = z.infer<typeof insertBlacklistEntrySchema>;

export default function Blacklist() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [removeEntryId, setRemoveEntryId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ entries: BlacklistEntry[]; total: number }>({
    queryKey: ["/api/blacklist", { channel: channelFilter === "all" ? undefined : channelFilter, isActive: statusFilter === "active", search: searchQuery }],
  });

  const addForm = useForm<AddBlacklistValues>({
    resolver: zodResolver(insertBlacklistEntrySchema),
    defaultValues: {
      channel: "sms",
      reason: "manual",
      notes: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (values: AddBlacklistValues) => {
      const response = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blacklist"] });
      setIsAddDialogOpen(false);
      addForm.reset();
      toast({
        title: "Added to blacklist",
        description: "The entry has been blacklisted successfully.",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add to blacklist",
        duration: 3000,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/blacklist/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blacklist"] });
      setRemoveEntryId(null);
      toast({
        title: "Removed from blacklist",
        description: "The entry has been removed successfully.",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove from blacklist",
        duration: 3000,
      });
    },
  });

  const entries = data?.entries || [];
  const total = data?.total || 0;

  const getChannelBadge = (channel: string) => {
    const colors: Record<string, string> = {
      sms: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      imessage: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      email: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      all: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return <Badge className={colors[channel] || ""}>{channel.toUpperCase()}</Badge>;
  };

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      stop: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      manual: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      bounced: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      complaint: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    };
    return <Badge className={colors[reason] || ""}>{reason.toUpperCase()}</Badge>;
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Blacklist Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage blocked phone numbers and email addresses
            </p>
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            data-testid="button-add-blacklist"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to Blacklist
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by phone or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-blacklist"
                />
              </div>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-channel-filter">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="imessage">iMessage</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-32" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              {total} {total === 1 ? "entry" : "entries"} found
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No blacklist entries found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identifier</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry: BlacklistEntry) => (
                      <TableRow key={entry.id} data-testid={`row-blacklist-${entry.id}`}>
                        <TableCell className="font-medium">
                          {entry.channel === "sms" || entry.channel === "imessage"
                            ? formatForDisplay(entry.identifier)
                            : entry.identifier}
                        </TableCell>
                        <TableCell>{getChannelBadge(entry.channel)}</TableCell>
                        <TableCell>{getReasonBadge(entry.reason)}</TableCell>
                        <TableCell>
                          {entry.isActive ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <XCircle className="h-3 w-3 mr-1" />
                              Removed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {entry.notes || "-"}
                        </TableCell>
                        <TableCell>
                          {entry.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemoveEntryId(entry.id)}
                              data-testid={`button-remove-${entry.id}`}
                            >
                              Remove
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Blacklist</DialogTitle>
            <DialogDescription>
              Block a phone number or email address from receiving messages
            </DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit((data) => addMutation.mutate(data))} className="space-y-4">
              <FormField
                control={addForm.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Channel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-channel">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="imessage">iMessage</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="all">All Channels</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number or Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., (310) 555-1234 or user@example.com" data-testid="input-identifier" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-reason">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="stop">STOP Request</SelectItem>
                        <SelectItem value="bounced">Bounced</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Add any additional notes..." data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending} data-testid="button-submit">
                  {addMutation.isPending ? "Adding..." : "Add to Blacklist"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeEntryId} onOpenChange={() => setRemoveEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Blacklist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow messages to be sent to this identifier again. The entry will be marked as removed but kept for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeEntryId && removeMutation.mutate(removeEntryId)}
              disabled={removeMutation.isPending}
              data-testid="button-confirm-remove"
            >
              {removeMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
