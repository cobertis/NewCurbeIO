import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MousePointer, Users, Eye, BarChart, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { EmailCampaign, EmailOpen, LinkClick } from "@shared/schema";

interface CampaignStats {
  campaign: EmailCampaign;
  opens: EmailOpen[];
  clicks: LinkClick[];
  uniqueOpeners: string[];
  uniqueClickers: string[];
  clicksByUrl: { url: string; clickCount: number; uniqueClickCount: number }[];
}

export default function CampaignStats() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = useQuery<CampaignStats>({
    queryKey: ["/api/campaigns", id, "stats"],
  });

  if (isLoading || !stats) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/campaigns")}
            data-testid="button-back-to-campaigns"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Campaign Statistics</h1>
        </div>
        <div className="grid gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Loading statistics...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { campaign, opens, clicks, uniqueOpeners, uniqueClickers, clicksByUrl } = stats;

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
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/campaigns")}
          data-testid="button-back-to-campaigns"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Campaign Statistics</h1>
          <p className="text-muted-foreground mt-1">{campaign.subject}</p>
        </div>
        <Badge
          variant={campaign.status === "sent" ? "default" : "secondary"}
          data-testid={`badge-status-${campaign.id}`}
        >
          {campaign.status}
        </Badge>
      </div>

      {campaign.sentAt && (
        <p className="text-sm text-muted-foreground mb-6" data-testid="text-sent-at">
          Sent {formatDistanceToNow(new Date(campaign.sentAt), { addSuffix: true })}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
              {uniqueOpenCount} unique opens / {openCount} total
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
              {uniqueClickCount} unique clicks / {clickCount} total
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
    </div>
  );
}
