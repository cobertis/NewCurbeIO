import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneInput } from "@shared/phone";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Filter, 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  Users,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  ListPlus,
  UserPlus,
  FileUp,
  CheckSquare,
  Square,
  AlertCircle,
  Shield,
} from "lucide-react";
import { type ManualContact, type Contact, type ContactList, type User } from "@shared/schema";
import { formatForDisplay, formatForStorage } from "@shared/phone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertManualContactSchema } from "@shared/schema";

// Contact form schema
const contactFormSchema = insertManualContactSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

// List form schema
const listFormSchema = z.object({
  name: z.string().min(1, "List name is required"),
  description: z.string().optional(),
});

type ListFormValues = z.infer<typeof listFormSchema>;

export default function Contacts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ManualContact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [selectedListFilter, setSelectedListFilter] = useState<string>("all");
  const [selectedListForImport, setSelectedListForImport] = useState<string>("");
  
  // List management states
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [isDeleteListOpen, setIsDeleteListOpen] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [isBulkAddToListOpen, setIsBulkAddToListOpen] = useState(false);
  const [selectedListForBulkAdd, setSelectedListForBulkAdd] = useState<string>("");
  
  // Blacklist management
  const [isBlacklistDialogOpen, setIsBlacklistDialogOpen] = useState(false);
  const [blacklistingContact, setBlacklistingContact] = useState<ManualContact | null>(null);

  // Session query
  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const currentUser = sessionData?.user;

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch contacts with pagination
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["/api/contacts/list", page, limit, debouncedSearch, selectedListFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(selectedListFilter !== "all" && { listId: selectedListFilter }),
      });
      return apiRequest("GET", `/api/contacts/list?${params}`);
    },
  });

  // Fetch contact lists
  const { data: listsData } = useQuery<{ lists: ContactList[]; unassignedCount: number; blacklistCount: number }>({
    queryKey: ["/api/contact-lists"],
  });

  const contacts = contactsData?.contacts || [];
  const total = contactsData?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const lists = listsData?.lists || [];
  const unassignedCount = listsData?.unassignedCount || 0;
  const blacklistCount = listsData?.blacklistCount || 0;

  // Create contact form
  const addForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      status: "Regular contact",
      notes: "",
    },
  });

  // Edit contact form
  const editForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
  });

  // Create list form
  const createListForm = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Edit list form
  const editListForm = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
  });

  // Mutations
  const createContactMutation = useMutation({
    mutationFn: (data: ContactFormValues) =>
      apiRequest("POST", "/api/contacts/create", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      setIsAddDialogOpen(false);
      addForm.reset();
      toast({
        title: "Success",
        description: "Contact created successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContactFormValues }) =>
      apiRequest("PUT", `/api/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      setIsEditDialogOpen(false);
      setEditingContact(null);
      toast({
        title: "Success",
        description: "Contact updated successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update contact",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const addToBlacklistMutation = useMutation({
    mutationFn: (data: { channel: string; identifier: string; reason: string; notes?: string }) =>
      apiRequest("POST", "/api/blacklist", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setIsBlacklistDialogOpen(false);
      setBlacklistingContact(null);
      toast({
        title: "Success",
        description: "Contact added to blacklist successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add to blacklist",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (contactIds: string[]) =>
      apiRequest("POST", "/api/contacts/bulk-delete", { contactIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      setSelectedContacts(new Set());
      setIsBulkDeleteOpen(false);
      toast({
        title: "Success",
        description: `${data.deleted} contacts deleted successfully`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contacts",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const bulkAddToListMutation = useMutation({
    mutationFn: ({ listId, contactIds }: { listId: string; contactIds: string[] }) =>
      apiRequest("POST", `/api/contact-lists/${listId}/members/bulk-add`, { contactIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setSelectedContacts(new Set());
      setIsBulkAddToListOpen(false);
      setSelectedListForBulkAdd("");
      toast({
        title: "Success",
        description: `${data.addedCount} contacts added to list. ${data.skippedCount} already in list.`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add contacts to list",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: ({ csvData, listId }: { csvData: string; listId?: string }) =>
      apiRequest("POST", "/api/contacts/import-csv", { csvData, listId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setIsImportDialogOpen(false);
      setCsvFile(null);
      setCsvContent("");
      setImportPreview(null);
      setSelectedListForImport("");
      
      let description = `Imported ${data.imported} contacts. ${data.duplicates} duplicates skipped.`;
      if (data.addedToListCount !== undefined) {
        const selectedList = lists.find(l => l.id === selectedListForImport);
        const listName = selectedList?.name || "the list";
        description += ` ${data.addedToListCount} added to ${listName}.`;
      }
      
      toast({
        title: "Success",
        description,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import contacts",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/contacts/backfill-from-policies", {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/list"] });
      toast({
        title: "Sync Complete",
        description: `${data.processed} policies processed, ${data.created} new contacts created`,
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sync contacts from policies",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // List mutations
  const createListMutation = useMutation({
    mutationFn: (data: ListFormValues) =>
      apiRequest("POST", "/api/contact-lists", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setIsCreateListOpen(false);
      createListForm.reset();
      toast({
        title: "Success",
        description: "List created successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create list",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const updateListMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ListFormValues }) =>
      apiRequest("PATCH", `/api/contact-lists/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setIsEditListOpen(false);
      setEditingList(null);
      toast({
        title: "Success",
        description: "List updated successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update list",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/contact-lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-lists"] });
      setIsDeleteListOpen(false);
      setDeletingListId(null);
      if (selectedListFilter === deletingListId) {
        setSelectedListFilter("all");
      }
      toast({
        title: "Success",
        description: "List deleted successfully",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete list",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(new Set(contacts.map((c: ManualContact) => c.id)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleSelectContact = (contactId: string, checked: boolean) => {
    const newSelection = new Set(selectedContacts);
    if (checked) {
      newSelection.add(contactId);
    } else {
      newSelection.delete(contactId);
    }
    setSelectedContacts(newSelection);
  };

  const handleAddContact = (values: ContactFormValues) => {
    createContactMutation.mutate(values);
  };

  const handleEditContact = (contact: Contact & { sourceCount?: number; status?: string; phone?: string }) => {
    setEditingContact(contact as any);
    const phoneToDisplay = contact.phoneDisplay || (contact.phoneNormalized ? formatForDisplay(contact.phoneNormalized) : (contact.phone ? formatForDisplay(contact.phone) : ""));
    editForm.reset({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      phone: phoneToDisplay,
      email: contact.email || "",
      status: (contact.status || "Regular contact") as "Regular contact" | "Contacted" | "Not Contacted" | "Blacklist",
      notes: contact.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateContact = (values: ContactFormValues) => {
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data: values });
    }
  };

  const handleDeleteContact = () => {
    if (deleteContactId) {
      deleteContactMutation.mutate(deleteContactId);
      setDeleteContactId(null);
    }
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedContacts));
  };

  const handleBulkAddToList = () => {
    if (selectedListForBulkAdd) {
      bulkAddToListMutation.mutate({
        listId: selectedListForBulkAdd,
        contactIds: Array.from(selectedContacts),
      });
    }
  };

  const handleAddToBlacklist = (contact: Contact & { sourceCount?: number; status?: string; phone?: string }) => {
    setBlacklistingContact(contact as any);
    setIsBlacklistDialogOpen(true);
  };

  const confirmAddToBlacklist = async () => {
    if (blacklistingContact) {
      const phoneToUse = blacklistingContact.phoneNormalized || blacklistingContact.phone || "";
      const normalizedPhone = phoneToUse.startsWith('+') ? phoneToUse : formatForStorage(phoneToUse);
      
      // Add to blacklist
      addToBlacklistMutation.mutate({
        channel: "all",
        identifier: normalizedPhone,
        reason: "manual",
        notes: `Manually blacklisted contact: ${blacklistingContact.firstName} ${blacklistingContact.lastName}`,
      });
      
      // Update contact status to "Blacklist"
      updateContactMutation.mutate({
        id: blacklistingContact.id,
        data: {
          firstName: blacklistingContact.firstName,
          lastName: blacklistingContact.lastName,
          phone: blacklistingContact.phone,
          email: blacklistingContact.email || "",
          status: "Blacklist",
          notes: blacklistingContact.notes || "",
        }
      });
    }
  };

  const handleExportCsv = async () => {
    try {
      const params = selectedContacts.size > 0
        ? `?contactIds=${Array.from(selectedContacts).join(",")}`
        : "";
      
      const response = await fetch(`/api/contacts/export-csv${params}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to export contacts");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Contacts exported successfully",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export contacts",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleImportCsv = () => {
    if (csvContent) {
      importCsvMutation.mutate({
        csvData: csvContent,
        listId: selectedListForImport || undefined,
      });
    }
  };

  // List handlers
  const handleCreateList = (values: ListFormValues) => {
    createListMutation.mutate(values);
  };

  const handleEditList = (list: ContactList) => {
    setEditingList(list);
    editListForm.reset({
      name: list.name,
      description: list.description || "",
    });
    setIsEditListOpen(true);
  };

  const handleUpdateList = (values: ListFormValues) => {
    if (editingList) {
      updateListMutation.mutate({ id: editingList.id, data: values });
    }
  };

  const handleDeleteList = () => {
    if (deletingListId) {
      deleteListMutation.mutate(deletingListId);
    }
  };

  const isAllSelected = contacts.length > 0 && selectedContacts.size === contacts.length;
  const isPartiallySelected = selectedContacts.size > 0 && selectedContacts.size < contacts.length;

  // Access control - check after all hooks
  if (currentUser && currentUser.role !== "superadmin" && currentUser.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only admins and superadmins can access contact management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading contacts..." />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contact Management</h1>
          <p className="text-muted-foreground">
            Manage your contacts and lists
          </p>
        </div>
        <Badge variant="secondary" data-testid="badge-contact-count">
          {total} {total === 1 ? "Contact" : "Contacts"}
        </Badge>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left Sidebar - Contact Lists */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Contact Lists</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setIsCreateListOpen(true)}
                  data-testid="button-create-list"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* All Contacts */}
              <button
                onClick={() => setSelectedListFilter("all")}
                className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                  selectedListFilter === "all"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
                data-testid="button-filter-all"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">All Contacts</span>
                </div>
                <Badge variant="secondary">{total}</Badge>
              </button>

              {/* No List - Unassigned Contacts */}
              <button
                onClick={() => setSelectedListFilter("__none")}
                className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                  selectedListFilter === "__none"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
                data-testid="button-filter-nolist"
              >
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="font-medium">No List</span>
                </div>
                <Badge variant="secondary">{unassignedCount}</Badge>
              </button>

              {/* Blacklist */}
              <button
                onClick={() => setSelectedListFilter("__blacklist")}
                className={`w-full flex items-center justify-between p-3 rounded-md text-left transition-colors ${
                  selectedListFilter === "__blacklist"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "text-destructive hover:bg-destructive/10"
                }`}
                data-testid="button-filter-blacklist"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Blacklist</span>
                </div>
                <Badge variant={selectedListFilter === "__blacklist" ? "secondary" : "destructive"}>
                  {blacklistCount}
                </Badge>
              </button>

              {/* Individual Lists */}
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={`group flex items-center justify-between p-3 rounded-md transition-colors ${
                    selectedListFilter === list.id
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  }`}
                >
                  <button
                    onClick={() => setSelectedListFilter(list.id)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                    data-testid={`button-filter-list-${list.id}`}
                  >
                    <ListPlus className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium truncate">{list.name}</span>
                  </button>
                  
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" data-testid={`badge-count-${list.id}`}>
                      {(list as any).memberCount || 0}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          data-testid={`button-list-menu-${list.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEditList(list)}
                          data-testid={`button-edit-list-${list.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDeletingListId(list.id);
                            setIsDeleteListOpen(true);
                          }}
                          className="text-destructive"
                          data-testid={`button-delete-list-${list.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {lists.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <ListPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No lists yet</p>
                  <p className="text-xs mt-1">Create your first list to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Contacts Table */}
        <div className="flex-1 min-w-0">
          <Card>
        <CardHeader>
          <div className="space-y-4">
            {/* Action buttons and search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-contacts"
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  data-testid="button-add-contact"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => backfillMutation.mutate()}
                  disabled={backfillMutation.isPending}
                  data-testid="button-sync-policies"
                >
                  {backfillMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4 mr-2" fullScreen={false} />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Sync from Policies
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setIsImportDialogOpen(true)}
                  data-testid="button-import-csv"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  disabled={contacts.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {/* Filters and bulk actions */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2 items-center">
                <Select value={limit.toString()} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger className="w-[120px]" data-testid="select-items-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk actions toolbar */}
              {selectedContacts.size > 0 && (
                <div className="flex gap-2 items-center animate-in slide-in-from-top duration-200">
                  <span className="text-sm text-muted-foreground">
                    {selectedContacts.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBulkAddToListOpen(true)}
                    data-testid="button-bulk-add-to-list"
                  >
                    <ListPlus className="h-4 w-4 mr-1" />
                    Add to List
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsBulkDeleteOpen(true)}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Selected
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-contacts">
                {debouncedSearch
                  ? "No contacts found matching your search."
                  : "No contacts yet. Add your first contact to get started."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                          data-testid="checkbox-select-all"
                          className={isPartiallySelected ? "opacity-50" : ""}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lists</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact: Contact & { sourceCount?: number; status?: string; phone?: string }) => (
                      <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={(checked) => 
                              handleSelectContact(contact.id, checked as boolean)
                            }
                            aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                            data-testid={`checkbox-contact-${contact.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-contact-name-${contact.id}`}>
                          {contact.firstName} {contact.lastName}
                        </TableCell>
                        <TableCell data-testid={`text-contact-phone-${contact.id}`}>
                          {contact.phoneDisplay || (contact.phoneNormalized ? formatForDisplay(contact.phoneNormalized) : "—")}
                        </TableCell>
                        <TableCell data-testid={`text-contact-email-${contact.id}`}>
                          {contact.email || "—"}
                        </TableCell>
                        <TableCell data-testid={`text-contact-status-${contact.id}`}>
                          <Badge 
                            variant={
                              contact.status === "Blacklist" ? "destructive" :
                              contact.status === "Contacted" ? "default" :
                              contact.status === "Not Contacted" ? "outline" :
                              "secondary"
                            }
                            className="text-xs"
                          >
                            {contact.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs" data-testid={`text-contact-lists-${contact.id}`}>
                          {(contact as any).lists && (contact as any).lists.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {(contact as any).lists.map((list: { id: string; name: string }) => (
                                <Badge 
                                  key={list.id} 
                                  variant="secondary"
                                  className="text-xs"
                                  data-testid={`badge-list-${contact.id}-${list.id}`}
                                >
                                  {list.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No lists</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-contact-actions-${contact.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditContact(contact)}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAddToBlacklist(contact)}
                                data-testid={`button-blacklist-contact-${contact.id}`}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Add to Blacklist
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteContactId(contact.id)}
                                className="text-red-600"
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} contacts
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = page > 3 ? page - 2 + i : i + 1;
                      if (pageNum > totalPages) return null;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="w-10"
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </div>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
            <DialogDescription>
              Enter the contact information below
            </DialogDescription>
          </DialogHeader>
          
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(handleAddContact)} className="space-y-4">
              <FormField
                control={addForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-add-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-add-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="(555) 123-4567" 
                        data-testid="input-add-phone"
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-add-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={addForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-add-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Regular contact">Regular contact</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Not Contacted">Not Contacted</SelectItem>
                        <SelectItem value="Blacklist">Blacklist</SelectItem>
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
                      <Textarea {...field} data-testid="input-add-notes" />
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
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createContactMutation.isPending}
                  data-testid="button-submit-add"
                >
                  {createContactMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4" fullScreen={false} />
                  ) : (
                    "Add Contact"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact information below
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateContact)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        data-testid="input-edit-phone"
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Regular contact">Regular contact</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Not Contacted">Not Contacted</SelectItem>
                        <SelectItem value="Blacklist">Blacklist</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-edit-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateContactMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateContactMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4" fullScreen={false} />
                  ) : (
                    "Update Contact"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteContactId} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedContacts.size} Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedContacts.size} selected contacts? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? (
                <LoadingSpinner className="h-4 w-4" fullScreen={false} />
              ) : (
                `Delete ${selectedContacts.size} Contacts`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add to List Dialog */}
      <Dialog open={isBulkAddToListOpen} onOpenChange={setIsBulkAddToListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {selectedContacts.size} Contacts to List</DialogTitle>
            <DialogDescription>
              Select a list to add the selected contacts to
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select List</label>
              <Select value={selectedListForBulkAdd} onValueChange={setSelectedListForBulkAdd}>
                <SelectTrigger data-testid="select-bulk-add-list">
                  <SelectValue placeholder="Choose a list..." />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkAddToListOpen(false);
                setSelectedListForBulkAdd("");
              }}
              data-testid="button-cancel-bulk-add"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAddToList}
              disabled={!selectedListForBulkAdd || bulkAddToListMutation.isPending}
              data-testid="button-confirm-bulk-add"
            >
              {bulkAddToListMutation.isPending ? (
                <LoadingSpinner className="h-4 w-4" fullScreen={false} />
              ) : (
                `Add to List`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with contact information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="text-center">
                <FileUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <span className="text-primary hover:underline">Choose a CSV file</span>
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="input-csv-file"
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    or drag and drop
                  </p>
                </div>
                {csvFile && (
                  <p className="mt-2 text-sm font-medium">
                    Selected: {csvFile.name}
                  </p>
                )}
              </div>
            </div>
            
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium mb-2">CSV Format Requirements:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Headers: First Name, Last Name, Email, Phone, Notes</li>
                <li>• Required fields: First Name, Last Name, Phone</li>
                <li>• Duplicates will be automatically detected and skipped</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Add imported contacts to a list (optional)</label>
              <Select value={selectedListForImport || "none"} onValueChange={(val) => setSelectedListForImport(val === "none" ? "" : val)}>
                <SelectTrigger data-testid="select-import-list">
                  <SelectValue placeholder="Choose a list (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Don't add to a list</SelectItem>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {importPreview && (
              <div className="space-y-2">
                <h4 className="font-medium">Preview:</h4>
                <div className="border rounded p-2 bg-muted/50">
                  <p className="text-sm">
                    Contacts to import: {importPreview.imported}
                  </p>
                  <p className="text-sm">
                    Duplicates found: {importPreview.duplicates}
                  </p>
                  {importPreview.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-red-600">Errors:</p>
                      <ul className="text-sm text-red-600">
                        {importPreview.errors.map((error: string, i: number) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setCsvFile(null);
                setCsvContent("");
                setImportPreview(null);
              }}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportCsv}
              disabled={!csvContent || importCsvMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importCsvMutation.isPending ? (
                <LoadingSpinner className="h-4 w-4" fullScreen={false} />
              ) : (
                "Import Contacts"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create List Dialog */}
      <Dialog open={isCreateListOpen} onOpenChange={setIsCreateListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Create a new contact list to organize your contacts
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createListForm}>
            <form onSubmit={createListForm.handleSubmit(handleCreateList)} className="space-y-4">
              <FormField
                control={createListForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>List Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-create-list-name" placeholder="e.g. VIP Clients" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createListForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-create-list-description" placeholder="Add a description for this list" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateListOpen(false)}
                  data-testid="button-cancel-create-list"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createListMutation.isPending}
                  data-testid="button-submit-create-list"
                >
                  {createListMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4" fullScreen={false} />
                  ) : (
                    "Create List"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={isEditListOpen} onOpenChange={setIsEditListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit List</DialogTitle>
            <DialogDescription>
              Update the name and description of your list
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editListForm}>
            <form onSubmit={editListForm.handleSubmit(handleUpdateList)} className="space-y-4">
              <FormField
                control={editListForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>List Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-list-name" />
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
                      <Textarea {...field} data-testid="input-edit-list-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditListOpen(false)}
                  data-testid="button-cancel-edit-list"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateListMutation.isPending}
                  data-testid="button-submit-edit-list"
                >
                  {updateListMutation.isPending ? (
                    <LoadingSpinner className="h-4 w-4" fullScreen={false} />
                  ) : (
                    "Update List"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete List Dialog */}
      <AlertDialog open={isDeleteListOpen} onOpenChange={setIsDeleteListOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this list? This will not delete the contacts themselves, only the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-list">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteListMutation.isPending}
              data-testid="button-confirm-delete-list"
            >
              {deleteListMutation.isPending ? (
                <LoadingSpinner className="h-4 w-4" fullScreen={false} />
              ) : (
                "Delete List"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Blacklist Dialog */}
      <AlertDialog open={isBlacklistDialogOpen} onOpenChange={setIsBlacklistDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add to Blacklist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to add {blacklistingContact?.firstName} {blacklistingContact?.lastName} to the blacklist? This will block all future communications with this contact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-blacklist">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAddToBlacklist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={addToBlacklistMutation.isPending}
              data-testid="button-confirm-blacklist"
            >
              {addToBlacklistMutation.isPending ? (
                <LoadingSpinner className="h-4 w-4" fullScreen={false} />
              ) : (
                "Add to Blacklist"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}