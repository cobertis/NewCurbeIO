import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, UserPlus, Trash2, Edit, ArrowLeft, Mail, Phone, Building, Calendar, Shield, User as UserIcon, Power, Camera, Users as UsersIcon, AlertTriangle, Infinity } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingSpinner } from "@/components/loading-spinner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, updateUserSchema, type User, type Company } from "@shared/schema";
import { useState } from "react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatForDisplay, formatE164, formatPhoneInput } from "@shared/phone";
import { formatDateWithTimezone } from "@/lib/date-formatter";
import { useParams, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const userFormSchema = insertUserSchema.omit({ password: true }).extend({
  role: z.enum(["superadmin", "admin", "agent"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional(),
  companyId: z.string().optional(),
});

// Custom schema for edit form that accepts display format phone (no strict E.164 validation)
const editUserFormSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.union([
    z.string().url(),
    z.string().regex(/^data:image\/(png|jpg|jpeg|gif|webp);base64,/, "Avatar must be a valid URL or base64 image"),
    z.literal(""),
    z.null()
  ]).optional(),
  phone: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  preferredLanguage: z.string().optional(),
  role: z.enum(["superadmin", "admin", "agent"]).optional(),
  companyId: z.string().optional(),
  isActive: z.boolean().optional(),
  viewAllCompanyData: z.boolean().optional(),
});

type UserForm = z.infer<typeof userFormSchema>;
type EditUserForm = z.infer<typeof editUserFormSchema>;

type SeatLimitsResponse = {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  message?: string;
};

export default function Users() {
  const params = useParams();
  const userId = params.id;
  const [, setLocation] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
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

  // Fetch user seat limits for the current company
  // Superadmins don't have a companyId, so we skip the limits check for them
  // Seat limits only apply to company admins within their own company context
  const shouldCheckLimits = !isSuperAdmin && !!sessionData?.user?.companyId;
  
  const { data: seatLimitsData, isLoading: isLoadingLimits } = useQuery<SeatLimitsResponse>({
    queryKey: ["/api/users/limits"],
    enabled: shouldCheckLimits,
  });

  // Calculate seat limit warning state - guard against division by zero
  const isNearLimit = seatLimitsData && seatLimitsData.limit !== null && seatLimitsData.limit > 0 && (
    !seatLimitsData.allowed || 
    (seatLimitsData.limit - seatLimitsData.currentCount <= 1) ||
    (seatLimitsData.currentCount / seatLimitsData.limit >= 0.8)
  );
  // Handle zero-seat plans gracefully (trial plans)
  const isZeroSeatPlan = seatLimitsData?.limit === 0;
  // Superadmins can always add users (they manage all companies)
  // Non-superadmins depend on their company's seat limits
  const canAddUsers = isSuperAdmin || (!isLoadingLimits && seatLimitsData?.allowed !== false && !isZeroSeatPlan);

  const createMutation = useMutation({
    mutationFn: async (data: UserForm) => {
      // Convert phone to E.164 format before sending
      const dataToSend = {
        ...data,
        phone: data.phone ? formatE164(data.phone) : undefined,
      };
      console.log("Creating user with data:", dataToSend);
      return apiRequest("POST", "/api/users", dataToSend);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/limits"] });
      setCreateOpen(false);
      createForm.reset();
      toast({
        title: "User Created",
        description: "The user has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("User creation error:", error);
      // The error message is in error.message format: "401: {"message":"Not authenticated"}"
      let errorMessage = "Failed to create user.";
      let errorCode = "";
      try {
        if (error?.message) {
          // Try to extract the JSON part from the error message
          const colonIndex = error.message.indexOf(': ');
          if (colonIndex !== -1) {
            const jsonPart = error.message.substring(colonIndex + 2);
            const errorData = JSON.parse(jsonPart);
            errorMessage = errorData.message || error.message;
            errorCode = errorData.code || "";
          } else {
            errorMessage = error.message;
          }
        }
      } catch (e) {
        errorMessage = error?.message || "Failed to create user.";
      }
      
      // Handle USER_LIMIT_REACHED specifically
      if (errorCode === "USER_LIMIT_REACHED") {
        queryClient.invalidateQueries({ queryKey: ["/api/users/limits"] });
        toast({
          title: "User Limit Reached", 
          description: "Your plan's user limit has been reached. Please upgrade your plan to add more users.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error", 
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: EditUserForm }) => {
      // Convert phone to E.164 format before sending
      const dataToSend = {
        ...data,
        phone: data.phone ? formatE164(data.phone) : undefined,
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
      queryClient.invalidateQueries({ queryKey: ["/api/users/limits"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/users/limits"] });
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

  const updateAvatarMutation = useMutation({
    mutationFn: async ({ id, avatar }: { id: string; avatar: string | null }) => {
      return apiRequest("PATCH", `/api/users/${id}`, { avatar });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/session"] });
      setAvatarDialogOpen(false);
      setAvatarUrl("");
      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update avatar.",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<UserForm>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      dateOfBirth: "",
      preferredLanguage: "en",
      role: "agent",
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
      dateOfBirth: "",
      preferredLanguage: "en",
      role: "agent",
      companyId: "",
    },
  });

  const onCreateSubmit = (data: UserForm) => {
    const normalizedData = {
      ...data,
      companyId: data.companyId && data.companyId !== "__none__" ? data.companyId : undefined,
    };
    console.log("Submitting user creation with normalized data:", normalizedData);
    console.log("Current user session:", sessionData?.user);
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
      phone: user.phone ? formatForDisplay(user.phone) : "",
      viewAllCompanyData: user.viewAllCompanyData || false,
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : "",
      preferredLanguage: user.preferredLanguage || "en",
      role: user.role as "superadmin" | "admin" | "agent" | undefined,
      companyId: user.companyId || "__none__",
    });
    setEditOpen(true);
  };

  const filteredUsers = data?.users.filter(user => {
    const query = searchQuery.toLowerCase();
    const firstName = user.firstName?.toLowerCase() || '';
    const lastName = user.lastName?.toLowerCase() || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const email = user.email.toLowerCase();
    const phone = user.phone?.toLowerCase() || '';
    const companyName = user.companyId 
      ? companies.find(c => c.id === user.companyId)?.name?.toLowerCase() || ''
      : '';
    
    return (
      fullName.includes(query) ||
      firstName.includes(query) ||
      lastName.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      companyName.includes(query)
    );
  }) || [];

  // Profile view JSX
  const renderProfileView = () => {
    if (isLoadingSingleUser) {
      return <LoadingSpinner message="Loading user profile..." />;
    }

    if (!profileUser) {
      return (
        <div className="p-4 sm:p-6">
          <div className="text-center">User not found</div>
        </div>
      );
    }

    const userInitial = (profileUser.firstName?.[0] || profileUser.email.charAt(0)).toUpperCase();
    const userCompany = companies.find(c => c.id === profileUser.companyId);

    return (
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <div className="space-y-6">
              {/* User Info Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div 
                      className="relative group cursor-pointer flex-shrink-0"
                      onClick={() => {
                        setAvatarUrl(profileUser.avatar || "");
                        setAvatarDialogOpen(true);
                      }}
                      data-testid="avatar-edit-trigger"
                    >
                      <Avatar className="h-24 w-24">
                        <AvatarImage src={profileUser.avatar || undefined} alt={profileUser.email} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Camera className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold mb-2">
                        {profileUser.firstName && profileUser.lastName
                          ? `${profileUser.firstName} ${profileUser.lastName}`
                          : profileUser.email}
                      </h2>
                      <div className="space-y-2">
                        <div>
                          <Badge variant={
                            profileUser.role === "superadmin" ? "default" :
                            profileUser.role === "admin" ? "secondary" :
                            "outline"
                          }>
                            {profileUser.role === "superadmin" ? "Super Admin" :
                             profileUser.role === "admin" ? "Admin" :
                             "Agent"}
                          </Badge>
                        </div>
                        <div>
                          <Badge variant={profileUser.isActive === false ? "destructive" : "default"}>
                            {profileUser.isActive === false ? "Inactive" : "Active"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mt-6 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Email:</p>
                      <p className="font-medium break-all">{profileUser.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Cellphone:</p>
                      <p className="font-medium">
                        {profileUser.phone ? formatForDisplay(profileUser.phone) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Created:</p>
                      <p className="font-medium">
                        {formatDateWithTimezone(
                          profileUser.createdAt,
                          currentUser?.timezone ?? undefined,
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
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
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">First name:</p>
                      <p className="font-medium">{profileUser.firstName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Last name:</p>
                      <p className="font-medium">{profileUser.lastName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Date of Birth:</p>
                      <p className="font-medium">
                        {profileUser.dateOfBirth ? (() => {
                          const dateStr = profileUser.dateOfBirth.toString().split('T')[0];
                          const [year, month, day] = dateStr.split('-');
                          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
                        })() : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Preferred Language:</p>
                      <p className="font-medium">
                        {profileUser.preferredLanguage === "es" ? "Spanish" : 
                         profileUser.preferredLanguage === "en" ? "English" : 
                         profileUser.preferredLanguage || "-"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9">
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
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Company:</p>
                    <p className="font-medium">{userCompany?.name || "No company assigned"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  };

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

  // If userId is present, render profile view
  if (userId) {
    return (
      <>
        {renderProfileView()}
        
        {/* Edit User Dialog */}
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
                          placeholder="(415) 555-2671" 
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} 
                            type="date" 
                            data-testid="input-edit-dateofbirth"
                            onChange={(e) => {
                              field.onChange(e.target.value);
                            }}
                          />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                          <SelectItem value="agent">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="viewAllCompanyData"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Share Full Company Data
                        </FormLabel>
                        <FormDescription>
                          Allow this user to view all policies, quotes, contacts, tasks, and calendar events from the entire company (not just their own data)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-view-all-company-data"
                        />
                      </FormControl>
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

        {/* Avatar Edit Dialog */}
        <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
          <DialogContent data-testid="dialog-edit-avatar">
            <DialogHeader>
              <DialogTitle>Edit Profile Picture</DialogTitle>
              <DialogDescription>
                Upload an image from your device
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Image</label>
                <div className="mt-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setAvatarUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    data-testid="input-avatar-file"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG or GIF (max 5MB)
                  </p>
                </div>
              </div>

              {avatarUrl && (
                <div className="flex justify-center">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl} alt="Preview" />
                    <AvatarFallback>Preview</AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-2">
              {profileUser?.avatar && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (profileUser?.id) {
                      updateAvatarMutation.mutate({ id: profileUser.id, avatar: null });
                    }
                  }}
                  disabled={updateAvatarMutation.isPending}
                  data-testid="button-remove-avatar"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
              <Button
                variant="default"
                onClick={() => {
                  if (profileUser?.id && avatarUrl) {
                    updateAvatarMutation.mutate({ id: profileUser.id, avatar: avatarUrl });
                  }
                }}
                disabled={!avatarUrl || updateAvatarMutation.isPending}
                data-testid="button-save-avatar"
              >
                {updateAvatarMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
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
                          placeholder="(415) 555-2671" 
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ""} 
                            type="date" 
                            data-testid="input-create-dateofbirth"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="preferredLanguage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Language</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-create-language">
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Spanish</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                          <SelectItem value="agent">Agent</SelectItem>
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
                        placeholder="(415) 555-2671" 
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} 
                          type="date" 
                          data-testid="input-edit-dateofbirth"
                          onChange={(e) => {
                            field.onChange(e.target.value);
                          }}
                        />
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                          <SelectItem value="agent">Agent</SelectItem>
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

      {/* Avatar Edit Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent data-testid="dialog-edit-avatar">
          <DialogHeader>
            <DialogTitle>Edit Profile Picture</DialogTitle>
            <DialogDescription>
              Upload an image from your device
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Image</label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setAvatarUrl(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  data-testid="input-avatar-file"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG or GIF (max 5MB)
                </p>
              </div>
            </div>

            {avatarUrl && (
              <div className="flex justify-center">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl} alt="Preview" />
                  <AvatarFallback>Preview</AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            {profileUser?.avatar && (
              <Button
                variant="outline"
                onClick={() => {
                  if (profileUser?.id) {
                    updateAvatarMutation.mutate({ id: profileUser.id, avatar: null });
                  }
                }}
                disabled={updateAvatarMutation.isPending}
                data-testid="button-remove-avatar"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => {
                if (profileUser?.id && avatarUrl) {
                  updateAvatarMutation.mutate({ id: profileUser.id, avatar: avatarUrl });
                }
              }}
              disabled={!avatarUrl || updateAvatarMutation.isPending}
              data-testid="button-save-avatar"
            >
              {updateAvatarMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seat Limit Card */}
      {!isSuperAdmin && seatLimitsData && seatLimitsData.limit !== null && (
        <Card 
          className={`mb-4 border ${
            isNearLimit 
              ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20' 
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
          }`}
          data-testid="card-seat-limits"
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isNearLimit ? (
                  <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                  </div>
                ) : (
                  <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <UsersIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-seat-count">
                    {seatLimitsData.currentCount} of {seatLimitsData.limit} users
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="text-seat-message">
                    {!seatLimitsData.allowed 
                      ? "User limit reached. Upgrade your plan to add more users."
                      : isNearLimit 
                        ? `${seatLimitsData.limit - seatLimitsData.currentCount} seat${seatLimitsData.limit - seatLimitsData.currentCount === 1 ? '' : 's'} remaining`
                        : "Active users and pending invitations"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" data-testid="progress-seat-usage">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      !seatLimitsData.allowed 
                        ? 'bg-red-500' 
                        : isNearLimit 
                          ? 'bg-amber-500' 
                          : 'bg-gray-500 dark:bg-gray-400'
                    }`}
                    style={{ width: `${seatLimitsData.limit && seatLimitsData.limit > 0 ? Math.min(100, (seatLimitsData.currentCount / seatLimitsData.limit) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unlimited Users Card */}
      {!isSuperAdmin && seatLimitsData && seatLimitsData.limit === null && (
        <Card 
          className="mb-4 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          data-testid="card-unlimited-seats"
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                <Infinity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-unlimited">
                  Unlimited users
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your plan allows unlimited team members
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">All Users</CardTitle>
            <div className="flex items-center gap-4">
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        onClick={() => setCreateOpen(true)} 
                        disabled={!isSuperAdmin && (isLoadingLimits || !canAddUsers)}
                        data-testid="button-add-user"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        {!isSuperAdmin && isLoadingLimits ? "Loading..." : "Add User"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!canAddUsers && (
                    <TooltipContent data-testid="tooltip-seat-limit">
                      <p>User limit reached. Upgrade your plan to add more users.</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
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
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={(e) => {
                          // Don't navigate if clicking on action buttons
                          if ((e.target as HTMLElement).closest('button')) return;
                          setLocation(`/users/${user.id}`);
                        }}
                        data-testid={`row-user-${user.id}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar || undefined} alt={user.email} />
                              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                {(user.firstName?.[0] || user.email.charAt(0)).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
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
                          {user.phone ? formatForDisplay(user.phone) : <span className="text-gray-400 italic">No phone</span>}
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
                          {formatDateWithTimezone(
                            user.createdAt,
                            currentUser?.timezone ?? undefined
                          )}
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
