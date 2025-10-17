import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User as UserIcon, Mail, Phone, MapPin, Calendar, Building2, Edit, Shield, Power, Trash2 } from "lucide-react";
import { formatPhoneDisplay } from "@/lib/phone-formatter";
import type { Company, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { formatPhoneInput, formatPhoneE164 } from "@/lib/phone-formatter";
import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const editUserFormSchema = insertUserSchema.omit({ password: true, companyId: true }).extend({
  role: z.enum(["admin", "member", "viewer"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional().or(z.literal("")),
  emailSubscribed: z.boolean().default(true),
  smsSubscribed: z.boolean().default(true),
  emailNotifications: z.boolean().default(true),
  invoiceAlerts: z.boolean().default(true),
  emailVerified: z.boolean().optional(),
});

type EditUserForm = z.infer<typeof editUserFormSchema>;

export default function UserDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const userId = params.id;

  const { data: userData, isLoading: isLoadingUser } = useQuery<{ user: User }>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
  });

  const { data: companiesData } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/companies"],
  });

  const { data: sessionData } = useQuery<{ user: User }>({
    queryKey: ["/api/session"],
  });

  const user = userData?.user;
  const companies = companiesData?.companies || [];
  const currentUser = sessionData?.user;
  const isSuperAdmin = currentUser?.role === "superadmin";

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      email: user?.email || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      phone: user?.phone || "",
      role: (user?.role === "admin" || user?.role === "member" || user?.role === "viewer") ? user.role : "member",
      address: user?.address || "",
      dateOfBirth: user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
      preferredLanguage: user?.preferredLanguage || "",
      emailSubscribed: user?.emailSubscribed ?? true,
      smsSubscribed: user?.smsSubscribed ?? true,
      emailNotifications: user?.emailNotifications ?? true,
      invoiceAlerts: user?.invoiceAlerts ?? true,
      emailVerified: user?.emailVerified ?? false,
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async (data: EditUserForm) => {
      const phoneE164 = data.phone ? formatPhoneE164(data.phone) : null;
      return apiRequest("PATCH", `/api/users/${userId}`, { ...data, phone: phoneE164 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditOpen(false);
      toast({
        title: "User Updated",
        description: "User information has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/users/${userId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Status Updated",
        description: "User status has been updated successfully",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully",
      });
      setLocation("/users");
    },
  });

  // Reset form when user data is loaded
  useEffect(() => {
    if (user) {
      editForm.reset({
        email: user.email,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        role: (user.role === "admin" || user.role === "member" || user.role === "viewer") ? user.role : "member",
        address: user.address || "",
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
        preferredLanguage: user.preferredLanguage || "",
        emailSubscribed: user.emailSubscribed ?? true,
        smsSubscribed: user.smsSubscribed ?? true,
        emailNotifications: user.emailNotifications ?? true,
        invoiceAlerts: user.invoiceAlerts ?? true,
        emailVerified: user.emailVerified ?? false,
      });
    }
  }, [user, editForm]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return { label: "Super Admin", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" };
      case "admin":
        return { label: "Admin", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" };
      case "member":
        return { label: "Member", className: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" };
      case "viewer":
        return { label: "Viewer", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400" };
      default:
        return { label: role, className: "bg-gray-100 text-gray-800" };
    }
  };

  const getStatusInfo = () => {
    const userCompany = user?.companyId ? companies.find(c => c.id === user.companyId) : null;
    const isCompanySuspended = userCompany && !userCompany.isActive;
    const isUserInactive = user?.isActive === false;

    if (isCompanySuspended) {
      return {
        label: "Suspended",
        variant: "destructive" as const,
        description: "Company is inactive"
      };
    } else if (isUserInactive) {
      return {
        label: "Inactive",
        variant: "outline" as const,
        description: "User is inactive"
      };
    } else {
      return {
        label: "Active",
        variant: "default" as const,
        description: "User is active"
      };
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h2 className="text-2xl font-bold">User Not Found</h2>
        <Button onClick={() => setLocation("/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>
    );
  }

  const roleBadge = getRoleBadge(user.role);
  const statusInfo = getStatusInfo();
  const userCompany = user.companyId ? companies.find(c => c.id === user.companyId) : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/users")} data-testid="button-back-to-users">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarImage src={user.avatar || undefined} />
          <AvatarFallback className="text-lg">
            {user.firstName && user.lastName
              ? `${user.firstName[0]}${user.lastName[0]}`
              : user.email[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={roleBadge.className}>
            {roleBadge.label}
          </Badge>
          <Badge variant={statusInfo.variant}>
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {user.phone ? formatPhoneDisplay(user.phone) : "Not provided"}
                  </p>
                </div>
              </div>
              {user.address && (
                <div className="flex items-start gap-3 md:col-span-2">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Address</p>
                    <p className="text-sm text-gray-900 dark:text-white">{user.address}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => {
                editForm.reset({
                  email: user.email,
                  firstName: user.firstName || "",
                  lastName: user.lastName || "",
                  phone: user.phone || "",
                  role: (user.role === "admin" || user.role === "member" || user.role === "viewer") ? user.role : "member",
                  address: user.address || "",
                  dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
                  preferredLanguage: user.preferredLanguage || "",
                  emailSubscribed: user.emailSubscribed ?? true,
                  smsSubscribed: user.smsSubscribed ?? true,
                  emailNotifications: user.emailNotifications ?? true,
                  invoiceAlerts: user.invoiceAlerts ?? true,
                  emailVerified: user.emailVerified ?? false,
                });
                setEditOpen(true);
              }}
              data-testid="button-edit-user"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit User
            </Button>
            {user.role !== "superadmin" && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toggleUserStatusMutation.mutate()}
                  disabled={toggleUserStatusMutation.isPending}
                  data-testid="button-toggle-status"
                >
                  <Power className="h-4 w-4 mr-2" />
                  {user.isActive ? "Deactivate" : "Activate"} User
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  data-testid="button-delete-user"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {user.dateOfBirth && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Date of Birth</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {new Date(user.dateOfBirth).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              )}
              {user.preferredLanguage && (
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Preferred Language</p>
                    <p className="text-sm text-gray-900 dark:text-white">{user.preferredLanguage}</p>
                  </div>
                </div>
              )}
              {isSuperAdmin && user.companyId && userCompany && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Company</p>
                    <button
                      className="h-auto p-0 text-sm text-primary hover:underline font-medium"
                      onClick={() => setLocation(`/companies/${userCompany.id}`)}
                    >
                      {userCompany.name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Details */}
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Created At</p>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(user.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Account Status</p>
              <p className="text-sm text-gray-900 dark:text-white">{statusInfo.description}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editUserMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-firstName" />
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
                        <Input {...field} data-testid="input-edit-lastName" />
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="(123) 456-7890"
                        onChange={(e) => {
                          const formatted = formatPhoneInput(e.target.value);
                          field.onChange(formatted);
                        }}
                        data-testid="input-edit-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" data-testid="input-edit-dateOfBirth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="preferredLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Language</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-preferredLanguage" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editUserMutation.isPending} data-testid="button-save-user">
                  {editUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
