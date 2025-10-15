import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserPlus, Trash2, Edit, ArrowLeft, Mail, Phone, Building, Calendar, Shield, User as UserIcon, Power } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, updateUserSchema, type User, type Company } from "@shared/schema";
import { useState } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneDisplay, formatPhoneE164, formatPhoneInput } from "@/lib/phone-formatter";
import { useParams, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const userFormSchema = insertUserSchema.extend({
  role: z.enum(["superadmin", "admin", "member", "viewer"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  companyId: z.string().optional(),
});

// Custom schema for edit form that accepts display format phone (no strict E.164 validation)
const editUserFormSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.string().url().optional(),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum(["superadmin", "admin", "member", "viewer"]).optional(),
  companyId: z.string().optional(),
  isActive: z.boolean().optional(),
});

type UserForm = z.infer<typeof userFormSchema>;
type EditUserForm = z.infer<typeof editUserFormSchema>;

export default function Users() {
  const params = useParams();
  const userId = params.id;
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const { data, isLoading } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users"],
  });

  const { data: companiesData } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
    enabled: sessionData?.user?.role === "superadmin",
  });

  // Fetch individual user if userId is present
  const { data: singleUserData, isLoading: isLoadingSingleUser } = useQuery<{ user: User }>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const currentUser = sessionData?.user;
  const isSuperAdmin = currentUser?.role === "superadmin";
  const companies = companiesData?.companies || [];
  const profileUser = singleUserData?.user;

  const createMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      // Convert phone to E.164 format before sending
      const dataToSend = {
        ...data,
        phone: data.phone ? formatPhoneE164(data.phone) : undefined,
      };
      return apiRequest("POST", "/api/users", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreateOpen(false);
      createForm.reset();
      toast({
        title: "User Created",
        description: "The user has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create user.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: EditUserForm }) => {
      // Convert phone to E.164 format before sending
      const dataToSend = {
        ...data,
        phone: data.phone ? formatPhoneE164(data.phone) : undefined,
      };
      return apiRequest("PATCH", `/api/users/${id}`, dataToSend);
    },
    onSuccess: () => {
      // Invalidate all user-related caches to keep data synced
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      setEditOpen(false);
      setEditingUser(null);
      editForm.reset();
      toast({
        title: "User Updated",
        description: "The user has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "User Deleted",
        description: "The user has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/users/${id}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Status Updated",
        description: "The user status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<UserForm>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: "member",
      companyId: "",
    },
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      role: "member",
      companyId: "",
    },
  });

  const onCreateSubmit = (data: UserForm) => {
    const normalizedData = {
      ...data,
      companyId: data.companyId && data.companyId !== "__none__" ? data.companyId : undefined,
    };
    createMutation.mutate(normalizedData);
  };

  const onEditSubmit = (data: EditUserForm) => {
    if (editingUser?.id) {
      const normalizedData = {
        ...data,
        companyId: data.companyId && data.companyId !== "__none__" ? data.companyId : undefined,
      };
      updateMutation.mutate({ id: editingUser.id, data: normalizedData });
    }
  };

  const handleEdit = (user: Partial<User>) => {
    setEditingUser(user);
    editForm.reset({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone ? formatPhoneDisplay(user.phone) : "",
      role: user.role as "superadmin" | "admin" | "member" | "viewer" | undefined,
      companyId: user.companyId || "__none__",
    });
    setEditOpen(true);
  };

  const filteredUsers = data?.users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // If userId is present, render user profile instead of list
  if (userId) {
    if (isLoadingSingleUser) {
      return (
        <div className="p-6">
          <div className="text-center">Loading user profile...</div>
        </div>
      );
    }

    if (!profileUser) {
      return (
        <div className="p-6">
          <div className="text-center">User not found</div>
        </div>
      );
    }

    const userInitial = (profileUser.firstName?.[0] || profileUser.email.charAt(0)).toUpperCase();
    const userCompany = companies.find(c => c.id === profileUser.companyId);

    return (
      <div className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="col-span-12 lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarImage src={profileUser.avatar || undefined} alt={profileUser.email} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold mb-1">
                    {profileUser.firstName && profileUser.lastName
                      ? `${profileUser.firstName} ${profileUser.lastName}`
                      : profileUser.email}
                  </h2>
                  <Badge variant={
                    profileUser.role === "superadmin" ? "default" :
                    profileUser.role === "admin" ? "secondary" :
                    "outline"
                  } className="mb-4">
                    {profileUser.role === "superadmin" ? "Super Admin" :
                     profileUser.role === "admin" ? "Admin" :
                     profileUser.role === "member" ? "Member" : "Viewer"}
                  </Badge>
                  {profileUser.isActive === false && (
                    <Badge variant="destructive" className="mb-4">Inactive</Badge>
                  )}
                </div>

                <div className="space-y-4 mt-6 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Email:</p>
                    <p className="font-medium break-all">{profileUser.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Cellphone:</p>
                    <p className="font-medium">
                      {profileUser.phone ? formatPhoneDisplay(profileUser.phone) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Created:</p>
                    <p className="font-medium">
                      {new Date(profileUser.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>

                {(isSuperAdmin || currentUser?.role === "admin") && currentUser?.id !== profileUser.id && (
                  <Button
                    variant="destructive"
                    className="w-full mt-6"
                    onClick={() => deleteMutation.mutate(profileUser.id)}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-user-profile"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteMutation.isPending ? "Deleting..." : "Delete User"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            {/* Personal Information Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-semibold">Personal Information</CardTitle>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleEdit(profileUser)}
                  data-testid="button-edit-personal"
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">First name:</p>
                    <p className="font-medium">{profileUser.firstName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Last name:</p>
                    <p className="font-medium">{profileUser.lastName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email address:</p>
                    <p className="font-medium break-all">{profileUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone:</p>
                    <p className="font-medium">
                      {profileUser.phone ? formatPhoneDisplay(profileUser.phone) : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Organization Card */}
            {isSuperAdmin && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-base font-semibold">Organization</CardTitle>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleEdit(profileUser)}
                    data-testid="button-edit-organization"
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Company:</p>
                      <p className="font-medium">{userCompany?.name || "No company assigned"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Account Information Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base font-semibold">Account Information</CardTitle>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleEdit(profileUser)}
                  data-testid="button-edit-account"
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Role:</p>
                    <p className="font-medium">
                      {profileUser.role === "superadmin" ? "Super Administrator" :
                       profileUser.role === "admin" ? "Administrator" :
                       profileUser.role === "member" ? "Team Member" : "Viewer"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status:</p>
                    <p className="font-medium">
                      {profileUser.isActive === false ? "Inactive" : "Active"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Member since:</p>
                    <p className="font-medium">
                      {new Date(profileUser.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  {profileUser.avatar && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Avatar URL:</p>
                      <p className="font-medium text-sm break-all">{profileUser.avatar}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      superadmin: {
        label: "Super Admin",
        className: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      },
      admin: {
        label: "Admin",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
      },
      member: {
        label: "Member",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
      },
      viewer: {
        label: "Viewer",
        className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      }
    };

    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.member;
    return config;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Users</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage users and their permissions.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Add a new user to the system.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-create-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-create-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-create-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""} 
                          type="tel" 
                          placeholder="+1 (415) 555-2671" 
                          data-testid="input-create-phone"
                          onChange={(e) => {
                            const formatted = formatPhoneInput(e.target.value);
                            field.onChange(formatted);
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Format: +1 (415) 555-2671</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" data-testid="input-create-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isSuperAdmin && (
                  <FormField
                    control={createForm.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-create-company">
                              <SelectValue placeholder="Select a company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">No Company</SelectItem>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-create-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="superadmin">Super Admin</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-user-submit">
                    {createMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Modify user email and role.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-edit-email" />
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
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || ""} 
                        type="tel" 
                        placeholder="+1 (415) 555-2671" 
                        data-testid="input-edit-phone"
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Format: +1 (415) 555-2671</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isSuperAdmin && (
                <FormField
                  control={editForm.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-company">
                            <SelectValue placeholder="Select a company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No Company</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="superadmin">Super Admin</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-edit-user-submit">
                  {updateMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">All Users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-9"
                data-testid="input-search-users"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      User
                    </th>
                    {isSuperAdmin && (
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                        Company
                      </th>
                    )}
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Phone
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Role
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Created At
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const roleBadge = getRoleBadge(user.role);
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        data-testid={`row-user-${user.id}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {(user.firstName?.[0] || user.email.charAt(0)).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              {(user.firstName || user.lastName) ? (
                                <>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {user.firstName} {user.lastName}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {user.email}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {isSuperAdmin && (
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {user.companyId ? (
                              companies.find(c => c.id === user.companyId)?.name || "Unknown"
                            ) : (
                              <span className="text-gray-400 italic">No company</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400" data-testid={`text-phone-${user.id}`}>
                          {user.phone ? formatPhoneDisplay(user.phone) : <span className="text-gray-400 italic">No phone</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge.className}`} data-testid={`badge-role-${user.id}`}>
                            {roleBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const userCompany = user.companyId ? companies.find(c => c.id === user.companyId) : null;
                            const isCompanySuspended = userCompany && !userCompany.isActive;
                            const isUserInactive = user.isActive === false;
                            
                            if (isCompanySuspended) {
                              return (
                                <Badge variant="destructive" className="text-xs" data-testid={`badge-status-${user.id}`}>
                                  Suspended
                                </Badge>
                              );
                            } else if (isUserInactive) {
                              return (
                                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 dark:text-yellow-400" data-testid={`badge-status-${user.id}`}>
                                  Inactive
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-300" data-testid={`badge-status-${user.id}`}>
                                  Active
                                </Badge>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString('en-US')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => toggleStatusMutation.mutate(user.id)}
                              disabled={toggleStatusMutation.isPending}
                              data-testid={`button-toggle-status-${user.id}`}
                              title={user.isActive ? "Disable User" : "Enable User"}
                            >
                              <Power className={`h-4 w-4 ${user.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEdit(user)}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => deleteMutation.mutate(user.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-user-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
