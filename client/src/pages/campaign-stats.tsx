import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Mail, MousePointer, Users, Eye, BarChart, ExternalLink, UserX, Search, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { EmailCampaign, EmailOpen, LinkClick, CampaignEmail } from "@shared/schema";
import { LoadingSpinner } from "@/components/loading-spinner";

interface CampaignStats {
  campaign: EmailCampaign;
  opens: (EmailOpen & { userName?: string; userEmail?: string })[];
  clicks: (LinkClick & { userName?: string; userEmail?: string })[];
  uniqueOpeners: string[];
  uniqueClickers: string[];
  clicksByUrl: { url: string; clickCount: number; uniqueClickCount: number }[];
  campaignUnsubscribes: number;
}

export default function CampaignStats() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const { data: stats, isLoading } = useQuery<CampaignStats>({
    queryKey: ["/api/campaigns", id, "stats"],
    refetchInterval: 5000, // Auto-refresh every 5 seconds for live tracking
  });

  const { data: emailsData } = useQuery<{ emails: CampaignEmail[] }>({
    queryKey: ["/api/campaigns", id, "emails", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);
      const url = `/api/campaigns/${id}/emails${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch emails");
      return response.json();
    },
    enabled: !!id,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for live tracking
  });

  const emails = emailsData?.emails || [];

  if (isLoading || !stats) {
    return <LoadingSpinner message="Loading campaign statistics..." />;
  }

  const { campaign, opens, clicks, uniqueOpeners, uniqueClickers, clicksByUrl, campaignUnsubscribes } = stats;

  const recipientCount = campaign.recipientCount || 0;
  const uniqueOpenCount = campaign.uniqueOpenCount || 0;
  const uniqueClickCount = campaign.uniqueClickCount || 0;
  const openCount = campaign.openCount || 0;
  const clickCount = campaign.clickCount || 0;

  const openRate = recipientCount > 0
    ? ((uniqueOpenCount / recipientCount) * 100).toFixed(1)
    : "0.0";

  const clickRate = recipientCount > 0
    ? ((uniqueClickCount / recipientCount) * 100).toFixed(1)
    : "0.0";

  const clickToOpenRate = uniqueOpenCount > 0
    ? ((uniqueClickCount / uniqueOpenCount) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recipients</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-recipients">
              {recipientCount}
            </div>
            <p className="text-xs text-muted-foreground">Total emails sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-open-rate">
              {openRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {uniqueOpenCount} {uniqueOpenCount === 1 ? 'subscriber' : 'subscribers'} opened
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-click-rate">
              {clickRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {uniqueClickCount} {uniqueClickCount === 1 ? 'subscriber' : 'subscribers'} clicked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click-to-Open</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-click-to-open">
              {clickToOpenRate}%
            </div>
            <p className="text-xs text-muted-foreground">Of those who opened</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-unsubscribed">
              {campaignUnsubscribes}
            </div>
            <p className="text-xs text-muted-foreground">From this campaign</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Clicked Links</CardTitle>
            <CardDescription>Links sorted by total clicks</CardDescription>
          </CardHeader>
          <CardContent>
            {clicksByUrl.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-clicks">
                No link clicks yet
              </p>
            ) : (
              <div className="space-y-4">
                {clicksByUrl
                  .sort((a, b) => b.clickCount - a.clickCount)
                  .slice(0, 10)
                  .map((link, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 pb-3 border-b last:border-0"
                      data-testid={`link-stat-${index}`}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={link.url}>
                          {link.url}
                        </p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {link.clickCount} clicks
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {link.uniqueClickCount} unique
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {clickCount > 0 ? ((link.clickCount / clickCount) * 100).toFixed(0) : "0"}%
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest opens and clicks</CardDescription>
          </CardHeader>
          <CardContent>
            {opens.length === 0 && clicks.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="text-no-activity">
                No activity yet
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {[...opens, ...clicks]
                  .sort((a, b) => {
                    const dateA = 'openedAt' in a ? new Date(a.openedAt) : new Date(a.clickedAt);
                    const dateB = 'openedAt' in b ? new Date(b.openedAt) : new Date(b.clickedAt);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .slice(0, 20)
                  .map((activity, index) => {
                    const isOpen = 'openedAt' in activity;
                    const timestamp = isOpen ? activity.openedAt : (activity as LinkClick).clickedAt;
                    
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-3 text-sm"
                        data-testid={`activity-${index}`}
                      >
                        <div className="mt-0.5">
                          {isOpen ? (
                            <Eye className="h-4 w-4 text-blue-500" />
                          ) : (
                            <MousePointer className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {isOpen ? 'Email opened' : 'Link clicked'}
                            {activity.userName && (
                              <span className="text-muted-foreground font-normal"> by {activity.userName}</span>
                            )}
                          </p>
                          {!isOpen && (
                            <p className="text-xs text-muted-foreground truncate" title={(activity as LinkClick).url}>
                              {(activity as LinkClick).url}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Engagement Summary</CardTitle>
          <CardDescription>Detailed breakdown of user engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Unique Openers</p>
              </div>
              <p className="text-2xl font-bold" data-testid="metric-unique-openers">
                {uniqueOpeners.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {recipientCount > 0
                  ? `${((uniqueOpeners.length / recipientCount) * 100).toFixed(1)}% of recipients`
                  : "0% of recipients"}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Unique Clickers</p>
              </div>
              <p className="text-2xl font-bold" data-testid="metric-unique-clickers">
                {uniqueClickers.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {recipientCount > 0
                  ? `${((uniqueClickers.length / recipientCount) * 100).toFixed(1)}% of recipients`
                  : "0% of recipients"}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Avg. Opens per Opener</p>
              </div>
              <p className="text-2xl font-bold" data-testid="metric-avg-opens">
                {uniqueOpeners.length > 0 ? (opens.length / uniqueOpeners.length).toFixed(1) : "0.0"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total {opens.length} opens
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Campaign Recipients</CardTitle>
              <CardDescription>Individual email delivery status and engagement tracking</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-emails"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-emails">
              No emails found
            </p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Opened At</TableHead>
                    <TableHead>Clicked At</TableHead>
                    <TableHead>Unsubscribed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow key={email.id} data-testid={`email-row-${email.id}`}>
                      <TableCell className="font-medium">{email.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            email.status === "opened" || email.status === "clicked"
                              ? "default"
                              : email.status === "failed" || email.status === "bounced"
                              ? "destructive"
                              : email.status === "unsubscribed"
                              ? "secondary"
                              : "outline"
                          }
                          data-testid={`badge-status-${email.id}`}
                        >
                          {email.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(email.sentAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.openedAt
                          ? formatDistanceToNow(new Date(email.openedAt), { addSuffix: true })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.clickedAt
                          ? formatDistanceToNow(new Date(email.clickedAt), { addSuffix: true })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.unsubscribedAt
                          ? formatDistanceToNow(new Date(email.unsubscribedAt), { addSuffix: true })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {emails.length} {emails.length === 1 ? "email" : "emails"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
