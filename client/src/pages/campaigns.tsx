import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Send, Trash2, Edit, Calendar, Users, Mail, BarChart, UserCog, Phone, Building, UserCheck, UserX } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User } from "@shared/schema";
import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { HtmlEditor } from "@/components/html-editor";
import { formatPhoneDisplay } from "@/lib/phone-formatter";

interface EmailCampaign {
  id: string;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  status: string;
  sentAt: Date | null;
  sentBy: string | null;
  recipientCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
}

const campaignSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "Email content is required"),
  textContent: z.string().optional(),
  targetListId: z.string().optional(),
});

const contactListSchema = z.object({
  name: z.string().min(1, "List name is required"),
  description: z.string().optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;
type ContactListForm = z.infer<typeof contactListSchema>;

export default function Campaigns() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<EmailCampaign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<EmailCampaign | null>(null);
  const [activeTab, setActiveTab] = useState("campaigns");
  const [createListOpen, setCreateListOpen] = useState(false);
  const [editListOpen, setEditListOpen] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [deleteListOpen, setDeleteListOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<ContactList | null>(null);
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const { toast } = useToast();

  const { data: sessionData, isLoading: sessionLoading } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data, isLoading } = useQuery<{ campaigns: EmailCampaign[] }>({
    queryKey: ["/api/campaigns"],
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery<{ contacts: User[] }>({
    queryKey: ["/api/contacts"],
  });

  const { data: companiesData } = useQuery<{ companies: any[] }>({
    queryKey: ["/api/companies"],
  });

  const { data: listsData, isLoading: listsLoading } = useQuery<{ lists: ContactList[] }>({
    queryKey: ["/api/contact-lists"],
  });

  const { data: membersData, isLoading: membersLoading } = useQuery<{ members: User[] }>({
    queryKey: ["/api/contact-lists", selectedList?.id, "members"],
    enabled: !!selectedList?.id,
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription status.",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      subject: "",
      htmlContent: "",
      textContent: "",
      targetListId: "",
    },
  });

  const editForm = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
  });

  const listForm = useForm<ContactListForm>({
    resolver: zodResolver(contactListSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editListForm = useForm<ContactListForm>({
    resolver: zodResolver(contactListSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignForm) => {
      return apiRequest("POST", "/api/campaigns", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setCreateOpen(false);
      createForm.reset();
      toast({
        title: "Campaign Created",
        description: "The campaign has been created successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to create campaign. Please try again.";
      toast({
        title: "Error Creating Campaign",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CampaignForm> }) => {
      return apiRequest("PATCH", `/api/campaigns/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setEditOpen(false);
      setEditingCampaign(null);
      editForm.reset();
      toast({
        title: "Campaign Updated",
        description: "The campaign has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update campaign.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
      toast({
        title: "Campaign Deleted",
        description: "The campaign has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete campaign.",
        variant: "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/campaigns/${id}/send`);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setSendDialogOpen(false);
      setCampaignToSend(null);
      
      const result = response.result;
      if (result.totalFailed > 0) {
        toast({
          title: "Campaign Sent (with errors)",
          description: `Sent to ${result.totalSent} users. Failed to send to ${result.totalFailed} users.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Campaign Sent Successfully",
          description: `Successfully sent to ${result.totalSent} ${result.totalSent === 1 ? 'subscriber' : 'subscribers'}.`,
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to send campaign. Please try again.";
      toast({
        title: "Error Sending Campaign",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (data: ContactListForm) => {
      return apiRequest("POST", "/api/contact-lists", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setCreateListOpen(false);
      listForm.reset();
      toast({
        title: "List Created",
        description: "The contact list has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create list.",
        variant: "destructive",
      });
    },
  });

  const updateListMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactListForm> }) => {
      return apiRequest("PATCH", `/api/contact-lists/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setEditListOpen(false);
      setEditingList(null);
      editListForm.reset();
      toast({
        title: "List Updated",
        description: "The contact list has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update list.",
        variant: "destructive",
      });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/contact-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setDeleteListOpen(false);
      setListToDelete(null);
      toast({
        title: "List Deleted",
        description: "The contact list has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete list.",
        variant: "destructive",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      return apiRequest("POST", `/api/contact-lists/${listId}/members`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists", selectedList?.id, "members"] });
      toast({
        title: "Member Added",
        description: "User has been added to the list successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      return apiRequest("DELETE", `/api/contact-lists/${listId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists", selectedList?.id, "members"] });
      toast({
        title: "Member Removed",
        description: "User has been removed from the list successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member.",
        variant: "destructive",
      });
    },
  });

  const currentUser = sessionData?.user;
  const campaigns = data?.campaigns || [];
  const contacts = contactsData?.contacts || [];
  const companies = companiesData?.companies || [];
  const lists = listsData?.lists || [];

  const filteredCampaigns = campaigns.filter(campaign => {
    const query = searchQuery.toLowerCase();
    return campaign.subject.toLowerCase().includes(query);
  });

  const filteredContacts = contacts.filter(contact => {
    const query = contactSearchQuery.toLowerCase();
    const firstName = contact.firstName?.toLowerCase() || "";
    const lastName = contact.lastName?.toLowerCase() || "";
    const email = contact.email.toLowerCase();
    const fullName = `${firstName} ${lastName}`.trim();

    return (
      fullName.includes(query) ||
      email.includes(query) ||
      (contact.phone && formatPhoneDisplay(contact.phone).includes(query))
    );
  });

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

  // Don't show access denied while session is loading
  if (sessionLoading) {
    return null;
  }

  if (currentUser?.role !== "superadmin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Only superadmins can access email campaigns.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleEdit = (campaign: EmailCampaign) => {
    setEditingCampaign(campaign);
    editForm.reset({
      subject: campaign.subject,
      htmlContent: campaign.htmlContent,
      textContent: campaign.textContent || "",
    });
    setEditOpen(true);
  };

  const handleSend = (campaign: EmailCampaign) => {
    setCampaignToSend(campaign);
    setSendDialogOpen(true);
  };

  const handleDelete = (campaign: EmailCampaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (campaign: EmailCampaign) => {
    if (campaign.status === "sent") {
      return <Badge variant="default">Sent</Badge>;
    }
    return <Badge variant="secondary">Draft</Badge>;
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          {activeTab === "campaigns" && (
            <DialogTrigger asChild>
              <Button data-testid="button-create-campaign">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </DialogTrigger>
          )}
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Email Campaign</DialogTitle>
              <DialogDescription>
                Create a new email campaign to send to your subscribers. Use variables like {"{{"} name {"}}"}, {"{{"} email {"}}"}, {"{{"} firstName {"}}"} for personalization.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Campaign subject line" {...field} data-testid="input-campaign-subject" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="htmlContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Content</FormLabel>
                      <FormControl>
                        <HtmlEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="<h1>Hello {{name}}</h1><p>Your email content here...</p>"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="textContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plain Text Content (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Plain text version of your email..."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="textarea-campaign-text"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="targetListId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-target-list">
                            <SelectValue placeholder="All subscribers (default)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="" data-testid="option-all-subscribers">
                            All subscribers
                          </SelectItem>
                          {lists.map((list) => (
                            <SelectItem key={list.id} value={list.id} data-testid={`option-list-${list.id}`}>
                              {list.name} ({list.memberCount} members)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select a specific contact list or send to all subscribers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-campaign">
                    {createMutation.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Mail className="h-4 w-4 mr-2" />
            Campaigns
            <Badge variant="secondary" className="ml-2">{campaigns.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="h-4 w-4 mr-2" />
            Contacts
            <Badge variant="secondary" className="ml-2">{contacts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="lists" data-testid="tab-lists">
            <UserCog className="h-4 w-4 mr-2" />
            Lists
            <Badge variant="secondary" className="ml-2">{lists.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campaigns by subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-campaigns"
                  />
                </div>
                <Badge variant="outline" data-testid="badge-campaign-count">
                  {campaigns.length} {campaigns.length === 1 ? "Campaign" : "Campaigns"}
                </Badge>
              </div>
            </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground" data-testid="text-no-campaigns">
                {searchQuery ? "No campaigns found matching your search." : "No campaigns yet. Create your first campaign to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className="hover-elevate" data-testid={`card-campaign-${campaign.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium" data-testid={`text-campaign-subject-${campaign.id}`}>
                            {campaign.subject}
                          </h3>
                          {getStatusBadge(campaign)}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span data-testid={`text-campaign-created-${campaign.id}`}>
                              Created {formatDistanceToNow(new Date(campaign.createdAt))} ago
                            </span>
                          </div>
                          {campaign.status === "sent" && campaign.sentAt && (
                            <div className="flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              <span data-testid={`text-campaign-sent-${campaign.id}`}>
                                Sent {formatDistanceToNow(new Date(campaign.sentAt))} ago
                              </span>
                            </div>
                          )}
                          {campaign.status === "sent" && campaign.recipientCount !== null && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span data-testid={`text-campaign-recipients-${campaign.id}`}>
                                {campaign.recipientCount} {campaign.recipientCount === 1 ? "recipient" : "recipients"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaign.status === "draft" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(campaign)}
                              data-testid={`button-edit-campaign-${campaign.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleSend(campaign)}
                              disabled={contacts.length === 0}
                              data-testid={`button-send-campaign-${campaign.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(campaign)}
                              data-testid={`button-delete-campaign-${campaign.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {campaign.status === "sent" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigate(`/campaigns/${campaign.id}/stats`)}
                            data-testid={`button-view-stats-${campaign.id}`}
                          >
                            <BarChart className="h-4 w-4 mr-2" />
                            View Stats
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="contacts">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, or phone..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>
            <Badge variant="outline" data-testid="badge-contact-count">
              {contacts.length} {contacts.length === 1 ? "Contact" : "Contacts"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {contactsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground" data-testid="text-no-contacts">
                {contactSearchQuery ? "No contacts found matching your search." : "No contacts yet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Subscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={contact.avatar || undefined} />
                          <AvatarFallback>{getInitials(contact)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid={`text-contact-name-${contact.id}`}>
                            {contact.firstName && contact.lastName
                              ? `${contact.firstName} ${contact.lastName}`
                              : contact.email}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {contact.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-contact-email-${contact.id}`}>
                      {contact.email}
                    </TableCell>
                    <TableCell data-testid={`text-contact-phone-${contact.id}`}>
                      {contact.phone ? formatPhoneDisplay(contact.phone) : "-"}
                    </TableCell>
                    <TableCell data-testid={`text-contact-company-${contact.id}`}>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{getCompanyName(contact)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={contact.emailSubscribed ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSubscriptionMutation.mutate({
                          userId: contact.id,
                          subscribed: !contact.emailSubscribed
                        })}
                        disabled={toggleSubscriptionMutation.isPending}
                        data-testid={`button-toggle-subscription-${contact.id}`}
                        className="gap-2"
                      >
                        {contact.emailSubscribed ? (
                          <>
                            <UserCheck className="h-4 w-4" />
                            Subscribed
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4" />
                            Unsubscribed
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="lists">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <CardTitle className="text-2xl font-semibold">Contact Lists</CardTitle>
              <Badge variant="outline" data-testid="badge-list-count">
                {lists.length} {lists.length === 1 ? "List" : "Lists"}
              </Badge>
            </div>
            <Button onClick={() => setCreateListOpen(true)} data-testid="button-create-list">
              <Plus className="h-4 w-4 mr-2" />
              Create List
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {listsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-8">
              <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground" data-testid="text-no-lists">
                No contact lists yet. Create your first list to segment your audience.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {lists.map((list) => (
                <Card key={list.id} className="hover-elevate" data-testid={`card-list-${list.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium mb-2" data-testid={`text-list-name-${list.id}`}>
                          {list.name}
                        </h3>
                        {list.description && (
                          <p className="text-sm text-muted-foreground mb-3" data-testid={`text-list-description-${list.id}`}>
                            {list.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span data-testid={`text-list-created-${list.id}`}>
                            Created {formatDistanceToNow(new Date(list.createdAt))} ago
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedList(list);
                            setManageMembersOpen(true);
                          }}
                          data-testid={`button-manage-members-${list.id}`}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingList(list);
                            editListForm.reset({ name: list.name, description: list.description || "" });
                            setEditListOpen(true);
                          }}
                          data-testid={`button-edit-list-${list.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setListToDelete(list);
                            setDeleteListOpen(true);
                          }}
                          data-testid={`button-delete-list-${list.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>

      {/* Edit Campaign Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update your campaign details. Note: You can only edit draft campaigns.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((data) =>
                editingCampaign && updateMutation.mutate({ id: editingCampaign.id, data })
              )}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Campaign subject line" {...field} data-testid="input-edit-campaign-subject" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="htmlContent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Content</FormLabel>
                    <FormControl>
                      <HtmlEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="<h1>Hello {{name}}</h1><p>Your email content here...</p>"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="textContent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plain Text Content (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Plain text version of your email..."
                        className="min-h-[100px]"
                        {...field}
                        data-testid="textarea-edit-campaign-text"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-campaign">
                  {updateMutation.isPending ? "Updating..." : "Update Campaign"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Send Campaign Confirmation Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this campaign to all {contacts.length} subscribed {contacts.length === 1 ? "user" : "users"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} data-testid="button-cancel-send">
              Cancel
            </Button>
            <Button
              onClick={() => campaignToSend && sendMutation.mutate(campaignToSend.id)}
              disabled={sendMutation.isPending}
              data-testid="button-confirm-send"
            >
              {sendMutation.isPending ? "Sending..." : "Send Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Campaign Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la campaña{" "}
              <strong>"{campaignToDelete?.subject}"</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => campaignToDelete && deleteMutation.mutate(campaignToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Contact List Dialog */}
      <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Contact List</DialogTitle>
            <DialogDescription>
              Create a new contact list to segment your audience for targeted campaigns.
            </DialogDescription>
          </DialogHeader>
          <Form {...listForm}>
            <form onSubmit={listForm.handleSubmit((data) => createListMutation.mutate(data))} className="space-y-4">
              <FormField
                control={listForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>List Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Premium Users, Newsletter Subscribers" {...field} data-testid="input-list-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={listForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this contact list..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="textarea-list-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createListMutation.isPending} data-testid="button-submit-list">
                  {createListMutation.isPending ? "Creating..." : "Create List"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Contact List Dialog */}
      <Dialog open={editListOpen} onOpenChange={setEditListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact List</DialogTitle>
            <DialogDescription>
              Update the contact list details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editListForm}>
            <form
              onSubmit={editListForm.handleSubmit((data) =>
                editingList && updateListMutation.mutate({ id: editingList.id, data })
              )}
              className="space-y-4"
            >
              <FormField
                control={editListForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>List Name</FormLabel>
                    <FormControl>
                      <Input placeholder="List name" {...field} data-testid="input-edit-list-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editListForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="textarea-edit-list-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateListMutation.isPending} data-testid="button-update-list">
                  {updateListMutation.isPending ? "Updating..." : "Update List"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Contact List Confirmation Dialog */}
      <AlertDialog open={deleteListOpen} onOpenChange={setDeleteListOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la lista{" "}
              <strong>"{listToDelete?.name}"</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-list">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => listToDelete && deleteListMutation.mutate(listToDelete.id)}
              disabled={deleteListMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-list"
            >
              {deleteListMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage List Members Dialog */}
      <Dialog open={manageMembersOpen} onOpenChange={setManageMembersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Members - {selectedList?.name}</DialogTitle>
            <DialogDescription>
              Add or remove users from this contact list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {membersLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => {
                    const isMember = membersData?.members.some(m => m.id === contact.id) || false;
                    const company = companies.find(c => c.id === contact.companyId);
                    
                    return (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={contact.avatar || undefined} />
                              <AvatarFallback>
                                {contact.firstName?.[0]}{contact.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{company?.name || 'N/A'}</TableCell>
                        <TableCell>
                          {isMember ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => selectedList && removeMemberMutation.mutate({ 
                                listId: selectedList.id, 
                                userId: contact.id 
                              })}
                              disabled={removeMemberMutation.isPending}
                              data-testid={`button-remove-member-${contact.id}`}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectedList && addMemberMutation.mutate({ 
                                listId: selectedList.id, 
                                userId: contact.id 
                              })}
                              disabled={addMemberMutation.isPending}
                              data-testid={`button-add-member-${contact.id}`}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Add
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
