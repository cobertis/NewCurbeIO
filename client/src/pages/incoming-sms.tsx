import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageSquare, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatPhoneDisplay } from "@/lib/phone-formatter";
import { useToast } from "@/hooks/use-toast";

interface IncomingSmsMessage {
  id: string;
  twilioMessageSid: string;
  fromPhone: string;
  toPhone: string;
  messageBody: string;
  userId: string | null;
  receivedAt: Date;
  isRead: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
}

export default function IncomingSms() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["/api/incoming-sms"],
  });

  const { data: usersData } = useQuery({
    queryKey: ["/api/users"],
  });

  const messages = ((messagesData as any)?.incomingSmsMessages || []) as IncomingSmsMessage[];
  const users = ((usersData as any)?.users || []) as any[];

  const enrichedMessages = messages.map(msg => {
    const user = users.find(u => u.id === msg.userId);
    return {
      ...msg,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar
      } : undefined
    };
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/incoming-sms/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incoming-sms"] });
      toast({
        title: "Success",
        description: "Message marked as read",
      });
    },
  });

  const filteredMessages = enrichedMessages.filter((msg) => {
    const query = searchQuery.toLowerCase();
    return (
      msg.fromPhone.toLowerCase().includes(query) ||
      msg.messageBody.toLowerCase().includes(query) ||
      msg.user?.firstName?.toLowerCase().includes(query) ||
      msg.user?.lastName?.toLowerCase().includes(query) ||
      msg.user?.email?.toLowerCase().includes(query)
    );
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {unreadCount} Unread
          </Badge>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                data-testid="input-search-messages"
                placeholder="Search by phone, message, or sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading messages...
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? "No messages found" : "No incoming SMS messages yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => (
                  <TableRow 
                    key={message.id} 
                    data-testid={`row-message-${message.id}`}
                    className={!message.isRead ? "bg-accent/50" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {formatPhoneDisplay(message.fromPhone)}
                        {!message.isRead && (
                          <Badge variant="secondary" className="text-xs">New</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md truncate" title={message.messageBody}>
                        {message.messageBody}
                      </div>
                    </TableCell>
                    <TableCell>
                      {message.user ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.user.avatar || undefined} />
                            <AvatarFallback>
                              {message.user.firstName[0]}{message.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {message.user.firstName} {message.user.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {message.user.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(message.receivedAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {!message.isRead && (
                        <Button
                          data-testid={`button-mark-read-${message.id}`}
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsReadMutation.mutate(message.id)}
                          disabled={markAsReadMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark Read
                        </Button>
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
