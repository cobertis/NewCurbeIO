import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Building, UserCheck, UserX } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type User } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatForDisplay } from "@shared/phone";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data, isLoading } = useQuery<{ contacts: User[] }>({
    queryKey: ["/api/contacts"],
  });

  const toggleSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, subscribed }: { userId: string; subscribed: boolean }) => {
      return apiRequest("PATCH", `/api/users/${userId}/subscription`, { emailSubscribed: subscribed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Subscription Updated",
        description: "User subscription status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update subscription status.",
        variant: "destructive",
      });
    },
  });

  const currentUser = sessionData?.user;
  const contacts = data?.contacts || [];

  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    const firstName = contact.firstName?.toLowerCase() || "";
    const lastName = contact.lastName?.toLowerCase() || "";
    const email = contact.email.toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();

    return (
      fullName.includes(query) ||
      email.includes(query) ||
      (contact.phone && formatForDisplay(contact.phone).includes(query))
    );
  });

  if (currentUser?.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Only superadmins can access email contacts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const getCompanyName = (user: User) => {
    if (!user.companyId) return "No Company";
    return companies.find(c => c.id === user.companyId)?.name || "Unknown";
  };

  const { data: companiesData } = useQuery<{ companies: any[] }>({
    queryKey: ["/api/companies"],
  });
  const companies = companiesData?.companies || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" data-testid="badge-contact-count">
          {contacts.length} {contacts.length === 1 ? "Contact" : "Contacts"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground" data-testid="text-no-contacts">
                {searchQuery ? "No contacts found matching your search." : "No subscribed contacts yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="border-b hover-elevate" data-testid={`row-contact-${contact.id}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.avatar || undefined} />
                            <AvatarFallback>{getInitials(contact)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium" data-testid={`text-contact-name-${contact.id}`}>
                              {contact.firstName && contact.lastName
                                ? `${contact.firstName} ${contact.lastName}`
                                : contact.email}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">{contact.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm" data-testid={`text-contact-email-${contact.id}`}>{contact.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {contact.phone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm" data-testid={`text-contact-phone-${contact.id}`}>
                              {formatForDisplay(contact.phone)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm" data-testid={`text-contact-company-${contact.id}`}>
                            {getCompanyName(contact)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={contact.emailSubscribed ? "default" : "secondary"} data-testid={`badge-contact-status-${contact.id}`}>
                          {contact.emailSubscribed ? "Subscribed" : "Unsubscribed"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSubscriptionMutation.mutate({
                            userId: contact.id,
                            subscribed: !contact.emailSubscribed
                          })}
                          disabled={toggleSubscriptionMutation.isPending}
                          data-testid={`button-toggle-subscription-${contact.id}`}
                        >
                          {contact.emailSubscribed ? (
                            <>
                              <UserX className="h-4 w-4 mr-2" />
                              Unsubscribe
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-2" />
                              Subscribe
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
