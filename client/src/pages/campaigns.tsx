import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Send, Trash2, Edit, Calendar, Users, Mail, BarChart, UserCog, Phone, Building, UserCheck, UserX, MoveRight, Upload, Download, MessageSquare, MessageSquareOff, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type User } from "@shared/schema";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { HtmlEditor } from "@/components/html-editor";
import { formatForDisplay } from "@shared/phone";
import { useTabsState } from "@/hooks/use-tabs-state";

interface EmailCampaign {
  id: string;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  status: string;
  targetListId: string | null;
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

interface SmsCampaign {
  id: string;
  message: string;
  status: string;
  targetListId: string | null;
  sentAt: Date | null;
  sentBy: string | null;
  recipientCount: number | null;
  deliveredCount: number | null;
  failedCount: number | null;
  createdAt: Date;
  updatedAt: Date;
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

const addContactSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  companyId: z.string().optional(),
});

const smsCampaignSchema = z.object({
  message: z.string().min(1, "Message is required").max(1600, "Message too long (max 1600 characters)"),
  targetListId: z.string().optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;
type ContactListForm = z.infer<typeof contactListSchema>;
type AddContactForm = z.infer<typeof addContactSchema>;
type SmsCampaignForm = z.infer<typeof smsCampaignSchema>;

export default function Campaigns() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [smsSearchQuery, setSmsSearchQuery] = useState("");
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<EmailCampaign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<EmailCampaign | null>(null);
  const [activeTab, setActiveTab] = useTabsState(["reports", "campaigns", "sms", "lists"], "reports");
  const [createListOpen, setCreateListOpen] = useState(false);
  const [editListOpen, setEditListOpen] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [deleteListOpen, setDeleteListOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState<ContactList | null>(null);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [moveToListOpen, setMoveToListOpen] = useState(false);
  const [targetMoveListId, setTargetMoveListId] = useState("");
  const [selectedView, setSelectedView] = useState<"all" | "unsubscribed" | string>("all");
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [allContactsSearchQuery, setAllContactsSearchQuery] = useState("");
  const [allContactsStatusFilter, setAllContactsStatusFilter] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [uploadCsvOpen, setUploadCsvOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [createSmsOpen, setCreateSmsOpen] = useState(false);
  const [smsCampaignToSend, setSmsCampaignToSend] = useState<SmsCampaign | null>(null);
  const [sendSmsDialogOpen, setSendSmsDialogOpen] = useState(false);
  const [smsCampaignToDelete, setSmsCampaignToDelete] = useState<SmsCampaign | null>(null);
  const [deleteSmsDialogOpen, setDeleteSmsDialogOpen] = useState(false);
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
    queryKey: [`/api/contact-lists/${selectedList?.id}/members`],
    enabled: !!selectedList?.id,
  });

  const { data: smsData, isLoading: smsLoading } = useQuery<{ smsCampaigns: SmsCampaign[] }>({
    queryKey: ["/api/sms-campaigns"],
  });

  // Auto-refresh campaigns when any are in "sending" status
  useEffect(() => {
    const hasSendingCampaigns = data?.campaigns?.some(c => c.status === "sending");
    
    if (hasSendingCampaigns) {
      const intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(intervalId);
    }
  }, [data?.campaigns]);

  // Auto-refresh SMS campaigns when any are in "sending" status
  useEffect(() => {
    const hasSendingSmsCampaigns = smsData?.smsCampaigns?.some(c => c.status === "sending");
    
    if (hasSendingSmsCampaigns) {
      const intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(intervalId);
    }
  }, [smsData?.smsCampaigns]);

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

  const addContactForm = useForm<AddContactForm>({
    resolver: zodResolver(addContactSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      companyId: "",
    },
  });

  const smsForm = useForm<SmsCampaignForm>({
    resolver: zodResolver(smsCampaignSchema),
    defaultValues: {
      message: "",
      targetListId: "",
    },
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
      
      toast({
        title: "Campaign Sending Started",
        description: "Your campaign is being sent in the background. This may take a few minutes.",
      });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contact-lists/${variables.listId}/members`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/contact-lists/${variables.listId}/members`] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
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

  const moveContactsMutation = useMutation({
    mutationFn: async ({ userIds, targetListId }: { userIds: string[]; targetListId: string }) => {
      return apiRequest("POST", "/api/contact-lists/bulk-move", { userIds, targetListId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      if (selectedList?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/contact-lists/${selectedList.id}/members`] });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/contact-lists/${variables.targetListId}/members`] });
      setSelectedMembers([]);
      setMoveToListOpen(false);
      setTargetMoveListId("");
      toast({
        title: "Contacts Moved",
        description: "Selected contacts have been moved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to move contacts.",
        variant: "destructive",
      });
    },
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: AddContactForm) => {
      return apiRequest("POST", "/api/users", {
        ...data,
        password: Math.random().toString(36).slice(-8),
        role: "viewer",
        emailSubscribed: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAddContactOpen(false);
      addContactForm.reset();
      toast({
        title: "Contact Added",
        description: "The contact has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contact.",
        variant: "destructive",
      });
    },
  });

  const createSmsMutation = useMutation({
    mutationFn: async (data: SmsCampaignForm) => {
      return apiRequest("POST", "/api/sms-campaigns", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      setCreateSmsOpen(false);
      smsForm.reset();
      toast({
        title: "SMS Campaign Created",
        description: "The SMS campaign has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create SMS campaign.",
        variant: "destructive",
      });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/sms-campaigns/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      setSendSmsDialogOpen(false);
      setSmsCampaignToSend(null);
      toast({
        title: "SMS Campaign Sending",
        description: "Your SMS campaign is being sent in the background.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send SMS campaign.",
        variant: "destructive",
      });
    },
  });

  const deleteSmsMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/sms-campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      setDeleteSmsDialogOpen(false);
      setSmsCampaignToDelete(null);
      toast({
        title: "SMS Campaign Deleted",
        description: "The SMS campaign has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete SMS campaign.",
        variant: "destructive",
      });
    },
  });

  const currentUser = sessionData?.user;
  const campaigns = data?.campaigns || [];
  const smsCampaigns = smsData?.smsCampaigns || [];
  const contacts = contactsData?.contacts || [];
  const companies = companiesData?.companies || [];
  const lists = listsData?.lists || [];

  const filteredCampaigns = campaigns.filter(campaign => {
    const query = searchQuery.toLowerCase();
    return campaign.subject.toLowerCase().includes(query);
  });

  const filteredSmsCampaigns = smsCampaigns.filter(smsCampaign => {
    const query = smsSearchQuery.toLowerCase();
    return smsCampaign.message.toLowerCase().includes(query);
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
      (contact.phone && formatForDisplay(contact.phone).includes(query))
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

  const handleDownloadCSV = () => {
    const csvData = contacts.map(c => ({
      Name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
      Email: c.email,
      Phone: c.phone ? formatForDisplay(c.phone) : '',
      Company: getCompanyName(c),
      Status: c.emailSubscribed ? 'Subscribed' : 'Unsubscribed',
    }));

    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status'];
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({
      title: "CSV Downloaded",
      description: `Downloaded ${contacts.length} contacts.`,
    });
  };

  const handleUploadCSV = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }

    setCsvImporting(true);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error("CSV file is empty or has no data rows");
      }

      // Parse CSV (simple parser - assumes comma-separated, quotes-optional)
      const parseCsvLine = (line: string) => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, ''));
      const rows = lines.slice(1).map(line => parseCsvLine(line));

      // Map CSV columns to our fields
      const emailIdx = headers.findIndex(h => h.includes('email') || h === 'e-mail');
      const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('first') && !h.includes('last'));
      const firstNameIdx = headers.findIndex(h => h.includes('first'));
      const lastNameIdx = headers.findIndex(h => h.includes('last'));
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel'));

      if (emailIdx === -1) {
        throw new Error("CSV must have an 'Email' column");
      }

      // Prepare contacts for import
      const contactsToImport = rows
        .filter(row => row[emailIdx]?.trim()) // Must have email
        .map(row => {
          const email = row[emailIdx].replace(/"/g, '').trim();
          let firstName = '';
          let lastName = '';

          if (firstNameIdx !== -1) {
            firstName = row[firstNameIdx]?.replace(/"/g, '').trim() || '';
          }
          if (lastNameIdx !== -1) {
            lastName = row[lastNameIdx]?.replace(/"/g, '').trim() || '';
          }
          
          // If no first/last name columns, try to split from name column
          if (!firstName && !lastName && nameIdx !== -1) {
            const fullName = row[nameIdx]?.replace(/"/g, '').trim() || '';
            const nameParts = fullName.split(' ');
            if (nameParts.length > 0) firstName = nameParts[0];
            if (nameParts.length > 1) lastName = nameParts.slice(1).join(' ');
          }

          const phone = phoneIdx !== -1 ? row[phoneIdx]?.replace(/"/g, '').trim() : undefined;

          return {
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            phone: phone || undefined,
          };
        });

      if (contactsToImport.length === 0) {
        throw new Error("No valid contacts found in CSV");
      }

      // Import contacts
      const response = await apiRequest("POST", "/api/contacts/import", { contacts: contactsToImport }) as unknown as { imported: number; skipped: number };
      
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      setUploadCsvOpen(false);
      setCsvFile(null);
      
      toast({
        title: "Import Successful",
        description: `Successfully imported ${response.imported} contacts. ${response.skipped} duplicates skipped.`,
      });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import CSV file",
        variant: "destructive",
      });
    } finally {
      setCsvImporting(false);
    }
  };

  const getViewContacts = () => {
    let filtered = [];
    
    if (selectedView === "all") {
      filtered = contacts;
      
      // Apply search filter
      if (allContactsSearchQuery) {
        const query = allContactsSearchQuery.toLowerCase();
        filtered = filtered.filter(c => 
          c.email.toLowerCase().includes(query) ||
          c.firstName?.toLowerCase().includes(query) ||
          c.lastName?.toLowerCase().includes(query)
        );
      }
      
      // Apply status filter
      if (allContactsStatusFilter === "subscribed") {
        filtered = filtered.filter(c => c.emailSubscribed);
      } else if (allContactsStatusFilter === "unsubscribed") {
        filtered = filtered.filter(c => !c.emailSubscribed);
      }
      
      return filtered;
    } else if (selectedView === "unsubscribed") {
      return contacts.filter(c => !c.emailSubscribed);
    } else if (selectedView === "sms-unsubscribed") {
      return contacts.filter(c => !c.smsSubscribed);
    } else if (selectedList) {
      return membersData?.members || [];
    }
    return [];
  };

  const viewContacts = getViewContacts();

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
    if (campaign.status === "sending") {
      return <Badge variant="outline">Sending...</Badge>;
    }
    if (campaign.status === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Draft</Badge>;
  };

  return (
    <div className="p-4 space-y-4">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                    <Select onValueChange={(value) => field.onChange(value === "all" ? "" : value)} value={field.value || "all"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-target-list">
                          <SelectValue placeholder="All subscribers (default)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-all-subscribers">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="reports" data-testid="tab-reports">
            <BarChart className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Mail className="h-4 w-4 mr-2" />
            Email Campaigns
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-sms">
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS Campaigns
          </TabsTrigger>
          <TabsTrigger value="lists" data-testid="tab-lists">
            <UserCog className="h-4 w-4 mr-2" />
            Contact Lists
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-campaigns">
                  {campaigns.length + smsCampaigns.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {campaigns.length} email, {smsCampaigns.length} SMS
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-recipients">
                  {campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + (c.recipientCount || 0), 0) + 
                   smsCampaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + (c.recipientCount || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all sent campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-contacts">
                  {contacts.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {contacts.filter(c => c.emailSubscribed).length} subscribed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contact Lists</CardTitle>
                <UserCog className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-lists">
                  {lists.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Custom contact segments
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const allCampaigns = [
                    ...campaigns.map(c => ({ ...c, type: 'email' as const })),
                    ...smsCampaigns.map(c => ({ ...c, type: 'sms' as const }))
                  ].sort((a, b) => {
                    const dateA = a.sentAt ? new Date(a.sentAt).getTime() : new Date(a.createdAt).getTime();
                    const dateB = b.sentAt ? new Date(b.sentAt).getTime() : new Date(b.createdAt).getTime();
                    return dateB - dateA;
                  });

                  return allCampaigns.length === 0 ? (
                    <div className="text-center py-8">
                      <Send className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No campaigns yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allCampaigns.slice(0, 5).map((campaign) => (
                        <div 
                          key={`${campaign.type}-${campaign.id}`} 
                          className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer" 
                          data-testid={`report-campaign-${campaign.id}`}
                          onClick={() => {
                            if (campaign.type === 'email' && campaign.status === 'sent') {
                              navigate(`/campaigns/${campaign.id}/stats`);
                            } else if (campaign.type === 'sms' && campaign.status === 'sent') {
                              navigate(`/sms-campaigns/${campaign.id}/stats`);
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {campaign.type === 'email' ? (
                                <Mail className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              )}
                              <p className="font-medium truncate">
                                {campaign.type === 'email' ? (campaign as any).subject : (campaign as any).message.substring(0, 50) + '...'}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {campaign.status === 'sent' 
                                ? `Sent ${formatDistanceToNow(new Date(campaign.sentAt!))} ago` 
                                : 'Draft'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {campaign.type === 'email' ? 'Email' : 'SMS'}
                            </Badge>
                            <Badge variant={campaign.status === 'sent' ? 'default' : 'outline'}>
                              {campaign.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Email Campaigns</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{campaigns.filter(c => c.status === 'sent').length}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + (c.recipientCount || 0), 0)} recipients
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">SMS Campaigns</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{smsCampaigns.filter(c => c.status === 'sent').length}</p>
                      <p className="text-xs text-muted-foreground">
                        {smsCampaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + (c.recipientCount || 0), 0)} recipients
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">SMS Delivery Rate</span>
                      <span className="text-sm font-bold">
                        {(() => {
                          const totalSent = smsCampaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + (c.recipientCount || 0), 0);
                          const totalDelivered = smsCampaigns.filter(c => c.status === 'sent').reduce((sum, c) => sum + (c.deliveredCount || 0), 0);
                          return totalSent > 0 ? `${((totalDelivered / totalSent) * 100).toFixed(1)}%` : 'N/A';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                <Button onClick={() => setCreateOpen(true)} data-testid="button-create-campaign">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
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
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => navigate(`/campaigns/${campaign.id}/stats`)}
                              data-testid={`button-view-stats-${campaign.id}`}
                            >
                              <BarChart className="h-4 w-4 mr-2" />
                              View Stats
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(campaign)}
                              data-testid={`button-delete-sent-campaign-${campaign.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
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

    <TabsContent value="lists" className="space-y-4">
      {/* Header with action buttons */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Contact Management</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-upload-csv" onClick={() => setUploadCsvOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button variant="outline" size="sm" data-testid="button-download-csv" onClick={handleDownloadCSV}>
                <Download className="h-4 w-4 mr-2" />
                Download Contacts
              </Button>
              <Button size="sm" data-testid="button-add-contact" onClick={() => setAddContactOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content area */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Views and Lists */}
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">Contact Lists</CardTitle>
                <Button size="sm" onClick={() => setCreateListOpen(true)} data-testid="button-create-list">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {/* All Contacts */}
                <div
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover-elevate ${
                    selectedView === "all" ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    setSelectedView("all");
                    setSelectedList(null);
                    setSelectedMembers([]);
                  }}
                  data-testid="view-all-contacts"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">All Contacts</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{contacts.length}</Badge>
                </div>

                {/* Unsubscribed */}
                <div
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover-elevate ${
                    selectedView === "unsubscribed" ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    setSelectedView("unsubscribed");
                    setSelectedList(null);
                    setSelectedMembers([]);
                  }}
                  data-testid="view-unsubscribed"
                >
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Unsubscribed</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{contacts.filter(c => !c.emailSubscribed).length}</Badge>
                </div>

                {/* SMS Unsubscribed */}
                <div
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover-elevate ${
                    selectedView === "sms-unsubscribed" ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    setSelectedView("sms-unsubscribed");
                    setSelectedList(null);
                    setSelectedMembers([]);
                  }}
                  data-testid="view-sms-unsubscribed"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquareOff className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">SMS Unsubscribed</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{contacts.filter(c => !c.smsSubscribed).length}</Badge>
                </div>

                {/* Divider */}
                {lists.length > 0 && <div className="border-t my-3" />}

                {/* Custom Lists */}
                {lists.map((list) => (
                  <div
                    key={list.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover-elevate ${
                      selectedList?.id === list.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      setSelectedList(list);
                      setSelectedView(list.id);
                      setSelectedMembers([]);
                    }}
                    data-testid={`list-item-${list.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <UserCog className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{list.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs ml-2">{list.memberCount || 0}</Badge>
                  </div>
                ))}

                {lists.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground">No custom lists yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Contact Table */}
        <div className="col-span-9">
          <Card className="h-full">
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-semibold">
                      {selectedView === "all" ? "All Contacts" : 
                       selectedView === "unsubscribed" ? "Unsubscribed" : 
                       selectedView === "sms-unsubscribed" ? "SMS Unsubscribed" :
                       selectedList?.name || "Contacts"}
                    </CardTitle>
                    <Badge variant="outline" data-testid="text-contact-count">{viewContacts.length}</Badge>
                  </div>
                  {selectedList && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingList(selectedList);
                          editListForm.reset({ name: selectedList.name, description: selectedList.description || "" });
                          setEditListOpen(true);
                        }}
                        data-testid={`button-edit-list-${selectedList.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setListToDelete(selectedList);
                          setDeleteListOpen(true);
                        }}
                        data-testid={`button-delete-list-${selectedList.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Filters for All Contacts view */}
                {selectedView === "all" && (
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or email..."
                        value={allContactsSearchQuery}
                        onChange={(e) => setAllContactsSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-all-contacts-search"
                      />
                    </div>
                    <Select value={allContactsStatusFilter} onValueChange={(value: any) => setAllContactsStatusFilter(value)}>
                      <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="subscribed">Subscribed</SelectItem>
                        <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedMembers.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMoveToListOpen(true)}
                        data-testid="button-move-selected"
                      >
                        <MoveRight className="h-4 w-4 mr-2" />
                        Move to List ({selectedMembers.length})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {viewContacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No contacts in this view</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedView === "all" && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={viewContacts.length > 0 && selectedMembers.length === viewContacts.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMembers(viewContacts.map(c => c.id));
                              } else {
                                setSelectedMembers([]);
                              }
                            }}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                      )}
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewContacts.map((contact) => (
                      <TableRow key={contact.id} data-testid={`contact-row-${contact.id}`}>
                        {selectedView === "all" && (
                          <TableCell>
                            <Checkbox
                              checked={selectedMembers.includes(contact.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedMembers([...selectedMembers, contact.id]);
                                } else {
                                  setSelectedMembers(selectedMembers.filter(id => id !== contact.id));
                                }
                              }}
                              data-testid={`checkbox-select-${contact.id}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={contact.avatar || undefined} />
                              <AvatarFallback>{getInitials(contact)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {contact.phone ? formatForDisplay(contact.phone) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{getCompanyName(contact)}</TableCell>
                        <TableCell>
                          <Badge variant={contact.emailSubscribed ? "default" : "outline"} className="text-xs">
                            {contact.emailSubscribed ? "Subscribed" : "Unsubscribed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" data-testid={`button-message-${contact.id}`}>
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/users/${contact.id}`)} data-testid={`button-edit-contact-${contact.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" data-testid={`button-more-${contact.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
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
      </div>
    </TabsContent>

    <TabsContent value="sms">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SMS campaigns by message..."
                value={smsSearchQuery}
                onChange={(e) => setSmsSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-sms"
              />
            </div>
            <Badge variant="outline" data-testid="badge-sms-count">
              {smsCampaigns.length} {smsCampaigns.length === 1 ? "Campaign" : "Campaigns"}
            </Badge>
            <Button onClick={() => setCreateSmsOpen(true)} data-testid="button-create-sms">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {smsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSmsCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground" data-testid="text-no-sms">
                {smsSearchQuery ? "No SMS campaigns found matching your search." : "No SMS campaigns yet. Create your first SMS campaign to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSmsCampaigns.map((smsCampaign) => (
                <Card key={smsCampaign.id} className="hover-elevate" data-testid={`card-sms-${smsCampaign.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium" data-testid={`text-sms-message-${smsCampaign.id}`}>
                            {smsCampaign.message.length > 100 ? `${smsCampaign.message.substring(0, 100)}...` : smsCampaign.message}
                          </h3>
                          <Badge variant={smsCampaign.status === "sent" ? "default" : smsCampaign.status === "sending" ? "secondary" : "outline"}>
                            {smsCampaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Created {formatDistanceToNow(new Date(smsCampaign.createdAt))} ago</span>
                          </div>
                          {smsCampaign.status === "sent" && smsCampaign.sentAt && (
                            <div className="flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              <span>Sent {formatDistanceToNow(new Date(smsCampaign.sentAt))} ago</span>
                            </div>
                          )}
                          {smsCampaign.status === "sent" && smsCampaign.recipientCount !== null && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{smsCampaign.recipientCount} {smsCampaign.recipientCount === 1 ? "recipient" : "recipients"}</span>
                            </div>
                          )}
                          {smsCampaign.deliveredCount !== null && smsCampaign.deliveredCount > 0 && (
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-green-600" />
                              <span>{smsCampaign.deliveredCount} delivered</span>
                            </div>
                          )}
                          {smsCampaign.failedCount !== null && smsCampaign.failedCount > 0 && (
                            <div className="flex items-center gap-2">
                              <UserX className="h-4 w-4 text-destructive" />
                              <span>{smsCampaign.failedCount} failed</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {smsCampaign.status === "draft" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSmsCampaignToSend(smsCampaign);
                                setSendSmsDialogOpen(true);
                              }}
                              disabled={contacts.filter(c => c.phone).length === 0}
                              data-testid={`button-send-sms-${smsCampaign.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSmsCampaignToDelete(smsCampaign);
                                setDeleteSmsDialogOpen(true);
                              }}
                              data-testid={`button-delete-sms-${smsCampaign.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {(smsCampaign.status === "sent" || smsCampaign.status === "sending") && (
                          <>
                            {smsCampaign.status === "sent" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate(`/sms-campaigns/${smsCampaign.id}/stats`)}
                                data-testid={`button-view-sms-stats-${smsCampaign.id}`}
                              >
                                <BarChart className="h-4 w-4 mr-2" />
                                View Stats
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSmsCampaignToDelete(smsCampaign);
                                setDeleteSmsDialogOpen(true);
                              }}
                              data-testid={`button-delete-sent-sms-${smsCampaign.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
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
              {(() => {
                if (!campaignToSend) return null;
                
                let targetDescription = "";
                let recipientInfo = null;
                
                if (campaignToSend.targetListId) {
                  // Find the target list
                  const targetList = lists.find(l => l.id === campaignToSend.targetListId);
                  if (targetList) {
                    targetDescription = `the "${targetList.name}" list`;
                    recipientInfo = (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Up to {targetList.memberCount || 0} {(targetList.memberCount || 0) === 1 ? "recipient" : "recipients"}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Only subscribed members of this list will receive the email.
                        </p>
                      </div>
                    );
                  }
                } else {
                  // All subscribed users
                  targetDescription = "all subscribers";
                  recipientInfo = (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{contacts.length} {contacts.length === 1 ? "recipient" : "recipients"}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        All users subscribed to email campaigns will receive this email.
                      </p>
                    </div>
                  );
                }
                
                return (
                  <>
                    Are you sure you want to send this campaign to {targetDescription}?
                    {recipientInfo}
                    <p className="mt-3 text-sm text-muted-foreground">This action cannot be undone.</p>
                  </>
                );
              })()}
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

      {/* Move Contacts to List Dialog */}
      <Dialog open={moveToListOpen} onOpenChange={setMoveToListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Contacts to List</DialogTitle>
            <DialogDescription>
              Select a target list to move the {selectedMembers.length} selected {selectedMembers.length === 1 ? 'contact' : 'contacts'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Target List</label>
              <Select value={targetMoveListId} onValueChange={setTargetMoveListId}>
                <SelectTrigger data-testid="select-move-target-list">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists
                    .filter(list => list.id !== selectedList?.id)
                    .map((list) => (
                      <SelectItem key={list.id} value={list.id} data-testid={`option-move-list-${list.id}`}>
                        {list.name} ({list.memberCount || 0} members)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToListOpen(false)} data-testid="button-cancel-move">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (targetMoveListId) {
                  moveContactsMutation.mutate({ 
                    userIds: selectedMembers, 
                    targetListId: targetMoveListId 
                  });
                }
              }}
              disabled={!targetMoveListId || moveContactsMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveContactsMutation.isPending ? "Moving..." : "Move Contacts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload CSV Dialog */}
      <Dialog open={uploadCsvOpen} onOpenChange={setUploadCsvOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import contacts. The file must have an "Email" column.
              Optional columns: Name, First Name, Last Name, Phone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="hidden"
                id="csv-upload"
                data-testid="input-csv-file"
              />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                {csvFile ? (
                  <div className="text-center">
                    <p className="font-medium">{csvFile.name}</p>
                    <p className="text-sm text-muted-foreground">{(csvFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-medium">Click to select CSV file</p>
                    <p className="text-sm text-muted-foreground">or drag and drop</p>
                  </div>
                )}
              </label>
            </div>
            <div className="bg-muted p-3 rounded-md text-sm">
              <p className="font-medium mb-1">CSV Format Example:</p>
              <code className="text-xs">Email, First Name, Last Name, Phone<br/>john@example.com, John, Doe, +1234567890</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadCsvOpen(false);
              setCsvFile(null);
            }} data-testid="button-cancel-upload">
              Cancel
            </Button>
            <Button
              onClick={handleUploadCSV}
              disabled={!csvFile || csvImporting}
              data-testid="button-confirm-upload"
            >
              {csvImporting ? "Importing..." : "Import Contacts"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a new contact to your database. They will be automatically subscribed to email campaigns.
            </DialogDescription>
          </DialogHeader>
          <Form {...addContactForm}>
            <form
              onSubmit={addContactForm.handleSubmit((data) => addContactMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={addContactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email*</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@example.com" {...field} data-testid="input-contact-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addContactForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} data-testid="input-contact-firstname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addContactForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} data-testid="input-contact-lastname" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={addContactForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(415) 555-1234" {...field} data-testid="input-contact-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addContactForm.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger data-testid="select-contact-company">
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={addContactMutation.isPending} data-testid="button-submit-contact">
                  {addContactMutation.isPending ? "Adding..." : "Add Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create SMS Campaign Dialog */}
      <Dialog open={createSmsOpen} onOpenChange={setCreateSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SMS Campaign</DialogTitle>
            <DialogDescription>
              Create a new SMS campaign to send text messages to your contacts via Twilio.
            </DialogDescription>
          </DialogHeader>
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit((data) => createSmsMutation.mutate(data))} className="space-y-4">
              <FormField
                control={smsForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Your SMS message here..."
                        className="min-h-[120px]"
                        {...field}
                        data-testid="textarea-sms-message"
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum 1600 characters. {field.value?.length || 0}/1600
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={smsForm.control}
                name="targetListId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Audience (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "all" ? undefined : value)} 
                      value={field.value || "all"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-sms-target">
                          <SelectValue placeholder="Send to all contacts with phone numbers" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All contacts with phone numbers</SelectItem>
                        {lists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.memberCount || 0} members)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a specific contact list or send to all contacts with phone numbers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createSmsMutation.isPending} data-testid="button-submit-sms">
                  {createSmsMutation.isPending ? "Creating..." : "Create SMS Campaign"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Send SMS Campaign Confirmation Dialog */}
      <Dialog open={sendSmsDialogOpen} onOpenChange={setSendSmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS Campaign</DialogTitle>
            <DialogDescription>
              {(() => {
                if (!smsCampaignToSend) return null;
                
                const recipientsWithPhone = smsCampaignToSend.targetListId
                  ? contacts.filter(c => c.phone && lists.find(l => l.id === smsCampaignToSend.targetListId))
                  : contacts.filter(c => c.phone);
                
                const targetDesc = smsCampaignToSend.targetListId
                  ? lists.find(l => l.id === smsCampaignToSend.targetListId)?.name || "selected list"
                  : "all contacts with phone numbers";

                return (
                  <>
                    <p>Are you sure you want to send this SMS campaign to {targetDesc}?</p>
                    <p className="mt-2 font-semibold">{recipientsWithPhone.length} {recipientsWithPhone.length === 1 ? "recipient" : "recipients"} will receive this message</p>
                    <p className="mt-3 text-sm text-muted-foreground">This action cannot be undone.</p>
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendSmsDialogOpen(false)} data-testid="button-cancel-send-sms">
              Cancel
            </Button>
            <Button
              onClick={() => smsCampaignToSend && sendSmsMutation.mutate(smsCampaignToSend.id)}
              disabled={sendSmsMutation.isPending}
              data-testid="button-confirm-send-sms"
            >
              {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete SMS Campaign Confirmation Dialog */}
      <AlertDialog open={deleteSmsDialogOpen} onOpenChange={setDeleteSmsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SMS Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The SMS campaign will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-sms">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => smsCampaignToDelete && deleteSmsMutation.mutate(smsCampaignToDelete.id)}
              disabled={deleteSmsMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-sms"
            >
              {deleteSmsMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
