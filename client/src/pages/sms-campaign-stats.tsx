import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, MessageSquare, Users, CheckCircle, XCircle, BarChart, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatForDisplay } from "@shared/phone";
import type { SmsCampaign, CampaignSmsMessage } from "@shared/schema";
import { LoadingSpinner } from "@/components/loading-spinner";

interface SmsCampaignStats {
  campaign: SmsCampaign;
  messages: (CampaignSmsMessage & { userName?: string; userEmail?: string })[];
}

export default function SmsCampaignStats() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const { data: stats, isLoading } = useQuery<SmsCampaignStats>({
    queryKey: [`/api/sms-campaigns/${id}/stats`],
    refetchInterval: 5000,
  });

  if (isLoading || !stats) {
    return <LoadingSpinner message="Loading SMS campaign statistics..." />;
  }

  const { campaign, messages } = stats;

  const recipientCount = campaign.recipientCount || 0;
  const deliveredCount = campaign.deliveredCount || 0;
  const failedCount = campaign.failedCount || 0;

  const deliveryRate = recipientCount > 0
    ? ((deliveredCount / recipientCount) * 100).toFixed(1)
    : "0.0";

  const failureRate = recipientCount > 0
    ? ((failedCount / recipientCount) * 100).toFixed(1)
    : "0.0";

  // Filter messages
  const filteredMessages = messages.filter(msg => {
    const matchesStatus = statusFilter === "all" || msg.status === statusFilter;
    const matchesSearch = !searchTerm || 
      msg.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.phoneNumber.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-recipients">
              {recipientCount}
            </div>
            <p className="text-xs text-muted-foreground">Total SMS sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="metric-delivered">
              {deliveredCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {deliveryRate}% delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="metric-failed">
              {failedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {failureRate}% failure rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-sent-at">
              {campaign.sentAt ? formatDistanceToNow(new Date(campaign.sentAt)) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">ago</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Message Details</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredMessages.length} {filteredMessages.length === 1 ? 'message' : 'messages'}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-messages"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No messages found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Twilio SID</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((msg) => (
                  <TableRow key={msg.id} data-testid={`message-row-${msg.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{msg.userName || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">{msg.userEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatForDisplay(msg.phoneNumber)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={msg.status === "delivered" ? "default" : "destructive"}
                        data-testid={`badge-status-${msg.id}`}
                      >
                        {msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {msg.twilioMessageSid || "N/A"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(msg.sentAt))} ago
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {msg.errorMessage && (
                        <div className="text-sm text-destructive">
                          <p className="font-medium">{msg.errorCode}</p>
                          <p className="text-xs">{msg.errorMessage}</p>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
